# Task 88-b — NoorApi (website-free API layer)

- **Agent**: Z.ai Code (NoorApi subagent)
- **Date**: 2026-10 (Task 88 series)
- **Project**: /home/z/Noor/mobile_app (Flutter, package `noor_mobile`)
- **Deliverable**: `lib/core/api/noor_api.dart` (single new file; no other file touched)

## Task

Create the complete website-free API layer replacing `lib/core/api/horse_api.dart`
(which proxied everything through https://horse-silk.vercel.app — being deleted).
Implement the EXACT `NoorApi` public surface other agents code against, embed
operator key VALUES from /tmp/noor-keys.env as static const defaults, keep the
old file's storage patterns (SharedPreferences for prefs, FlutterSecureStorage
for secrets, dio transport), and end the file with `typedef HorseApi = NoorApi;`
for compile compatibility with un-migrated call sites.

## Work Log

1. Read `/home/z/my-project/worklog.md` Task 88 section (architecture decision:
   NoorApi direct providers + embedded keys + BYO-override; auth/pairing deleted).
2. Read old `horse_api.dart` end-to-end for style/patterns; noted legacy secure
   keys worth migrating (`horse.mobile.tmdb.user-key`,
   `horse.mobile.iptv.playlists`).
3. Read `/tmp/noor-keys.env`: TMDB v4 JWT, OMDb `b978cd59`, MDBList,
   Trakt client_id, Simkl id+secret, TRAKT secret EMPTY (by design).
4. Implemented the full contract in one file (~900 lines), organized as:
   - **Lifecycle**: `initialize()` (prefs, dio, secure overrides + legacy tmdb
     fallback), `dispose()`, lazy `_client` getter so pre-initialize calls work.
   - **Passthrough**: `proxyGet`/`proxyText` — direct dio GET with optional
     headers (replaces website /api/proxy + /api/proxy/raw).
   - **TMDB**: `tmdbGet` with dual credential handling (v4 'eyJ' → Bearer
     header; otherwise → `api_key=` query param), `validateTmdbUserKey` (live
     /configuration), `saveTmdbUserKey` (validate→write secure
     `noor.tmdb.user-token`), `clearTmdbUserKey`, `hasUserTmdbKey`.
   - **Ratings**: `ratingsGet` — never throws, all 6 provider keys always
     present (`imdb`, `rottenTomatoes`, `metacritic`, `tmdb`, `trakt`,
     `mdblist` → `{rating, votes}|null`). OMDb single call covers IMDb/RT/MC;
     TMDB via own `tmdbGet` (imdb find → search fallback; anime skips year
     filter; details call when /find payload lacks vote_average); Trakt public
     ratings via title slug; MDBList `/tmdb/{movie|show}/{id}` only when tmdbId
     known. 6h TTL cache + inflight dedupe.
   - **AniList**: `anilistPost` → graphql.anilist.co.
   - **Debrid**: `verifyDebridKey` (RD/AD/TorBox → normalized `{name,
     expires?}`, handles premiumUntil epoch + TorBox Go-zero-time), `saveDebridKey`/`clearDebridKey`
     (prefs `noor.debrid.service` + secure `noor.debrid.<service>`),
     `resolveDebridTorrent` → DIRECT URL or null with per-service flows (RD:
     instantAvailable→addTorrent→info→file pick→links/unlock; AD:
     magnet/upload→~20s status poll→link pick→link/unlock; TorBox:
     createtorrent→mylist search retry→requestdl). `debridTorrentFiles`
     explicitly skipped per contract.
   - **Linked services**: `startLinkedService`/`pollLinkedService` direct
     device flows (Trakt `{'error':'secret_required'}` without user secret —
     secret key re-read live at poll time; Simkl pending via 400 body),
     `unlinkService`, `isLinked`, `syncLinkedService` (trakt watchlist/history
     → `{type, imdb, title, year, watchedAt?}`; simkl watchlist + history with
     /sync/all-events fallback, deduped), `scrobbleLinkedService`
     (fire-and-forget, never throws).
   - **IPTV**: secure storage `noor.iptv.playlists` (+ legacy read fallback),
     delete-when-empty like the old API.
5. Verification: `dart analyze lib/core/api/noor_api.dart` → **No issues
   found!** (2 doc-comment HTML lints fixed along the way). Whole-app analyze
   and `pub get` intentionally NOT run (parallel agents active; deps resolved).
6. Appended Task 88-b section to `/home/z/my-project/worklog.md`.

## Stage Summary

- `NoorApi` fully replaces the website API surface: proxy, tmdb, ratings,
  anilist, debrid verify/resolve, trakt/simkl device flow + sync + scrobble,
  IPTV playlists — all DIRECT to providers with embedded operator keys.
- Migration-safe: legacy keys `horse.mobile.tmdb.user-key` /
  `horse.mobile.iptv.playlists` still read; `typedef HorseApi = NoorApi` keeps
  current call sites compiling until parallel agents migrate them.
- Trakt secret is user-provisioned (secure `noor.trakt.client-secret`), no
  embedded value; everything else has an embedded default.
- Next: parallel agents migrate call sites (app_state, settings, integrations,
  catalog_repository, live_tv, video_player_page) to the new signatures, then
  delete `horse_api.dart`.
