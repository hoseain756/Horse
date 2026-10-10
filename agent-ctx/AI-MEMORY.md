# HORSE — AI Memory (persistent session context)

> Purpose: restore full AI working context in one read. Keep this file updated after
> every completed phase. Last updated: Task 71 SAVEPOINT (HEAD == origin/main == 7215eec,
> push credentials RESTORED via device flow + credential.helper store).

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

## 1. Where we are (SAVEPOINT, Task 71 — after container restart)

- **ALL WORK IS SAFE ON GITHUB**: local main == origin/main == `7215eec`. The autopush
  watcher saved Tasks 69+70 before the sandbox container restarted (2026-10-10 08:37);
  the Task 71 savepoint docs commit was pushed after the user re-granted push access
  (device flow AUTH_OK 08:56, credential.helper store re-configured — the file alone
  is NOT enough, the helper config was the missing piece; watcher PUSH_OK 08:57).
- **Task 69 (user directives T1/T2/T3) — COMPLETE.**
  - T1: side rail floats over content in BOTH states (main padding-inline-start 0; zero
    shift verified by DOM measurement).
  - T2: search = true glass (shared recipe `rgba(255,255,255,.07)` + blur(12) saturate(1.35)),
    auto-hides at top ≥1024, 48×5dp peek handle top-center, hover-intent 80ms / leave 700ms,
    "/" reveals+focus, Esc hides; 768 frozen (peek display:none).
  - T3: unified player Audio panel — group 1 = current stream tracks (P2P remux report →
    HLS renditions → native audioTracks), group 2 = "Dubbing sources" (every other addon
    stream, candidatesRef reuse else one fetchStreams sweep, cap 40, dubTagOf chips); switch
    = direct instant / debrid / P2P prepare→bounded poll→plan, all resume at current seconds.
    `dub.ts` detects dub language from stream title. E2E with real multi-dub addon still
    open (proxy SSRF guard blocks localhost QA addons — by design, do NOT weaken).
- **Task 70 (Settings redesign, brief "اعد التصميم ابي تصميم جديد 100/100") — COMPLETE.**
  - NEW design system: `src/components/harbor/settings/design.tsx` (SettingRow/ToggleRow/
    SectionCard/SegmentedControl/SettingSliderRow/SelectRow/TextFieldRow/ColorRow/ActionRow/
    DangerActionRow/PreviewCard) + `shell.tsx` (SettingsShell).
  - IA: 9 categories (account/appearance/playback/subtitles/integrations/addons/kids/data/
    about). Two-pane ≥840 (list clamp 280-320dp), drill-down <840, TV ≥1600 ten-foot.
  - Deep links `#settings/<cat>[/<key>]` + 2.4s arrival highlight + settings search (ar/en
    synonyms) + Kids PIN gate (`parent-pin.ts`: salted SHA-256, 5-min grant, never synced).
  - 6 dead settings wired (posterScale/posterRadius→CSS vars, showCardBadges/hidePosterTitles
    →meta-card gates, subFontColor/subBorderColor/subStyle→subtitle layer, customPlaybackSpeeds
    →speed menu, resumePrompt→ask-before-resume, streamSort→picker sort).
  - +152 i18n keys. Fixed real bug: sanitizeSettings validated bare-hex vs ColorRow #RRGGBB.
  - Audit: `bun run audit:ui` (scripts/audit-ui.ts) 13 widths × 2 langs × 2 themes × 2
    text scales = **104/104 PASS**; supports `--quick`, `--shots`, `--widths=` chunking
    (background runs get reaped — run in foreground chunks).
- Earlier milestones: Round 26 large-screen corrections (Task 67, 13 defects, docs/
  large-screen-hero-corrections.md); TorBox playback gate (Task 66, 8a6f110).

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
- **Sandbox reaps long background processes** (setsid watchdogs, background audits) —
  chunk long jobs into foreground runs (audit `--widths=` chunking).
- **Engine health**: `curl localhost:3031/health`. Runs plain `node index.mjs` (bun --hot
  crashes webtorrent). NOTE: after container restart the torrent engine is also dead —
  restart if playback QA needed.
- QA URLs: test app at `http://localhost:3000/` directly (port 3000 bypasses Caddy gateway
  for engine routes; gateway path is `?XTransformPort=`).

## 3. Next steps (priority order)

1. **Vercel production smoke** on horse-1.vercel.app: Settings redesign live check
   (9 categories, deep link, PIN gate), auto-hide rail, arrowless hero, dub audio panel.
2. **T3 E2E** with a reachable multi-dub addon (public URL; SSRF guard blocks localhost).
3. TorBox "my torrents" management view (carried over).
4. Orphan-key tombstones in sanitizeSettings (aiEnabled/soundTheme/wrappedButton/
   profileId/tmdbKey) — documented in audit F2.
5. Pre-existing tsc errors cleanup (auth/mail.ts, horse-account.ts, skills/*, examples/*).

## 4. Key file map

- Large-screen: `chrome/side-rail.tsx` (auto-hide rail), `views/home-hero.tsx` (hero
  engine), `chrome/floating-search.tsx` (ONE search + auto-hide), `chrome/glass-dock.tsx`
  (<1024 FROZEN), globals.css tokens (`--side-safe-inset`, `--rail-*`, `--hero-*`,
  `--fs-geo-w`, `--fs-anchor-start`, `--home-scale`, settings token block).
- Settings: `components/harbor/settings/design.tsx` + `shell.tsx` + `settings-view.tsx`
  (9 categories) + `lib/harbor/parent-pin.ts` + `lib/harbor/settings.ts`.
- Player audio: `components/harbor/player/player-overlay.tsx` (unified Audio panel) +
  `lib/harbor/dub.ts` (dub language detection).
- Audit: `scripts/audit-ui.ts` + `qa-shots/audit-report.tsv` (cumulative).
- `worklog.md` — authoritative chronological handover (Tasks up to 70-final).
- `agent-ctx/` — per-task handover notes + THIS memory file.

## 5. Hard rules

- Phone (<600dp) and tablet (600–1023dp): DO NOT TOUCH. Laptop 1024–1599, TV ≥1600 free.
- Fix root causes, verify by measurement, never blind-patch.
- No "..." / TODO in delivered code; full files only.
- Keep glass design language, tokens, code style, directory structure.
- No business-logic/API changes in design passes.
- `bun run lint` must stay 0 errors (~157 pre-existing warnings are style-only).
- Never weaken the /api/proxy SSRF guard for QA; use public URLs for test addons.
- Tokens/credentials NEVER enter the repo, worklog, or chat output.
