# HORSE — AI Memory (persistent session context)

> Purpose: restore full AI working context in one read. Keep this file updated after
> every completed phase. Last updated: Task 74 SAVEPOINT (HEAD == origin/main == e0f927b,
> push credentials RESTORED via device flow #2 (8822-3F25, AUTH_OK 12:34:56) +
> credential.helper store; post-restore smoke: health 17 tables, qr/pairing/transfer creates OK).

## 0. Identity

- Project: **Horse** (`/home/z/my-project`) — web port of the Stremio-addon protocol client
  (originally "Harbor Web" codebase; UI brand = HORSE). GitHub: `hoseain756/Horse` (main),
  deployed on Vercel → **horse-1.vercel.app** (auto-deploy on push).
- Stack: Next.js 16 App Router + TypeScript + Tailwind 4 + shadcn/ui (New York) + Prisma/SQLite
  + zustand + TanStack Query. Dev: `bun run dev` (port 3000). Mini-service:
  `mini-services/torrent-service` (`node index.mjs`, :3031, `/health`).
- User language: Arabic (RTL primary) + English. Design language: glassmorphism,
  M3 easing, design tokens in `globals.css`.
- Docs deliverables live in `docs/` (torbox-playback-investigation.md,
  large-screen-hero-corrections.md, settings-redesign/01-audit-and-ia.md).

## 1. Where we are (SAVEPOINT, Task 74 — after container restart #3)

- **ALL WORK IS SAFE ON GITHUB**: local main == origin/main == `e0f927b`. Third container
  restart wiped $HOME again; push restored via device flow #2 (user code 8822-3F25,
  AUTH_OK 12:34:56, poll.sh PUSH_OK e0f927b). Post-restore smoke GREEN: /api/health
  17 tables; /api/auth/qr/create OK; /api/pairing/create {service:tmdb} pinned OK;
  /api/transfer/create valid-payload OK. Cron webDevReview recreated (job 449295).
- **Task 69 (T1/T2/T3) — COMPLETE**: floating side rail (zero shift), glass auto-hide
  search + peek handle, unified player Audio panel (stream tracks + dub sources,
  `dub.ts`). T3 E2E with real multi-dub addon still open (SSRF guard blocks localhost
  QA addons — by design, do NOT weaken).
- **Task 70 (Settings redesign) — COMPLETE**: `settings/design.tsx` + `shell.tsx`,
  9 categories, deep links `#settings/<cat>[/<key>]`, Kids PIN gate (`parent-pin.ts`,
  salted SHA-256, 5-min grant, NEVER synced), +152 i18n keys, `bun run audit:ui`
  104/104 PASS (supports --quick/--shots/--widths= chunking; foreground only).
- **Task 72 (QR sign-in + addon transfer) — COMPLETE, browser-verified**:
  - Prisma models QrLogin + TransferCode (migration 20261010120000).
  - `/api/auth/qr/{create,peek,approve,deny,status}` (5-min TTL, pollToken sha256-hashed,
    status mints REAL DB session via createSession then deletes row) +
    `/api/transfer/{create,claim,cancel}` (6-min TTL, sealed payload, atomic single-use).
  - `chrome/qr-login.tsx` (3rd tab in signed-out account card + QrApproveDialog +
    openQrApprove + QR_APPROVE_EVENT, reuses merge-strategy dialog),
    `chrome/addon-transfer.tsx` (sender/receiver dialogs, non-destructive
    manifest.id-dedupe merge + tombstone clearing), `chrome/code-input.tsx`
    (formatCodeGroups + CodeInput + CodeCountdown). app-shell hash consumers
    `#qrlogin=` and `#transfer=`. 45 i18n keys.
  - Account login carries ALL keys via the existing cloud-sync snapshot handoff
    (settings/addons/watchlist/history/cw/themes/lists); Kids PIN never synced.
