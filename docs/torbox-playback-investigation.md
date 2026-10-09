# TorBox Playback Investigation — HORSE

**Scope**: content resolves and caches on TorBox, but playback inside HORSE fails.
**Method**: repository inspection → official API documentation (live OpenAPI spec +
official Postman collection + official SDKs) → playback-path trace → root-cause
analysis → minimal fix → verification. No assumptions were carried over from
symptoms; every claim below cites a file/line or an external authoritative source.

---

## 1. Existing architecture (as actually implemented)

### 1.1 Request sequence (movie/episode play → video frames)

```
User picks a stream in the picker (picker-overlay.tsx)
  → StreamRow.unlock()                       picker-overlay.tsx
  → useDebrid.resolve(infoHash, filename, filesize)   debrid.ts (client store)
  → POST /api/debrid/resolve { service, apiKey, infoHash, filename, filesize }
  → resolveTorBox()                          api/debrid/resolve/route.ts
       1. torrents/mylist?bypass_cache=true&limit=1000   (reuse by hash)
       2. torrents/createtorrent (multipart magnet)      (when absent)
       3. poll mylist (?id= fast path) until state ∈ {cached, completed}
       4. pickTbFile()  (filename match > video mimetype > largest)
       5. torrents/requestdl?token=…&torrent_id=&file_id=  → { data: "<cdn url>" }
  → { url, filename } returned to the browser
  → onPick({ ...stream, url })               picker-overlay.tsx
  → PlayerOverlay mounts                     player/player-overlay.tsx
       a. video.src = <torbox cdn url>       (direct attach, no crossOrigin attr)
       b. resolveDirectSource(stream, {proxyMode})      playback.ts
            → POST /api/media/probe  (HEAD/GET header sniff, CORS check)
            → no CORS ⇒ signSource() → POST /api/media/sign → /api/media?url=…&sig=…
       c. srcOverride applied ⇒ video re-attaches through the secure proxy
       d. on media error: escalation ladder direct → proxy → (transcode) → error
```

### 1.2 Relevant source files

| File | Role |
| --- | --- |
| `src/components/harbor/views/picker-overlay.tsx` | stream list, `unlock()`, debrid setup dialog |
| `src/lib/harbor/debrid.ts` | client BYO-key store, `resolve()` relay |
| `src/app/api/debrid/resolve/route.ts` | server relay: RD / AD / **TorBox** resolve flows |
| `src/lib/harbor/debrid-server.ts` | shared upstream helpers (`TB_API`, `torboxHeaders`, `fetchJson`, budget) |
| `src/app/api/debrid/user/route.ts` | key validation (`lookupDebridUser` → `torboxUser`) |
| `src/lib/harbor/playback.ts` | stream classifier, `resolveDirectSource`, `signSource`, failure classes |
| `src/components/harbor/player/player-overlay.tsx` | `<video>` attach, probe/auto-proxy, escalation ladder |
| `src/lib/harbor/media-proxy.ts` | HMAC-signed proxy, SSRF guards, `safeUpstreamFetch`, probe cache |
| `src/app/api/media/route.ts` | streaming proxy (Range-forwarding, `maxDuration = 60`) |
| `src/app/api/media/sign/route.ts`, `probe/route.ts`, `capabilities/route.ts` | signing / header sniff / capability bits |

### 1.3 Security model (unchanged, verified)

- TorBox API key lives in `localStorage` client-side only; relayed per request to
  our server routes, never persisted server-side, never logged (`fetchJson`
  errors carry step names only; proxy logs host-only).
- Playback URLs to TorBox are either direct CDN links or signed
  `/api/media?...&sig=…` URLs (HMAC, 2 h TTL). No open proxy: SSRF checks
  (`assertProxyableTarget`), manual redirect chase with per-hop re-validation.

---

## 2. Observed failure

- User selects movie/episode → TorBox source → HORSE submits to TorBox.
- TorBox dashboard shows the torrent **downloaded/cached** (work complete).
- HORSE still refuses to play it — on retry the resolve step returns
  *"TorBox is still downloading this torrent — it keeps working in your TorBox
  account; try again in a few minutes"* (HTTP 504) **indefinitely**, even though
  the file is fully on TorBox.

---

## 3. Root cause (confirmed, with evidence)

### 3.1 PRIMARY — readiness gate accepts only 2 of TorBox's documented post-download states

`resolveTorBox()` polls `torrents/mylist` and breaks only on:

```ts
// api/debrid/resolve/route.ts (before fix)
if (torrent && (torrent.state === "cached" || torrent.state === "completed")) break;
```

TorBox's **official SDK documentation** (`TorBox-App/torbox-sdk-js`,
`src/services/torrents/torrents-service.ts` "Download States", same text in
`torbox-sdk-py` docs) defines the full state machine:

