# Task 72-b — Backend: QR login + addon transfer codes (handover record)

Agent: full-stack-developer · Date: 2026-10-10 · Status: COMPLETE (uncommitted on disk per brief)

## What was built

### QR login (`/api/auth/qr/*` + `QrLogin` table)
- TV asks `POST /api/auth/qr/create` (no auth, 8/min/IP) → `{code, displayCode "XXX-XXX", pollToken (32B b64url, SECRET), deviceHint, expiresAt(ms), ttlMs 300000}`. Only sha256(pollToken) is stored (`pollHash`).
- Phone (logged in) `POST /api/auth/qr/peek {code}` (30/min, 401 `{error:"auth required"}` without session) → `{ok:true, deviceHint, expiresAt}` | `{ok:false, reason:"missing"|"used"}` (200s, not 404s).
- Phone `POST /api/auth/qr/approve {code}` (15/min, session) → `{ok:true, deviceHint}`; race-safe guarded `updateMany` flip waiting→approved(+userId, approvedAt).
- Phone `POST /api/auth/qr/deny {code}` (15/min, session) → idempotent `{ok:true}`; row → "denied" so TV sees the denial.
- TV polls `POST /api/auth/qr/status {pollToken}` (120/min, NO auth) → `waiting {status, expiresAt}` / `denied` (row swept) / `expired` / **approved** → loads HorseUser, mints a real DB session via `createSession(uid, req, res, {remember:true})` on the SAME response (login-route pattern) + `audit("qr_login")` + deletes row (single-use). User payload: `{email, username, displayName, createdAt(ISO), emailVerified}`.

### Addon transfer (`/api/transfer/*` + `TransferCode` table)
- `POST /api/transfer/create {addons[1..60], senderHint?}` (8/min) seals `{v:1, addons, senderHint?}` AES-256-GCM AAD `transfer:<code>` → `{code, displayCode "XXX-XXX-XXX", expiresAt(ms), ttlMs 360000}`.
- `POST /api/transfer/claim {code}` (15/min) — atomic `updateMany` (claimedAt null + not expired + payloadEnc not null). Lose → `{ok:false, reason:"missing"|"already"}`. Win → open payload (fail ⇒ delete row + "missing", no detail leak), wipe payloadEnc, respond `{ok:true, addons[{transportUrl, enabled, order, manifest{...}}], count, senderHint}`. **Inert row is kept until expiry** so re-claim answers "already" (brief's own smoke gate; see deviation note in worklog).
- `POST /api/transfer/cancel {code}` (30/min) → idempotent `{ok:true}`.
- Addon schema: transportUrl url-ish (any scheme, no whitespace, 8..2048), enabled default true, order int ≥0, manifest looseObject with required non-empty `id`/`name` (extra fields preserved).

## Key files
- NEW: `src/lib/harbor/qr-login-server.ts`, `src/lib/harbor/transfer-server.ts`, `src/app/api/auth/qr/{create,peek,approve,deny,status}/route.ts`, `src/app/api/transfer/{create,claim,cancel}/route.ts`, `.zscripts/local-pg.sh`
- MODIFIED: `prisma/schema.prisma` (+QrLogin, +TransferCode), `src/lib/harbor/pairing-server.ts` (only `export` added to CODE_ALPHABET), `package.json` (+`db:push` script), `.env` (gitignored local PG URLs)

## ENVIRONMENT (critical for next rounds)
- Sandbox DB was BROKEN (all DB routes 500: "POSTGRES_URL is not set" — Supabase creds absent). Fixed with **embedded local Postgres 18.4** (SSL, scram, 127.0.0.1:5433, db `horse`), provisioned by `bash .zscripts/local-pg.sh` (idempotent; bin cache in /tmp/pgsetup). After any **container restart**: run that script → `bunx prisma db push` → restart dev server. Next dev hot-reloads `.env` (watch out).
- `/api/health` reports `mode:"postgres-pooler", host:"127.0.0.1:5433", tables:17` when healthy.

## Gates (all green)
- `bun run db:push` sync OK · tsc: 14 pre-existing errors elsewhere, 0 in new files · lint: 0 errors / 157 pre-existing warnings, targeted eslint on new files: clean
- Full curl smoke incl. **real session E2E** (throwaway user, since deleted): TV cookie from QR actually authenticates (`/api/auth/me` → authenticated:true); single-use + rate-limit 429s verified. No secrets printed (pollToken masked).
- NOT committed (brief forbids); production still needs a real migration for the 2 new tables (migrations folder off-limits per brief — `db:push` against Supabase or a new migration later).
