import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Trakt OAuth relay — the bridge between the browser callback and the app.
 *
 * Flow (RFC 7636 PKCE, per developer.trakt.tv/docs/pkce — no client secret
 * exists for this app): the Noor app opens auth.trakt.tv/oauth/authorize
 * with an S256 code_challenge and its own random `state`; the user approves;
 * Trakt redirects the BROWSER to the registered HTTPS redirect URI (this
 * site's root) with `?code&state`; the root page POSTs the pair here; the
 * app polls GET /api/trakt/relay?state=… and finishes the code+verifier
 * exchange against Trakt itself — the code_verifier never leaves the app,
 * so a code intercepted anywhere in this hop is useless to an attacker.
 *
 * Storage: short-lived in-memory registry mirrored to db/trakt-relay.json so
 * a dev-server restart mid-flow does not strand the code. Entries expire
 * after 15 minutes (matching the app-side pending-flow TTL).
 */

type RelayEntry = { code: string; state: string; createdAt: number };

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 200;

const g = globalThis as unknown as { __traktRelay?: Map<string, RelayEntry> };
const registry: Map<string, RelayEntry> =
  (g.__traktRelay ??= new Map<string, RelayEntry>());

const FILE = path.join(process.cwd(), "db", "trakt-relay.json");

function prune(): void {
  const now = Date.now();
  for (const [key, entry] of registry) {
    if (now - entry.createdAt > TTL_MS) registry.delete(key);
  }
}

/** Restores entries persisted before a restart (best-effort). */
async function restoreFromFile(): Promise<void> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    for (const [key, value] of Object.entries(
      parsed as Record<string, RelayEntry>,
    )) {
      if (
        value &&
        typeof value.code === "string" &&
        typeof value.state === "string" &&
        typeof value.createdAt === "number" &&
        !registry.has(key)
      ) {
        registry.set(key, value);
      }
    }
  } catch {
    // First run or unreadable file — the in-memory registry is the truth.
  }
}

async function persistToFile(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(Object.fromEntries(registry)));
  } catch {
    // Best-effort persistence; a lost file only costs one retry of the flow.
  }
}

function safeToken(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 512
    ? value
    : null;
}

/** Browser callback landing: stores {state, code} for the app to pick up. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }
  const record = (body ?? {}) as Record<string, unknown>;
  const state = safeToken(record.state);
  const code = safeToken(record.code);
  if (!state || !code) {
    return NextResponse.json(
      { ok: false, error: "missing_state_or_code" },
      { status: 400 },
    );
  }
  prune();
  registry.set(state, { code, state, createdAt: Date.now() });
  while (registry.size > MAX_ENTRIES) {
    const oldest = registry.keys().next();
    if (oldest.done) break;
    registry.delete(oldest.value);
  }
  await persistToFile();
  return NextResponse.json({ ok: true });
}

/** App poll — or, with `&code=`, a browser push fallback for proxies that
 * drop cross-origin-looking POSTs. Pushing via GET puts the auth code in the
 * URL, but PKCE keeps it harmless: the code is single-use, expires in
 * minutes, and is worthless without the code_verifier that never leaves the
 * app. POST stays the primary path, so this only runs when POST failed. */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  if (!state || state.length > 512) {
    return NextResponse.json(
      { ok: false, error: "missing_state" },
      { status: 400 },
    );
  }
  const rawCode = params.get("code");
  if (rawCode !== null) {
    const code = safeToken(rawCode);
    if (!code) {
      return NextResponse.json(
        { ok: false, error: "missing_state_or_code" },
        { status: 400 },
      );
    }
    prune();
    registry.set(state, { code, state, createdAt: Date.now() });
    while (registry.size > MAX_ENTRIES) {
      const oldest = registry.keys().next();
      if (oldest.done) break;
      registry.delete(oldest.value);
    }
    await persistToFile();
    return NextResponse.json({ ok: true });
  }
  prune();
  if (!registry.has(state)) await restoreFromFile();
  const entry = registry.get(state);
  if (!entry) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, state: entry.state, code: entry.code });
}

/** Cleanup hook (cancel flows / tests). */
export async function DELETE(request: NextRequest) {
  const state = new URL(request.url).searchParams.get("state");
  if (!state) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  registry.delete(state);
  await persistToFile();
  return NextResponse.json({ ok: true });
}
