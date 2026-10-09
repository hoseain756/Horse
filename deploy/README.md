# Self-hosting the torrent engine (fixes P2P playback on Vercel)

The web app runs on Vercel **serverless functions**, and a BitTorrent engine
cannot run there (no long-lived process, no public TCP sockets, no torrent
egress guarantees). That is why torrent streams play in the sandbox preview
(engine runs alongside the app) but are honestly refused on `horse-1.vercel.app`.

There are exactly two ways to enable torrent playback on the Vercel deployment:

| Option | Cost | Effort | Result |
| --- | --- | --- | --- |
| **Debrid key** (Settings → Integrations → Debrid) | provider subscription (Real-Debrid ≈ €3/16 days, AllDebrid similar) | ~2 minutes | cached torrents unlock **instantly** as direct HTTPS streams; nothing to host |
| **Self-hosted engine** (this guide) | any always-on box (small VPS ≈ $4–5/mo, or a paid PaaS instance) | ~10 minutes | **all** torrents stream via P2P + on-the-fly remux, like the sandbox preview |

Both work with the same player, picker, subtitles and Continue-Watching flows.
They also compose: with both configured, debrid is tried first (instant for
cached torrents) and the engine is the fallback.

---

## Architecture (what runs where)

```
Browser ── app pages/API ──────────────► Vercel (serverless)
   │                                        │
   │  JSON: /api/engine/* (relay,           │ JSON relay w/ Bearer key
   │  ENGINE_API_KEY stays server-side)  ───┘──► Engine (this package)
   │                                              webtorrent + ffmpeg
   └── media: /stream/:key/:file, /remux/... ◄────┘ (browser → engine DIRECT,
        short-lived HMAC token ?k=exp.sig — a movie is never piped through a
        serverless function)
```

- The engine is the file `mini-services/torrent-service/index.mjs`
  (endpoints: `/health`, `/prepare`, `/status/:key`, `/stream/:key/:fileIdx`,
  `/remux/:key/:fileIdx`, `/codec/:key`, `/remove/:key`, `/cleanup`).
- JSON calls are relayed through the app's `/api/engine/[...path]` route
  (allowlisted paths, Bearer attached server-side, SSRF-safe: the host comes
  only from `ENGINE_URL`).
- Media bytes go **browser → engine directly** using `ENGINE_PUBLIC_URL` with
  a 15-minute HMAC token minted by `/api/engine/token`. The engine host must
  therefore be **publicly reachable over HTTPS** (or same-domain behind your
  reverse proxy).

---

## Option A — Docker on any VPS (recommended)

Works on any $4–5/mo box (Hetzner CX11, Oracle free tier, home server with a
tunnel, …). Requires Docker.

```bash
git clone https://github.com/hoseain756/Horse && cd Horse/deploy

# 1. pick a long random secret — you will reuse it in Vercel
echo "ENGINE_API_KEY=$(openssl rand -hex 24)" > .env

# 2. build + run (cache volume survives restarts)
docker compose up -d

# 3. verify locally
curl -s localhost:3031/health
```

### Put it behind HTTPS

The **browser** fetches media from this host, so it needs a trusted origin
(mixed content: an `http://` engine on an `https://` app is blocked).

Easiest is Caddy (automatic Let's Encrypt) on the same box:

```caddy
# /etc/caddy/Caddyfile
engine.example.com {
    reverse_proxy 127.0.0.1:3031
}
```

```bash
sudo systemctl reload caddy   # DNS A record must point at the box first
curl -s https://engine.example.com/health
```

(nginx + certbot works the same: `proxy_pass http://127.0.0.1:3031;`)

---

## Option B — Render.com (PaaS, no VPS needed)

A Blueprint is included (`deploy/render.yaml`):

1. Push this repo to GitHub (already done: `hoseain756/Horse`).
2. On Render: **New + → Blueprint** → select the repo → **Apply** — Render
   builds `deploy/Dockerfile`, attaches a 5 GB cache disk and generates
   `ENGINE_API_KEY` for you.
3. Copy the service URL (`https://horse-engine-xxxx.onrender.com`) and the
   generated API key (service → Environment).

> ⚠️ Free Render web services sleep after 15 idle minutes and would abort
> mid-movie. Use an always-on plan. Same caveat applies to Railway/Koyeb
> free tiers — for real usage prefer Option A on a small VPS.

---

## Wire it into the Vercel deployment

Vercel dashboard → your project → **Settings → Environment Variables** (all
environments), then **Redeploy**:

| Variable | Value | Notes |
| --- | --- | --- |
| `ENGINE_URL` | `https://engine.example.com` | server-side JSON relay target |
| `ENGINE_PUBLIC_URL` | `https://engine.example.com` | browser-direct media; only needed if it differs from `ENGINE_URL` |
| `ENGINE_API_KEY` | the **same** secret from the engine | ≥16 chars; never sent to the browser — media uses short-lived HMAC tokens instead |

### Verify

1. `https://horse-1.vercel.app/api/media/capabilities` → `"torrent":"external"`.
2. In the app: **Settings → Integrations → P2P Torrent Engine** → status chip
   shows *External engine*, press **Test engine** → green
   "Engine reachable".
3. Play any torrent stream → the picker resolves through the engine
   (`Joining the torrent swarm…` → playback).

### Troubleshooting

| Symptom | Meaning | Fix |
| --- | --- | --- |
| Test says "ENGINE_URL is not set" | relay returns 404 | env var missing on Vercel → set + redeploy |
| Test says "unreachable" | relay returns 502/504 | engine process down, wrong `ENGINE_URL`, or TLS not trusted |
| Test says "key mismatch" (401) | `ENGINE_API_KEY` differs | copy the exact same value to both sides |
| Player error mentions token/401 on media only | browser token rejected | clocks skewed >15 min between app and engine host; or `ENGINE_PUBLIC_URL` ≠ actual public origin (scheme/host mismatch) |
| Playback stalls at 0 peers | swarm dead or host network blocks BitTorrent egress | try a seeded torrent; open outbound TCP/UDP; debrid key as fallback |
| `.mkv` plays but no audio/video | codec not browser-playable and remux off | ensure `ffmpeg` exists in the image (it does here); enable `TRANSCODE_ENABLED=true` only for HEVC sources (CPU-heavy) |

---

## Security notes

- **Always set `ENGINE_API_KEY`** on a public host. With a key set, the engine
  answers `/health` with minimal data to unauthenticated callers and refuses
  everything else without a valid `Bearer` key or HMAC media token.
- The key lives in Vercel env vars and the engine env only — never in the
  repo, never in the browser.
- Do **not** expose the engine to arbitrary CORS clients; it is for your app.
  If you must restrict further, allow-list the app origin in your reverse
  proxy.
- The engine keeps pieces in a temp cache dir (`/tmp/harbor-web-torrent-cache`)
  and destroys idle torrents after 45 min; wipe anytime with
  `POST /cleanup {"purge":true}` (the app's P2P card exposes both buttons).