| `download_state` | Official meaning |
| --- | --- |
| `downloading` | currently downloading |
| **`uploading`** | **"The torrent is currently seeding"** — i.e. fully downloaded |
| `stalled (no seeds)` | trying to download, no seeds connected |
| `paused` | paused |
| **`completed`** | "completely downloaded. **Do not use this for download completion status.**" |
| `cached` | cached on server |
| `metaDL` | downloading metadata |
| `checkingResumeData` | checking resumable data |
| *others* | "basic qBittorrent states" (`stalledUP`, `queuedDL`, …) |

Two fatal consequences:

1. A torrent that **finishes downloading** transitions into a **seeding state**
   (`uploading` — or another qBittorrent state such as `stalledUP`). It never
   passes the `{cached, completed}` gate ⇒ every play attempt polls for 35 s and
   returns the honest-but-wrong 504 *"still downloading"*. The user sees the
   torrent sitting fully downloaded in the TorBox dashboard while HORSE never
   plays it — **exactly the reported symptom**.
2. Even `"completed"` is documented as *not* a completion signal; the reliable
   readiness fields on the mylist item are the booleans
   `download_finished`, `download_present`, `cached` and `progress` (0–100) —
   all present in the documented response model
   (`get-torrent-list-ok-response-data.ts`: `download_finished → boolean`,
   `download_present → boolean`, `cached → boolean`, `progress → number`).

Historical note: the original E2E proof (worklog, TorBox provider task) played a
**cached** torrent (`download_state = "cached"` instantly), so the
finished-but-seeding path was never exercised — the bug shipped latent.

### 3.2 SECONDARY (production-only) — auto-proxy pre-emption kills working direct playback on Vercel

After the resolve succeeds, the player first attaches the TorBox CDN URL
**directly** (`video.src = url`, no `crossOrigin` attribute — media elements
play cross-origin without CORS). The `proxyMode: "auto"` flow then probes the
host: **no CORS advertised ⇒ the player force-re-attaches through `/api/media`**
even when direct playback is already delivering frames:

```ts
// player-overlay.tsx (before fix)
const resolved = await resolveDirectSource(stream, { proxyMode: live.proxyMode });
if (resolved.viaProxy) {
  setSrcOverride({ url: resolved.url, mode: "proxy" });   // unconditional switch
}
```

Evidence chain:

- TorBox CDN hosts do not advertise `Access-Control-Allow-Origin`
  (prior local E2E ended with `src=/api/media?url=https://…tb-cdn.pw/…` — the
  probe had classified it "needs proxy").
- `<video>` without `crossOrigin` does not require CORS for progressive
  playback (HTML media element fetches are no-CORS by design).
- `/api/media` declares `export const maxDuration = 60` (route comment:
  "serverless-host friendly cap"). A sustained video stream proxied through a
  Vercel function is terminated at 60 s; locally the same code path is
  unlimited, which is why the sandbox E2E passed while production fails.

Net effect on production: even with 3.1 fixed, a **working direct stream is
replaced by a serverless pipe that dies at ≤60 s**, surfacing as
stall/error mid-playback. The escalation ladder would then try "proxy" again
(already tried) → transcode (disabled on serverless) → final error.

### 3.3 Verified NON-causes (checked, ruled out)

- **API endpoints/params**: `mylist` (`bypass_cache`, `id`, `limit` — incl. the
  "single object when id-filtered" quirk), `createtorrent` (multipart form,
  `data.torrent_id`), `requestdl` (`token` in query + Bearer, integer ids,
  `data: "<url>"` string) all match the live OpenAPI spec + official Postman
  collection (`api-docs.torbox.app/api/collections/29572726/2s9YXo1zX4`).
- **IP-lock**: `requestdl.user_ip` is documented as "The user's IP to determine
  the **closest CDN**. Optional." — it is a CDN-affinity hint, not an
  authorization lock; links are not IP-bound.
- **Link lifetime**: requestdl "opens the link for 3 hours for downloads; once a
  download is started, the user has nearly unlimited time" — not the failure.
- **Redirect handling**: both the browser (`<video>` follows redirects) and the
  proxy (`safeUpstreamFetch` manual chase + per-hop SSRF re-validation + Range
  forwarding) handle TorBox's redirecting links.
- **File selection**: `pickTbFile` uses real `files[].id` values from the API
  (filename match > video mimetype > largest) — matches the documented model.
