# torrent-service — Horse's BitTorrent streaming engine

Server-side BitTorrent engine (webtorrent v3 + ffmpeg): takes an infoHash from
a stream addon, joins the swarm, picks the right video file, and serves it over
HTTP with Range support so the browser can stream while downloading. MKV/AVI/TS
containers are remuxed on the fly to fMP4 by ffmpeg (HEVC video can even be
transcoded to H.264 when `TRANSCODE_ENABLED=1`).

## Run it on your own computer (free — no server, no debrid)

This is the free path for the Vercel deployment (Settings → Integrations → P2P
→ "Engine on this device" in the app). Requires **Node 18+** and **ffmpeg**.

### One click from the website (after a one-time install)

The app can start the engine for you. In Settings → Integrations → P2P →
**"Engine on this device"**:

1. Press **Download installer (once)** — you get the installer for YOUR OS
   (`install-windows.bat` / `install-mac.command` / `install-linux.sh`,
   served from `public/engine/` in the repo).
2. Run it once. It downloads the engine to a fixed location, installs
   dependencies, registers the **`horse-engine://`** trigger
   (Windows registry / macOS app-bundle URL scheme / xdg .desktop) and
   starts the engine.
   - Windows: double-click the downloaded `.bat`.
   - macOS / Linux: `bash ~/Downloads/install-…`
3. Back in the website press **Start engine** — it fires
   `horse-engine://start` (starts the engine if not already running),
   then probes and saves the config automatically.

Consoles/TVs (Xbox, PlayStation, smart TVs) can never install or run the
engine — their browsers are sealed. They play in-app via debrid, or via an
engine on another home device reached over HTTPS.

### Easiest: one-click launchers (no terminal skills needed)

| OS | Double-click this file in this folder |
| --- | --- |
| Windows | `start-engine.bat` |
| macOS | `start-engine.command` |
| Linux | `start-engine.sh` |

The launcher installs dependencies on first run and starts the engine on
`http://localhost:3031`. Keep its window open while watching. (ffmpeg still
needs to be installed once for MKV remuxing — commands below.)

### Manual launch

```bash
# 0. install ffmpeg (once)
#    Windows:  winget install Gyan.FFmpeg        (then reopen the terminal)
#    macOS:    brew install ffmpeg
#    Linux:    sudo apt install ffmpeg

# 1. get the engine
git clone https://github.com/hoseain756/Horse.git
cd Horse/mini-services/torrent-service

# 2. run (first run downloads dependencies)
npm install
npm start
# → [torrent-service] listening on http://127.0.0.1:3031
```

Then, in Horse (even the vercel.app deployment): **Settings → Integrations →
P2P → Engine on this device** → address `http://localhost:3031` → **Save &
test**. The browser talks to your engine directly; keep the terminal open
while you watch. The setting is stored on that device only (localStorage).

Optional hardening: start it with a shared secret and enter the same key in
the app (`ENGINE_API_KEY=some-long-secret npm start`).

Environment variables (all optional): `ENGINE_PORT` (default 3031),
`ENGINE_HOST` (default `127.0.0.1` — use `0.0.0.0` only on trusted networks),
`ENGINE_API_KEY` (shared secret), `TRANSCODE_ENABLED` (HEVC → H.264
transcoding; CPU-heavy), `PORT` (fallback for ENGINE_PORT).

## Docker / PaaS

See [deploy/README.md](../../deploy/README.md) for the always-on server
options (Docker, docker compose, Render blueprint) and the Vercel env vars
(`ENGINE_URL`, `ENGINE_PUBLIC_URL`, `ENGINE_API_KEY`).

For a **$0 always-on** host (Oracle Cloud Always Free step-by-step +
Cloudflare Tunnel HTTPS), see [deploy/HOSTING-FREE.md](../../deploy/HOSTING-FREE.md)
— and for why the engine can never run on Vercel functions itself, read the
three documented walls at the top of that guide.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | status; active torrents (only when authenticated) |
| POST | `/prepare` | join swarm `{ infoHash, fileIdx?, filename? }` → 200 ready / 202 pending |
| GET | `/status/:key` | progress, peers, speed |
| GET | `/stream/:key/:fileIdx` | native file stream (Range-capable) |
| GET | `/remux/:key/:fileIdx` | ffmpeg progressive fMP4 (`?vtrans=h264`, `?ss=`, `?audio=`) |
| GET | `/codec/:key?file=` | ffprobe report (container/codec/audio tracks) |
| POST | `/remove/:key` | destroy one torrent |
| POST | `/cleanup` | destroy all (`{ "purge": true }` wipes cache) |

Auth (when `ENGINE_API_KEY` is set): `Authorization: Bearer <key>`,
`?key=<key>` (browser-direct local mode), or `?k=<exp>.<sig>` HMAC token
(server-relayed external mode). `/health` stays probe-able but hides
internals when unauthenticated.