- **Task 73 (per-service debrid QR + mobile integrations fixes) — COMPLETE**:
  - PairingCode.pinnedService (migration 20261010150000); pairing/create accepts
    {service}; status `?peek=1` NON-CONSUMING (phone peek can't steal handover);
    claim 409 on pinned mismatch BEFORE upstream validation.
  - `device-pairing.tsx`: DevicePairingCard({service}) per-tab sender + shared
    PairingSenderCard + global PairingReceiverHost in app-shell (#pair= from any view).
  - Mobile fixes: all 12 dialog callers → `sm:max-w-*` (16px margins on phones);
    toast.tsx bottom/end/safe-area/dock-clearing viewport + always-tappable close;
    integration toasts translated (+18 i18n keys, +3 ar-dict); receiver service-default
    race + bidi mangling fixed (desc data-no-ar, code in input only).
- **Task 73b (TMDB linking via QR/XXX-XXX) — COMPLETE, E2E verified**: pairing service
  "tmdb" (PairingService union), validateTmdbKeyServer (live TMDB /configuration proof),
  TmdbPairingCard inside tmdb-card.tsx; phone locks to TMDB, one-tap send of saved
  tmdbUserKey; kind "v3"|"v4" sealed + relayed. Committed 089b72d.
- Earlier milestones: Round 26 large-screen corrections (Task 67); TorBox playback gate
  (Task 66, 8a6f110).

## 2. Environment quirks & recovery rituals

- **CONTAINER RESTART WIPES $HOME** (happened 2026-10-10): loses ~/.git-credentials,
  ~/.gh-autopush.sh, ~/.ghflow. Repo and .env survive (project dir persisted).
  Recovery ritual (all verified this round):
  1. Dev server: `(setsid bun run dev </dev/null >> dev.log 2>&1 &)` from /home/z/my-project
     (plain nohup+& gets REAPPED; setsid survives). Verify `curl localhost:3000` → 200.
  2. Autopush watcher: recreate `~/.gh-autopush.sh` (60s loop, GIT_TERMINAL_PROMPT=0,
     state ~/.gh-autopush.state, log ~/.gh-autopush.log, only pushes when local SHA
     changed AND creds exist; does NOT update state on failure → retries). Arm:
     `(setsid bash ~/.gh-autopush.sh </dev/null >/dev/null 2>&1 &)`.
  3. Push credentials: GitHub OAuth DEVICE FLOW — POST /login/device/code with public
     GitHub CLI client_id `178c6fc778ccc68e1d6a` scope=repo → give user
     https://github.com/login/device + user_code (15-min window) → poller
     `~/ghflow/poll.sh` (setsid, 230×5s, slow_down-aware) stores `https://hoseain756:<t>@github.com`
     in ~/.git-credentials (chmod 600) + pushes + logs ~/ghflow/flow.log. Token NEVER
     printed to chat. Secrets live OUTSIDE the repo.
  4. If git working tree shows mass `old mode 100644/new mode 100755` noise →
     `git checkout -- .` (environmental chmod flip; only real deltas matter).
- **Turbopack stale CSS**: after globals.css edits, if changes don't show → `pkill next dev`,
  `rm -rf .next`, restart `bun run dev`.
- **OOM (4GB cgroup)**: sharp+Turbopack+Chrome together → use `UV_THREADPOOL_SIZE=2
  VIPS_CONCURRENCY=1`, warm-before-browser cycles (`/tmp/qa-cycle.sh` pattern).
- **Embedded local Postgres** (127.0.0.1:5433, data in /tmp → WIPED on restart):
  `bash .zscripts/local-pg.sh && bunx prisma db push`, then RESTART dev (stale prisma
  client in the running process 502s new columns). local-pg.sh SELF-HEALS ICU 60
  (sandbox image ships ICU 76; initdb needs libicuuc.so.60 → script downloads+
  extracts Ubuntu-bionic libicu60 to /tmp/icu60 + LD_LIBRARY_PATH; re-runs after wipe).
- **Sandbox chmod noise**: new image flips all files 755 → `git config core.fileMode
  false` already set (keep after $HOME wipes; it lives in .git/config so it SURVIVES,
  but verify with `git config core.fileMode`).
- **Sandbox reaps long background processes** (setsid watchdogs, background audits) —
  chunk long jobs into foreground runs (audit `--widths=` chunking).
- **Engine health**: `curl localhost:3031/health`. Runs plain `node index.mjs` (bun --hot
  crashes webtorrent). NOTE: after container restart the torrent engine is also dead —
  restart if playback QA needed.
- QA URLs: test app at `http://localhost:3000/` directly (port 3000 bypasses Caddy gateway
  for engine routes; gateway path is `?XTransformPort=`).

## 3. Next steps (priority order)

1. **PROD SCHEMA BACKPORT (BLOCKS ALL PROD QR FEATURES)**: production Supabase lacks
   QrLogin + TransferCode tables and PairingCode.pinnedService column. Apply
   prisma/migrations/20261010120000_add_qr_login_and_transfer_codes/migration.sql +
   prisma/migrations/20261010150000_add_pairing_pinned_service/migration.sql
   (migrate deploy with prod DATABASE_URL — sandbox has NO prod creds, ask user —
   or Supabase SQL editor). Then prod smoke: QR login, transfer, per-service debrid
   QR, TMDB linking on horse-1.vercel.app.
2. **T3 E2E** with a reachable multi-dub addon (public URL; SSRF guard blocks localhost).
3. TorBox "my torrents" management view (carried over).
4. Orphan-key tombstones in sanitizeSettings (aiEnabled/soundTheme/wrappedButton/
   profileId/tmdbKey) — documented in audit F2.
5. F5 literal-string i18n sweep (ThemePanel/Trakt/Simkl/Debrid/About).
6. Pre-existing tsc errors cleanup (auth/mail.ts, horse-account.ts, skills/*, examples/*,
   mini-services/*) — 14 known, 0 new.
7. Polish: "1 addon(s)" English plural in transferSuccess toasts.

## 4. Key file map

- Large-screen: `chrome/side-rail.tsx` (auto-hide rail), `views/home-hero.tsx` (hero
  engine), `chrome/floating-search.tsx` (ONE search + auto-hide), `chrome/glass-dock.tsx`
  (<1024 FROZEN), globals.css tokens (`--side-safe-inset`, `--rail-*`, `--hero-*`,
  `--fs-geo-w`, `--fs-anchor-start`, `--home-scale`, settings token block).
- Settings: `components/harbor/settings/design.tsx` + `shell.tsx` + `settings-view.tsx`
  (9 categories) + `lib/harbor/parent-pin.ts` + `lib/harbor/settings.ts`.
- Player audio: `components/harbor/player/player-overlay.tsx` (unified Audio panel) +
  `lib/harbor/dub.ts` (dub language detection).
- QR/pairing/transfer: `chrome/{qr-login,addon-transfer,code-input,device-pairing}.tsx`,
  `lib/harbor/{qr-login-server,transfer-server,pairing-server,tmdb-server}.ts`,
  routes `/api/auth/qr/*`, `/api/transfer/*`, `/api/pairing/*`, `/api/tmdb/*`.
- Audit: `scripts/audit-ui.ts` + `qa-shots/audit-report.tsv` (cumulative).
- `worklog.md` — authoritative chronological handover (Tasks up to 74).
- `agent-ctx/` — per-task handover notes + THIS memory file.

## 5. Hard rules

- **MANDATORY SKILL (permanent user directive, Task 76): `frontend-design`** — read
  `skills/frontend-design/SKILL.md` and apply it BEFORE any UI/frontend work
  (components, pages, views, styling, animations, polish passes). Apply it WITHIN the
  project's established glass design language (do NOT swap the design system): commit
  to intentional aesthetics — distinctive typography, atmosphere/depth in backgrounds,
  orchestrated motion (staggered reveals, high-impact moments), meticulous spatial
  detail; never generic "AI slop" patterns or timid palettes.
- Phone (<600dp) and tablet (600–1023dp): DO NOT TOUCH. Laptop 1024–1599, TV ≥1600 free.
- Fix root causes, verify by measurement, never blind-patch.
- No "..." / TODO in delivered code; full files only.
- Keep glass design language, tokens, code style, directory structure.
- No business-logic/API changes in design passes.
- `bun run lint` must stay 0 errors (~157 pre-existing warnings are style-only).
- Never weaken the /api/proxy SSRF guard for QA; use public URLs for test addons.
- Tokens/credentials NEVER enter the repo, worklog, or chat output.
