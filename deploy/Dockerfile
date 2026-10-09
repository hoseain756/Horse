# Harbor Web / Horse — self-hosted torrent engine
# BitTorrent streaming engine (webtorrent) + ffmpeg codec probe / remux.
#
#   docker build -f deploy/Dockerfile -t horse-engine .
#   docker run -d --name horse-engine -p 3031:3031 \
#     -e ENGINE_API_KEY="$(openssl rand -hex 24)" \
#     horse-engine
#
# The app (Vercel or anywhere) reaches it via:
#   ENGINE_URL=https://engine.yourdomain        (JSON relay, server-side)
#   ENGINE_PUBLIC_URL=https://engine.yourdomain (media, browser-direct)
#   ENGINE_API_KEY=<same secret as here>        (Bearer + HMAC media tokens)
FROM node:22-bookworm-slim

# ffmpeg/ffprobe: codec probe + progressive remux (mkv/h264/aac -> fMP4).
# python3/make/g++: fallback build toolchain for webtorrent's optional native
# deps (node-datachannel, utp-native) when no prebuilt binary matches.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /engine

# Install deps first for layer caching (bun.lock is optional for npm).
COPY mini-services/torrent-service/package.json ./
COPY mini-services/torrent-service/bun.lock* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY mini-services/torrent-service/index.mjs ./

# Bind all interfaces inside the container; publish via -p / PaaS routing.
ENV NODE_ENV=production \
    ENGINE_HOST=0.0.0.0 \
    ENGINE_PORT=3031
EXPOSE 3031

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.ENGINE_PORT||'3031')+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.mjs"]
