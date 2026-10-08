# Task 7-a — Simkl integration (full-stack-developer)

## Status: COMPLETE (all verification passed)

## What was built
Simkl.tv integration for Harbor Web, mirroring the Trakt integration pattern exactly:
BYO client_id (+ optional client_secret), PIN-based OAuth (simkl.com/pin), import
watchlist, import history, disconnect. Metadata/tracking only.

## Files created
- src/lib/harbor/simkl-server.ts — server relay helpers (SIMKL_API, guard 20/min/IP, validClientId/validClientSecret /^[A-Za-z0-9_-]{8,64}$/, simklFetch with 15s timeout + simkl-api-key header + 412/401/pinPoll mapping, normalizeWatchlist cap 500, normalizeHistory cap 250 fully defensive)
- src/lib/harbor/simkl.ts — zustand useSimkl store (key "harbor-web.simkl", connect/pollOnce 5s-aware/cancel/disconnect/importWatchlist/importHistory; pendingCreds module var so polling has credentials before authorization)
- src/app/api/simkl/pin/route.ts — POST {clientId} → PIN create (relays /oauth/pin)
- src/app/api/simkl/pin/poll/route.ts — POST {clientId, clientSecret?, deviceCode} → token poll (pinPoll mode: 401 error body relayed verbatim)
- src/app/api/simkl/user/route.ts — POST {clientId, accessToken} → {username} from /users/settings (user.name)
- src/app/api/simkl/watchlist/route.ts — POST → GET /sync/watchlist/?extended=full → {items}
- src/app/api/simkl/history/route.ts — POST → GET /sync/history/ → {items}

## Files modified (additive only)
- src/components/harbor/views/settings-view.tsx — SimklCard function (copy of TraktCard structure: same card classes, TvMinimalPlay chip, Client ID + optional secret form, PIN code display, connected state with Import watchlist/history + counts + Disconnect, simkl.com/apps/new privacy note); <SimklCard /> wired between TraktCard and DebridCard; added TvMinimalPlay lucide import + useSimkl import. TraktCard/DebridCard untouched.

## API contracts
- POST /api/simkl/pin {clientId} → {device_code, user_code, verification_url, expires_in, interval} | {error}
- POST /api/simkl/pin/poll {clientId, clientSecret?, deviceCode} → {access_token} | 401 pending envelope | {error}
- POST /api/simkl/user {clientId, accessToken} → {username} | {error}
- POST /api/simkl/watchlist | /api/simkl/history {clientId, accessToken} → {items} | {error}
- Simkl upstream specifics: header `simkl-api-key: <client_id>` on every call; 412 error envelope mapped to {error: message} ("Your client_id is wrong. Try another one"); poll pending = 401 with error body (non-definitive text treated as pending client-side)

## Verification
- bun run lint: 0 errors 0 warnings
- bunx tsc --noEmit | grep "^src/": empty (src type-clean)
- curl: pin invalid-test → 412 mapped upstream message (upstream genuinely reached from sandbox); pin {} → 400; watchlist short id → 400; user/history short token → 401; malformed JSON → 400; poll without deviceCode → 400; watchlist with valid-format fake id+token → upstream 412 relayed; dev.log: zero 5xx from any /api/simkl/* route
- agent-browser: Integrations shows Trakt.tv → Simkl → Debrid with identical card classes; fake-id Connect shows the clean upstream error inline; console 0 errors/warnings; screenshot download/qa-r7-simkl-card.png

## Honest limits / flags
- Real PIN OAuth end-to-end needs a user's own Simkl client id (sandbox has none) — error/validation paths verified live, pending/authorized paths code-verified only
- Simkl returns 412 for any endpoint when the client id is unknown, so the 401 "token expired or revoked" mapping is only reachable with a valid id
- Watchlist entries without imdb id fall back to id `simkl:<simklId>` (import into Library but not resolvable to Stremio meta — same honesty as trakt:<slug>)
- FLAG for orchestrator: trakt.ts pollOnce reads auth?.clientId which is null during a FIRST-time device flow (auth only set after authorization) → fresh Trakt connects likely 400 "invalid client credentials". simkl.ts avoids this via pendingCreds; Trakt needs the same pattern (not my file, untouched).
- Infra note: sandbox dev server was OOM-killed twice during QA (pre-existing issue, dmesg-confirmed; also stale dev chunks in a long-lived browser session made SimklCard look missing). Fresh browser session (agent-browser close --all) resolved it — not an app bug.
