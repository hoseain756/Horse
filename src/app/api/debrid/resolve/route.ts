// Harbor Web — POST /api/debrid/resolve
// Unlocks a torrent (infoHash) into a direct HTTPS stream URL using the
// caller's own debrid service. BYO key: relayed per request, never stored.
//
// Real-Debrid flow (cached-only, honest):
//   1. instantAvailability → no cached files => 404 honest error (no download)
//   2. pick best cached file group (filename match > video ext > largest bytes)
//   3. addMagnet → selectFiles (fallback files=all) → info → links[]
//   4. unrestrict/link → {download} → return URL
//   5. best-effort delete the working torrent afterwards
//
// AllDebrid flow (best-effort simple): magnet/upload → poll status until
// ready (statusCode 4) → link/unlock → direct link. Not ready in budget =>
// honest error.
import { NextRequest, NextResponse } from "next/server";
import {
  AD_API,
  FORM_HEADERS,
  RD_API,
  UpstreamError,
  bearer,
  fetchJson,
  formBody,
  guardDebrid,
  makeBudget,
  validApiKey,
  validInfoHash,
  VIDEO_EXT_RE,
} from "@/lib/harbor/debrid-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResolveResult = { url: string; filename?: string };

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!guardDebrid(req, "debrid-resolve")) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  let body: {
    service?: unknown;
    apiKey?: unknown;
    infoHash?: unknown;
    filename?: unknown;
    filesize?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (body.service !== "realdebrid" && body.service !== "alldebrid") {
    return NextResponse.json({ error: "invalid service (realdebrid | alldebrid)" }, { status: 400 });
  }
  if (!validApiKey(body.apiKey)) {
    return NextResponse.json({ error: "invalid API key (10-200 characters required)" }, { status: 400 });
  }
  if (!validInfoHash(body.infoHash)) {
    return NextResponse.json({ error: "invalid infoHash (expected 40-char hex)" }, { status: 400 });
  }
  const filename = typeof body.filename === "string" && body.filename.trim().length > 0 ? body.filename.trim() : undefined;

  try {
    const result =
      body.service === "realdebrid"
        ? await resolveRealDebrid(body.apiKey, body.infoHash, filename)
        : await resolveAllDebrid(body.apiKey, body.infoHash, filename);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UpstreamError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "debrid service unreachable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// ---------------- Real-Debrid ----------------

type RdFile = { id: number; name: string | null; bytes: number };

function parseRdGroup(group: unknown): RdFile[] | null {
  if (!Array.isArray(group)) return null;
  const files: RdFile[] = [];
  for (const f of group) {
    if (typeof f !== "object" || f === null) continue;
    const rec = f as Record<string, unknown>;
    const id = typeof rec.id === "number" ? rec.id : Number(rec.id);
    if (!Number.isFinite(id)) continue;
    files.push({
      id,
      name: typeof rec.name === "string" ? rec.name : null,
      bytes: typeof rec.bytes === "number" && Number.isFinite(rec.bytes) ? rec.bytes : 0,
    });
  }
  return files.length > 0 ? files : null;
}

/**
 * Choose the best cached variant: a group containing the requested filename
 * wins (case-insensitive), otherwise prefer groups whose largest file has a
 * video extension, breaking ties on largest single-file bytes.
 */
function pickRdGroup(
  rd: unknown[],
  filename?: string,
): { ids: string[]; linkIndex: number; chosenName?: string } | null {
  let best: { files: RdFile[]; score: number } | null = null;
  for (const group of rd) {
    const files = parseRdGroup(group);
    if (!files) continue;
    const largest = files.reduce((a, b) => (b.bytes > a.bytes ? b : a), files[0]);
    let score = 0;
    if (filename) {
      const needle = filename.toLowerCase();
      if (files.some((f) => (f.name ?? "").toLowerCase().includes(needle))) score += 1e15;
    }
    if (largest.name && VIDEO_EXT_RE.test(largest.name)) score += 100_000;
    score += Math.min(largest.bytes, 1e12);
    if (!best || score > best.score) best = { files, score };
  }
  if (!best) return null;

  let chosen = best.files.reduce((a, b) => (b.bytes > a.bytes ? b : a), best.files[0]);
  if (filename) {
    const needle = filename.toLowerCase();
    const match = best.files.find((f) => (f.name ?? "").toLowerCase().includes(needle));
    if (match) chosen = match;
  } else {
    const vids = best.files.filter((f) => f.name && VIDEO_EXT_RE.test(f.name));
    if (vids.length > 0) chosen = vids.reduce((a, b) => (b.bytes > a.bytes ? b : a), vids[0]);
  }
  const ids = best.files.map((f) => String(f.id));
  const linkIndex = Math.max(0, ids.indexOf(String(chosen.id)));
  return { ids, linkIndex, chosenName: chosen.name ?? undefined };
}

async function resolveRealDebrid(
  apiKey: string,
  infoHash: string,
  filename?: string,
): Promise<ResolveResult> {
  const budget = makeBudget();
  const hash = infoHash.toLowerCase();
  const step = (s: string) => `Real-Debrid ${s}`;

  // a. Cached availability — honest 404 when not instantly available
  budget(step("cache check"));
  const avail = await fetchJson(
    `${RD_API}/torrents/instantAvailability/${hash}`,
    { headers: bearer(apiKey) },
    step("cache check"),
  );
  if (avail.status === 401 || avail.status === 403) {
    throw new UpstreamError("Invalid Real-Debrid API key", 401);
  }
  if (avail.status !== 200) {
    throw new UpstreamError(step(`cache check failed (HTTP ${avail.status})`), 502);
  }
  const rd = (avail.data as { rd?: unknown } | null)?.rd;
  if (!Array.isArray(rd) || rd.length === 0) {
    throw new UpstreamError("Not cached on Real-Debrid — instant playback unavailable", 404);
  }
  const group = pickRdGroup(rd, filename);
  if (!group || group.ids.length === 0) {
    throw new UpstreamError("Not cached on Real-Debrid — instant playback unavailable", 404);
  }

  // c. addMagnet
  budget(step("add magnet"));
  const magnet = `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(filename ?? hash)}`;
  const added = await fetchJson(
    `${RD_API}/torrents/addMagnet`,
    {
      method: "POST",
      headers: { ...bearer(apiKey), ...FORM_HEADERS },
      body: formBody({ magnet }),
    },
    step("add magnet"),
  );
  if (added.status === 401 || added.status === 403) {
    throw new UpstreamError("Invalid Real-Debrid API key", 401);
  }
  if (added.status !== 200 && added.status !== 201) {
    throw new UpstreamError(step(`addMagnet failed (HTTP ${added.status})`), 502);
  }
  const torrentId = (added.data as { id?: unknown } | null)?.id;
  if (typeof torrentId !== "string" || torrentId.length === 0) {
    throw new UpstreamError(step("addMagnet returned no torrent id"), 502);
  }

  try {
    // d. info → select files → info → links
    budget(step("torrent info"));
    let info = await fetchJson(
      `${RD_API}/torrents/info/${torrentId}`,
      { headers: bearer(apiKey) },
      step("torrent info"),
    );
    if (info.status === 401 || info.status === 403) {
      throw new UpstreamError("Invalid Real-Debrid API key", 401);
    }
    if (info.status !== 200) {
      throw new UpstreamError(step(`torrent info failed (HTTP ${info.status})`), 502);
    }
    let infoData = info.data as { status?: unknown; links?: unknown };
    if (infoData.status === "waiting_files_selection") {
      budget(step("select files"));
      const selected = await fetchJson(
        `${RD_API}/torrents/selectFiles/${torrentId}`,
        {
          method: "POST",
          headers: { ...bearer(apiKey), ...FORM_HEADERS },
          body: formBody({ files: group.ids.join(",") }),
        },
        step("select files"),
      );
      if (selected.status >= 400) {
        // Fallback: select everything
        budget(step("select files (all)"));
        await fetchJson(
          `${RD_API}/torrents/selectFiles/${torrentId}`,
          {
            method: "POST",
            headers: { ...bearer(apiKey), ...FORM_HEADERS },
            body: formBody({ files: "all" }),
          },
          step("select files (all)"),
        );
      }
      budget(step("torrent info"));
      info = await fetchJson(
        `${RD_API}/torrents/info/${torrentId}`,
        { headers: bearer(apiKey) },
        step("torrent info"),
      );
      if (info.status !== 200) {
        throw new UpstreamError(step(`torrent info failed (HTTP ${info.status})`), 502);
      }
      infoData = info.data as { status?: unknown; links?: unknown };
    }

    if (!Array.isArray(infoData.links) || infoData.links.length === 0) {
      throw new UpstreamError(
        step("no links produced — the torrent may still be downloading"),
        502,
      );
    }
    const links = infoData.links.filter((l): l is string => typeof l === "string" && l.length > 0);
    if (links.length === 0) {
      throw new UpstreamError(step("no usable links produced"), 502);
    }
    const link = links[Math.min(group.linkIndex, links.length - 1)] ?? links[0];

    // e. unrestrict
    budget(step("unrestrict link"));
    const unr = await fetchJson(
      `${RD_API}/unrestrict/link`,
      {
        method: "POST",
        headers: { ...bearer(apiKey), ...FORM_HEADERS },
        body: formBody({ link }),
      },
      step("unrestrict link"),
    );
    if (unr.status === 401 || unr.status === 403) {
      throw new UpstreamError("Invalid Real-Debrid API key", 401);
    }
    if (unr.status !== 200) {
      throw new UpstreamError(step(`unrestrict failed (HTTP ${unr.status})`), 502);
    }
    const download = (unr.data as { download?: unknown } | null)?.download;
    if (typeof download !== "string" || download.length === 0) {
      throw new UpstreamError(step("unrestrict returned no download URL"), 502);
    }
    return { url: download, filename: group.chosenName ?? filename };
  } finally {
    // f. best-effort cleanup — never blocks the result
    try {
      await fetch(`${RD_API}/torrents/delete/${torrentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      });
    } catch {
      /* best-effort */
    }
  }
}

// ---------------- AllDebrid ----------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function resolveAllDebrid(
  apiKey: string,
  infoHash: string,
  filename?: string,
): Promise<ResolveResult> {
  const budget = makeBudget();
  const hash = infoHash.toLowerCase();
  const keyQ = `agent=harborweb&apikey=${encodeURIComponent(apiKey)}`;

  // 1. upload magnet
  budget("AllDebrid upload");
  const magnet = `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(filename ?? hash)}`;
  const up = await fetchJson(
    `${AD_API}/magnet/upload?${keyQ}`,
    {
      method: "POST",
      headers: FORM_HEADERS,
      body: formBody({ "magnets[]": magnet }),
    },
    "AllDebrid upload",
  );
  if (up.status !== 200) {
    throw new UpstreamError(`AllDebrid upload failed (HTTP ${up.status})`, 502);
  }
  const upData = up.data as {
    status?: unknown;
    error?: { code?: unknown; message?: unknown };
    data?: { magnets?: Array<Record<string, unknown>> };
  };
  if (upData.status !== "success") {
    const code = typeof upData.error?.code === "string" ? upData.error.code : "";
    const message = typeof upData.error?.message === "string" ? upData.error.message : "upload rejected";
    if (/auth/i.test(code)) throw new UpstreamError("Invalid AllDebrid API key", 401);
    throw new UpstreamError(`AllDebrid: ${message}`, 502);
  }
  const magnetRec = upData.data?.magnets?.[0];
  const magnetId = magnetRec?.id;
  if (magnetId === undefined || magnetId === null) {
    throw new UpstreamError("AllDebrid: upload returned no magnet id", 502);
  }

  // 2. poll status until ready (statusCode 4) within the remaining budget
  const pollUntil = Date.now() + 35_000;
  let links: string[] = [];
  while (Date.now() < pollUntil) {
    await sleep(2_000);
    budget("AllDebrid status");
    const st = await fetchJson(
      `${AD_API}/magnet/status?${keyQ}&id=${encodeURIComponent(String(magnetId))}`,
      { headers: { Accept: "application/json" } },
      "AllDebrid status",
    );
    if (st.status !== 200) {
      throw new UpstreamError(`AllDebrid status failed (HTTP ${st.status})`, 502);
    }
    const magnet = (
      st.data as {
        status?: unknown;
        data?: {
          magnet?: {
            statusCode?: unknown;
            links?: Array<Record<string, unknown>>;
          };
        };
      }
    ).data?.magnet;
    if (!magnet) throw new UpstreamError("AllDebrid: magnet not found", 502);
    if (magnet.statusCode === 4) {
      links = (magnet.links ?? [])
        .map((l) => (typeof l?.link === "string" ? l.link : ""))
        .filter((l) => l.length > 0);
      break;
    }
    if (typeof magnet.statusCode === "number" && magnet.statusCode > 4) {
      throw new UpstreamError(
        "AllDebrid could not process this torrent (dead or unsupported)",
        502,
      );
    }
  }
  if (links.length === 0) {
    throw new UpstreamError(
      "AllDebrid is still processing this torrent — not ready yet. Try again shortly.",
      504,
    );
  }

  // 3. unlock a link (prefer the requested filename when present)
  const target =
    (filename && links.find((l) => l.toLowerCase().includes(filename.toLowerCase()))) || links[0];
  budget("AllDebrid unlock");
  const unlocked = await fetchJson(
    `${AD_API}/link/unlock?${keyQ}&link=${encodeURIComponent(target)}`,
    { headers: { Accept: "application/json" } },
    "AllDebrid unlock",
  );
  if (unlocked.status !== 200) {
    throw new UpstreamError(`AllDebrid unlock failed (HTTP ${unlocked.status})`, 502);
  }
  const unlockData = unlocked.data as {
    status?: unknown;
    error?: { code?: unknown; message?: unknown };
    data?: { link?: unknown; filename?: unknown };
  };
  if (unlockData.status !== "success" || typeof unlockData.data?.link !== "string") {
    const message =
      typeof unlockData.error?.message === "string" ? unlockData.error.message : "unlock failed";
    throw new UpstreamError(`AllDebrid: ${message}`, 502);
  }
  const outFilename =
    typeof unlockData.data.filename === "string" && unlockData.data.filename.length > 0
      ? unlockData.data.filename
      : filename;
  return { url: unlockData.data.link, ...(outFilename ? { filename: outFilename } : {}) };
}
