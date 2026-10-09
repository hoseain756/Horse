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
//
// TorBox flow (free-plan friendly, async-honest):
//   1. mylist (bypass_cache) → reuse an existing torrent with the same hash
//   2. else createtorrent (multipart form: magnet + seed + allow_zip)
//      — cached torrents land instantly as "cached"; uncached ones download
//        on TorBox's servers (free plan: 1 active slot)
//   3. poll mylist until download_state ∈ {cached, completed} within budget
//   4. pick the video file (filename match > video mimetype > largest)
//   5. requestdl?token=…&torrent_id=&file_id= → { data: "<direct url>" }
//   Resolved torrents intentionally STAY in the user's TorBox dashboard:
//   deleting would break the async "download now, watch in a few minutes"
//   model and the free plan expires stored torrents on its own schedule.
import { NextRequest, NextResponse } from "next/server";
import {
  AD_API,
  FORM_HEADERS,
  RD_API,
  TB_API,
  UpstreamError,
  bearer,
  fetchJson,
  formBody,
  guardDebrid,
  makeBudget,
  torboxHeaders,
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
  if (body.service !== "realdebrid" && body.service !== "alldebrid" && body.service !== "torbox") {
    return NextResponse.json({ error: "invalid service (realdebrid | alldebrid | torbox)" }, { status: 400 });
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
        : body.service === "alldebrid"
          ? await resolveAllDebrid(body.apiKey, body.infoHash, filename)
          : await resolveTorBox(body.apiKey, body.infoHash, filename);
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

// ---------------- TorBox ----------------

type TbFile = {
  id: number;
  name: string;
  shortName: string | null;
  bytes: number;
  video: boolean;
};

type TbTorrent = {
  id: number;
  hash: string;
  name: string | null;
  state: string;
  files: TbFile[];
};

function parseTbTorrent(raw: unknown): TbTorrent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const rec = raw as Record<string, unknown>;
  const id = typeof rec.id === "number" ? rec.id : Number(rec.id);
  const hash = typeof rec.hash === "string" ? rec.hash.toLowerCase() : "";
  if (!Number.isFinite(id) || !/^[0-9a-f]{40}$/.test(hash)) return null;
  const files: TbFile[] = [];
  const rawFiles = Array.isArray(rec.files) ? rec.files : [];
  for (const f of rawFiles) {
    if (typeof f !== "object" || f === null) continue;
    const fr = f as Record<string, unknown>;
    const fid = typeof fr.id === "number" ? fr.id : Number(fr.id);
    if (!Number.isFinite(fid)) continue;
    const name = typeof fr.name === "string" ? fr.name : "";
    if (!name) continue;
    const mimetype = typeof fr.mimetype === "string" ? fr.mimetype : "";
    files.push({
      id: fid,
      name,
      shortName: typeof fr.short_name === "string" ? fr.short_name : null,
      bytes: typeof fr.size === "number" && Number.isFinite(fr.size) ? fr.size : 0,
      video: /^video\//i.test(mimetype) || VIDEO_EXT_RE.test(name),
    });
  }
  return {
    id,
    hash,
    name: typeof rec.name === "string" ? rec.name : null,
    state: typeof rec.download_state === "string" ? rec.download_state.toLowerCase() : "",
    files,
  };
}

async function torboxMyList(
  apiKey: string,
  opts: { id?: number } = {},
): Promise<TbTorrent[]> {
  const qs = new URLSearchParams({ bypass_cache: "true", limit: "1000" });
  if (typeof opts.id === "number" && Number.isFinite(opts.id)) qs.set("id", String(opts.id));
  const r = await fetchJson(
    `${TB_API}/torrents/mylist?${qs.toString()}`,
    { headers: torboxHeaders(apiKey) },
    "TorBox list",
  );
  if (r.status === 401 || r.status === 403) {
    throw new UpstreamError("Invalid TorBox API key", 401);
  }
  if (r.status !== 200) {
    throw new UpstreamError(`TorBox list failed (HTTP ${r.status})`, 502);
  }
  const d = r.data as { success?: unknown; detail?: unknown; data?: unknown };
  if (d.success !== true || d.data === null || d.data === undefined) {
    const detail = typeof d.detail === "string" && /auth|token|key/i.test(d.detail)
      ? "Invalid TorBox API key"
      : `TorBox: ${typeof d.detail === "string" ? d.detail : "list rejected"}`;
    throw new UpstreamError(detail, /auth|token|key/i.test(String(d.detail)) ? 401 : 502);
  }
  // TorBox quirk: `data` is an array normally, but a single OBJECT when the
  // optional `id` filter is used — normalize both into a list.
  const list = Array.isArray(d.data) ? d.data : [d.data];
  return list.map(parseTbTorrent).filter((t): t is TbTorrent => t !== null);
}

/** filename match > largest video-mimetype file > largest file overall. */
function pickTbFile(t: TbTorrent, filename?: string): TbFile | null {
  if (t.files.length === 0) return null;
  if (filename) {
    const needle = filename.toLowerCase();
    const match = t.files.find(
      (f) =>
        f.name.toLowerCase().includes(needle) ||
        (f.shortName ?? "").toLowerCase().includes(needle),
    );
    if (match) return match;
  }
  const vids = t.files.filter((f) => f.video);
  const pool = vids.length > 0 ? vids : t.files;
  return pool.reduce((a, b) => (b.bytes > a.bytes ? b : a), pool[0]);
}

async function resolveTorBox(
  apiKey: string,
  infoHash: string,
  filename?: string,
): Promise<ResolveResult> {
  const budget = makeBudget();
  const hash = infoHash.toLowerCase();
  const step = (s: string) => `TorBox ${s}`;

  // 1. Reuse an existing torrent with the same hash (rewatch / retry path —
  //    also avoids burning the free plan's single active slot on duplicates).
  budget(step("list"));
  const existing = (await torboxMyList(apiKey)).find((t) => t.hash === hash);
  let torrent = existing ?? null;
  let torrentId = torrent?.id ?? null;

  // 2. Not on the account yet → add via magnet (multipart form per API spec).
  if (!torrent) {
    budget(step("add"));
    const magnet = `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(filename ?? hash)}`;
    const form = new FormData();
    form.set("magnet", magnet);
    form.set("seed", "2");
    form.set("allow_zip", "false");
    const added = await fetchJson(
      `${TB_API}/torrents/createtorrent`,
      { method: "POST", headers: torboxHeaders(apiKey), body: form },
      step("add"),
    );
    if (added.status === 401 || added.status === 403) {
      throw new UpstreamError("Invalid TorBox API key", 401);
    }
    if (added.status !== 200 && added.status !== 201) {
      throw new UpstreamError(step(`add failed (HTTP ${added.status})`), 502);
    }
    const addData = added.data as { success?: unknown; error?: unknown; detail?: unknown; data?: { torrent_id?: unknown } | null };
    if (addData.success !== true) {
      const detail = typeof addData.detail === "string" ? addData.detail : "torrent rejected by TorBox";
      throw new UpstreamError(`TorBox: ${detail}`, 502);
    }
    torrentId =
      typeof addData.data?.torrent_id === "number" && Number.isFinite(addData.data.torrent_id)
        ? addData.data.torrent_id
        : null;
  }

  // 3. Poll mylist until the torrent is ready (cached torrents land instantly;
  //    uncached ones download on TorBox's servers — free plan: 1 active slot).
  const pollUntil = Date.now() + 35_000;
  for (;;) {
    budget(step("status"));
    if (torrentId !== null) {
      const byId = await torboxMyList(apiKey, { id: torrentId });
      torrent = byId.find((t) => t.id === torrentId) ?? torrent;
    } else {
      torrent = (await torboxMyList(apiKey)).find((t) => t.hash === hash) ?? torrent;
    }
    if (torrent && (torrent.state === "cached" || torrent.state === "completed")) break;
    if (torrent && torrent.state === "error") {
      throw new UpstreamError("TorBox could not download this torrent (dead or unsupported)", 502);
    }
    if (Date.now() >= pollUntil) {
      throw new UpstreamError(
        "TorBox is still downloading this torrent — it keeps working in your TorBox account; try again in a few minutes",
        504,
      );
    }
    await new Promise((r) => setTimeout(r, 2_500));
  }
  if (!torrent) {
    throw new UpstreamError(step("torrent disappeared from your list"), 502);
  }

  // 4. Pick the video file.
  const file = pickTbFile(torrent, filename);
  if (!file) {
    throw new UpstreamError("TorBox: this torrent contains no playable file", 404);
  }

  // 5. requestdl — the API key travels as ?token= (per API spec) because the
  //    resulting CDN link must stay playable standalone in <video>.
  budget(step("link"));
  const dl = await fetchJson(
    `${TB_API}/torrents/requestdl?token=${encodeURIComponent(apiKey)}&torrent_id=${torrent.id}&file_id=${file.id}&zip_link=false`,
    { headers: torboxHeaders(apiKey) },
    step("link"),
  );
  if (dl.status === 401 || dl.status === 403) {
    throw new UpstreamError("Invalid TorBox API key", 401);
  }
  if (dl.status !== 200) {
    throw new UpstreamError(step(`link failed (HTTP ${dl.status})`), 502);
  }
  const dlData = dl.data as { success?: unknown; detail?: unknown; data?: unknown };
  if (dlData.success !== true || typeof dlData.data !== "string" || dlData.data.length === 0) {
    const detail = typeof dlData.detail === "string" ? dlData.detail : "no download link returned";
    throw new UpstreamError(`TorBox: ${detail}`, 502);
  }
  const outName = file.shortName ?? file.name.split("/").pop() ?? filename;
  return { url: dlData.data, ...(outName ? { filename: outName } : {}) };
}
