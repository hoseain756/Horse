#!/usr/bin/env bash
# Horse torrent engine — one-click launcher (Linux)
# Run in a terminal:  ./start-engine.sh
# Docs: deploy/HOSTING-FREE.md and mini-services/torrent-service/README.md
set -u
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[start-engine] Node.js is not installed."
  echo "  Linux:  sudo apt install nodejs npm   (or your distro's equivalent)"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[start-engine] First run — installing dependencies (one time)..."
  npm install || { echo "[start-engine] npm install failed — check your internet connection and try again."; exit 1; }
fi

echo "[start-engine] Starting the engine on http://localhost:3031 ..."
echo "[start-engine] Keep this window open while watching. Press Ctrl+C to stop."
exec npm start