- **Vercel serverless running torrents**: nothing torrents server-side; TorBox
  does the transfer. (Only the proxy's 60 s cap matters — see 3.2.)
- **CORS on our API**: same-origin relays; browser never calls TorBox's API.

---

## 4. Fix implemented (minimal, targeted)

### 4.1 `src/app/api/debrid/resolve/route.ts` — honest readiness gate

- `parseTbTorrent()` now carries the documented readiness booleans:
  `downloadFinished`, `downloadPresent`, `cached`, `progress`.
- Ready ⇔ `download_state === "cached"` **or** `download_finished === true`
  **or** (`download_present === true` and `progress ≥ 100`) **or** raw
  `cached === true`. (`"completed"` retained harmlessly; seeding states and
  qBittorrent states now pass correctly.)
- Error path unchanged (`download_state === "error"` → 502).
- Robustness: if the torrent reads ready but the **id-filtered** response
  carries no `files`, one full-list fetch re-fetches the files before giving up
  (guards the documented object-vs-array `id` quirk from ever surfacing as
  "no playable file").

### 4.2 `src/components/harbor/player/player-overlay.tsx` — don't kill working direct streams

In the `proxyMode: "auto"` effect, the probe's proxy override is now applied
**only when direct playback is not demonstrably working**:

- skip the override if the element already errored (the escalation ladder owns
  the recovery), or
- skip it if the element is already rendering media
  (`readyState >= HTMLMediaElement.HAVE_CURRENT_DATA`).

Hosts that genuinely cannot play direct stay at `readyState < 2` when the probe
returns, so they are proxied exactly as before (no behavior change); hosts that
play direct — TorBox CDN included — keep their direct stream, with full HTTP
Range seeking straight against the CDN, and are never pushed into the 60 s
serverless pipe.

### 4.3 `src/components/harbor/views/picker-overlay.tsx` — TorBox in the inline debrid dialog

The picker's "Connect debrid" dialog offered only Real-Debrid/AllDebrid, so a
TorBox user hitting a torrent row without a connected key could not complete the
Torrentio→TorBox flow in place. TorBox is added as a third service option
(consistent with the Settings card: first tab, key URL, placeholder).

---

## 5. Evidence for the diagnosis (verification artifacts)

| Check | Result |
| --- | --- |
| Live OpenAPI spec `https://api.torbox.app/openapi.json` (v1.0.0) | requestdl params `token/torrent_id/file_id/zip_link/user_ip/redirect/append_name`; mylist params + `download_state`/files model — implementation matched except the state gate |
| Official Postman collection (requestdl) | "opens the link for 3 hours…"; permalink pattern `redirect=true`; `user_ip` = closest-CDN hint; error envelope shapes |
| Official SDK (`torbox-sdk-js`) Download States | `"uploading"` = seeding; `"completed"` = "Do not use this for download completion status" |
| Git history | resolve route unchanged since the original E2E (`5e00299`) — failure is environmental/data-shaped, not a regression edit |
| Worklog prior E2E | cached-torrent instant path verified playing; finished-torrent path never tested → latent gate bug |
| `GET /api/media/capabilities` (local) | `{transcode:false, torrent:"builtin", debrid:true}` — ladder on serverless = direct → proxy → error |
| `POST /api/debrid/user` torbox+bogus key (live) | HTTP 401 `Invalid TorBox API key` — relay + auth handling verified against the real API |
| `POST /api/debrid/resolve` torbox+bogus key (live) | HTTP 401 `Invalid TorBox API key` — flow reaches TorBox and fails honestly |

---

## 6. Testing performed (and limits)

- `bun run lint` — 0 errors (warnings at pre-existing baseline).
- Live relay checks against the real TorBox API with an intentionally invalid
  key (401 honesty path) — see §5.
- Readiness-gate truth table exercised against the documented state machine
  (cached / completed / uploading / stalledUP / downloading / metaDL /
  checkingResumeData / paused / error) via a standalone verification script run
  against the actual route logic (verification tooling, not repo runtime code).
- Browser E2E of the player fix: a direct MP4 source on a CORS-less host stays
  attached directly (`<video>.src` unchanged, no `/api/media` re-attach), and a
  source that fails direct still escalates to the proxy ladder (behavior
  preserved).
- **Not verified (requires credentials we do not hold)**: real end-to-end
  playback through a real TorBox account (the previous session's key was
  deliberately cleared from the browser during cleanup, and no credentials may
  be fabricated). The full user path — resolve → requestdl → CDN play — is
  verified only up to the honest-401 boundary plus the documented-behavior
  simulation above.

---

## 7. Remaining limitations & recommendations

1. **Production streaming cap**: `/api/media` (`maxDuration = 60`) remains a
   ceiling for any stream that *does* need the serverless proxy on Vercel. With
   4.2 most streams avoid it; hosts that require proxy headers still cannot be
   sustained by serverless functions. A long-term fix is a dedicated media
   backend (documented in the route comment) — out of scope here by design.
2. **`user_ip` CDN affinity** (optional requestdl param) could be forwarded to
   pick a CDN near the *viewer* rather than near the server. Deliberately not
   added: it sends the viewer's IP to TorBox and the current links stream fine.
3. **TorBox Stream API** (`/v1/api/stream/createstream`, HLS + transcode
   metadata) exists but is plan-restricted (`PLAN_RESTRICTED_FEATURE`) and would
   replace a working mechanism — not used, per the minimal-change mandate.
4. **Free-plan queue**: when the single active slot is busy, createtorrent
   queues the item (visible under "Queued"); the 504 honest message covers it.
   A future "My TorBox torrents" view could surface queue state in-app.
