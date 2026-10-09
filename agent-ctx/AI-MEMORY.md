# HORSE — AI Memory (persistent session context)

> Purpose: restore full AI working context in one read. Keep this file updated after
> every completed phase. Last updated: Task 68 SAVEPOINT (commit 62d6ee6, pushed).

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
  large-screen-hero-corrections.md).

## 1. Where we are (SAVEPOINT, Task 68)

- **Round 26 large-screen correction pass: COMPLETE + pushed.** Commit `3a54130` (code) and
  `62d6ee6` (savepoint worklog). Local == origin/main == pushed.
- All 13 defects fixed with measured before/after evidence (see `docs/large-screen-hero-corrections.md`):
  - A1 side rail → ONE compact auto-hide glass capsule (edge hot-zone 24dp reveal, 80ms
    intent, 700ms/600ms hide grace, Esc immediate, tooltips replace expanded menu,
    settings `railAutoHide`, Settings→Basics control). NO expanded mode anymore.
  - A2 hero prev/next arrows DELETED (component+CSS+tokens+i18n). Nav = wheel (horizontal
    intent, 450ms lock), drag (>8px suppresses click), segments, up-next cards, keyboard.
  - A3 synopsis `line-clamp: 2` everywhere ≥1024.
  - A4 bottom-anchored flow `[logo][meta][synopsis][actions][segments]`; gaps 12/20/24dp,
    hero pad-bottom clamp(28px,4svh,32px); segments in-flow, hit ≥44dp.
  - B1 bidi: `dir="auto"`/`<bdi>` on all dynamic text; ellipses land logically.
  - B2 capsule stadium fixed (overflow hidden; moot after A1).
  - B3 ONE search, viewport-centered, frozen geometry per band (--fs-geo-w 520/720),
    contrast ≥4.5:1 (measured 11.1:1), "/" chip ≥20dp.
  - B4 constant `--side-safe-inset` (rail 80+24; laptop +40, TV +56) → zero column drift.
  - B5 logo box 320×110 laptop / 480×160 TV; shape classification (square/round ≥72dp min).
  - B6 adaptive scrim per-artwork (64×36 canvas sample of text zone, cached per failKey,
    gated ≥1024/wide).
  - B7 up-next: 12px label, 13px 2-line titles, 2:3 thumbs (52×78), measured count
    (3 <620px hero else 4), first card "next" affordance, inside hero bounds.
  - B8 hero height clamp(420px,62svh,680px) laptop / clamp(460px,66svh,760px) TV.
  - B9 secondary labels ≥12px @62% ink.
- **FROZEN RULE (non-negotiable): phone <600dp + tablet 600–1023dp design (incl. bottom
  nav) must stay pixel-identical.** Every CSS change must be value-identical <1024 or
  scoped ≥1024. Verified via DOM assertions + git-diff audit + qa-shots before/after
  360/412/768/820.
- Earlier milestones: TorBox playback fix (Task 66, commit 8a6f110 — readiness gate honors
  download_finished/download_present/cached booleans; player keeps working direct streams,
  bounded 2.5s proxy grace); Round 25 adaptive layout (side rail, large hero, TV search).

## 2. Environment quirks & recovery rituals

- **Sandbox reset ritual** (after any env rollback): `git remote add origin` + fetch +
  `git reset --hard origin/main` (GitHub = source of truth) → `bun install` at root →
  `bun install` in mini-services/torrent-service (native binaries) → recreate
  `~/.gh-autopush.sh` → restart dev + engine.
- **Turbopack stale CSS**: after globals.css edits, if changes don't show → `pkill next dev`,
  `rm -rf .next`, restart `bun run dev`.
- **OOM (4GB cgroup)**: sharp+Turbopack+Chrome together → use `UV_THREADPOOL_SIZE=2
  VIPS_CONCURRENCY=1`, heap cap, warm-before-browser cycles (`/tmp/qa-cycle.sh` pattern).
- **Push credentials**: `~/.git-credentials` (outside repo, chmod 600) + credential.helper
  store. Auto-push watcher `~/.gh-autopush.sh` (60s loop): check `pgrep -f gh-autopush`,
  relaunch `(setsid bash ~/.gh-autopush.sh </dev/null >/dev/null 2>&1 &)`. NEVER put tokens
  in the repo.
- **Engine health**: `curl localhost:3031/health`. Runs plain `node index.mjs` (bun --hot
  crashes webtorrent).
- QA URLs: test app at `http://localhost:3000/` directly (port 3000 bypasses Caddy gateway
  for engine routes; gateway path is `?XTransformPort=`).

## 3. Next steps (priority order)

1. **Production smoke test** on horse-1.vercel.app after Round 26 build: auto-hide rail,
   arrowless hero, adaptive scrim, viewport-centered search, RTL both locales.
2. **Repeatable Playwright geometry spec** in `scripts/` (port Task 67 assertions:
   bbox non-intersection, segment/action gap ≥16dp stable, inset constant, synopsis ≤2
   lines, hidden-rail pointer-events none, contrast sampling, no h-overflow/console errors).
3. **TorBox "my torrents" management view** (carried over).
4. **Kids Mode parent-PIN gate** (carried over).
5. **Pre-existing tsc errors cleanup**: auth/mail.ts, horse-account.ts, skills/*,
   examples/*, qa addon bun-types (untouched-by-design files).
6. Deferred/known limit: `/api/media` maxDuration=60 caps proxy-REQUIRED streams on
   Vercel (documented in route comment; long-term = dedicated media backend).

## 4. Key file map (large-screen surfaces)

- `src/components/harbor/chrome/side-rail.tsx` — the auto-hide rail (Task 67 rewrite).
- `src/components/harbor/views/home-hero.tsx` — hero engine (~1200+ ln): bottom-anchored
  column, wheel/drag nav, adaptive scrim, up-next strip, segments.
- `src/components/harbor/chrome/floating-search.tsx` — the ONE search component (+TV
  fullscreen ≥1600).
- `src/components/harbor/chrome/glass-dock.tsx` — bottom dock (<1024 only; phone/tablet
  FROZEN).
- `globals.css` — tokens: `--side-safe-inset`, `--rail-*`, `--hero-*`, `--fs-geo-w`,
  `--fs-anchor-start`, `--home-scale` ladder, `.harbor-page-container`, band blocks.
- `settings.ts` — `railAutoHide` (migrated from old `railExpanded`).
- `i18n` resources (ar/en) — removed prevSlide/nextSlide; added localized search
  placeholder/aria.
- `worklog.md` — the authoritative chronological handover (Task IDs up to 68).
- `agent-ctx/` — per-task agent handover notes + THIS memory file.

## 5. Hard rules

- Phone (<600dp) and tablet (600–1023dp): DO NOT TOUCH. Laptop 1024–1599, TV ≥1600 free.
- Fix root causes, verify by measurement, never blind-patch.
- No "..." / TODO in delivered code; full files only.
- Keep glass design language, tokens, code style, directory structure.
- No business-logic/API changes in design passes.
- `bun run lint` must stay 0 errors (161 pre-existing warnings are style-only).
