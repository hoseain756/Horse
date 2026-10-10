// Harbor Web — POST /api/pairing/claim  { code, service, apiKey }
// The phone side of device pairing: proves the key works (debrid keys are
// validated against the real service; TMDB keys against TMDB /configuration),
// then seals it (AES-256-GCM, AAD-bound to the code) into the pending pairing
// row. The claim is ATOMIC (payloadEnc must still be null) so two phones
// racing on the same code cannot both win. The key is never logged.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/harbor/proxy-core";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import {
  normalizePairingCode,
  sealPairingPayload,
  type PairingPayload,
  type PairingService,
} from "@/lib/harbor/pairing-server";
import { validApiKey, lookupDebridUser, UpstreamError } from "@/lib/harbor/debrid-server";
import { validateTmdbKeyServer, TmdbKeyError } from "@/lib/harbor/tmdb-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(`pairing-claim:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let body: { code?: unknown; service?: unknown; apiKey?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const code = normalizePairingCode(body.code);
  if (!code) {
    return NextResponse.json({ error: "invalid pairing code" }, { status: 400 });
  }
  const rawService = body.service;
  if (rawService !== "realdebrid" && rawService !== "alldebrid" && rawService !== "torbox" && rawService !== "tmdb") {
    return NextResponse.json(
      { error: "invalid service (realdebrid | alldebrid | torbox | tmdb)" },
      { status: 400 },
    );
  }
  // Debrid keys: 10-200 chars. TMDB credentials are longer (v4 read tokens are
  // multi-hundred-char JWTs; settings normalization caps them at 400).
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  const keyOk =
    rawService === "tmdb"
      ? apiKey.length >= 20 && apiKey.length <= 400
      : validApiKey(apiKey);
  if (!keyOk) {
    return NextResponse.json(
      {
        error:
          rawService === "tmdb"
            ? "invalid TMDB key (20-400 characters required)"
            : "invalid API key (10-200 characters required)",
      },
      { status: 400 },
    );
  }
  const service = rawService as PairingService;

  // Per-service QR linking: when the code was created pinned to one service,
  // a claim with any OTHER service is rejected outright (the TorBox QR can
  // never be satisfied with an AllDebrid key, etc.). Unpinned rows accept all.
  try {
    const row = await db.pairingCode.findUnique({
      where: { code },
      select: { pinnedService: true },
    });
    if (row?.pinnedService && row.pinnedService !== service) {
      return NextResponse.json(
        { error: "this code is for a different service" },
        { status: 409 },
      );
    }
  } catch {
    // Row lookup failed → fall through; the atomic claim below still guards
    // single-use, and claim unknown/expired rows answers 404 there.
  }

  // Prove the key actually works before sealing it — the receiving screen
  // should never end up with a dead key. Debrid keys hit their service's
  // account endpoint; TMDB keys hit TMDB /configuration.
  try {
    let payload: PairingPayload;
    if (service === "tmdb") {
      const v = await validateTmdbKeyServer(apiKey);
      payload = {
        service: "tmdb",
        apiKey,
        username: null,
        premium: false,
        expiresAt: null,
        planName: v.kind === "v4" ? "v4 Read Access Token" : "v3 API key",
        kind: v.kind,
      };
    } else {
      const user = await lookupDebridUser(service, apiKey);
      payload = {
        service,
        apiKey,
        username: user.username,
        premium: user.premium,
        expiresAt: user.expiresAt,
        planName: user.planName ?? null,
      };
    }

    // Opportunistic purge (cheap, and this route runs once per pairing).
    try {
      await db.pairingCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    } catch {
      /* best-effort */
    }

    // Atomic claim: only a still-pending, unexpired row can be sealed.
    const claimed = await db.pairingCode.updateMany({
      where: { code, payloadEnc: null, expiresAt: { gt: new Date() } },
      data: { payloadEnc: sealPairingPayload(code, payload), claimedAt: new Date() },
    });
    if (claimed.count !== 1) {
      const existing = await db.pairingCode.findUnique({ where: { code }, select: { claimedAt: true } });
      if (existing?.claimedAt) {
        return NextResponse.json({ error: "pairing code already used" }, { status: 409 });
      }
      return NextResponse.json({ error: "unknown or expired pairing code" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      username: payload.username,
      planName: payload.planName,
      premium: payload.premium,
      expiresAt: payload.expiresAt,
      ...(payload.kind ? { kind: payload.kind } : {}),
    });
  } catch (e) {
    if (e instanceof UpstreamError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof TmdbKeyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "could not validate the key" }, { status: 502 });
  }
}
