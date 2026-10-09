#!/usr/bin/env bash
# ============================================================
#  Horse torrent engine - one-time installer for Linux.
#  Run it once in a terminal:   bash ~/Downloads/install-linux.sh
#  1. downloads the engine (github.com/hoseain756/Horse)
#  2. installs it to ~/.local/share/horse-engine
#  3. registers the horse-engine:// handler (xdg), so the
#     website's "Start engine" button works with ONE click.
#  Safe to run again later (it refreshes the installation).
# ============================================================
set -euo pipefail

command -v node >/dev/null 2>&1 || {
  echo "[installer] Node.js is not installed - install it (e.g. sudo apt install nodejs npm) then run this again."
  exit 1
}

ENG="$HOME/.local/share/horse-engine"
ZIP=/tmp/horse-main.zip
EX=/tmp/horse-main-extract
APPS="$HOME/.local/share/applications"

echo "[installer] Downloading the engine..."
curl -fL --retry 2 -o "$ZIP" https://github.com/hoseain756/Horse/archive/refs/heads/main.zip
rm -rf "$EX" "$ENG.old"
[ -d "$ENG" ] && mv "$ENG" "$ENG.old"
mkdir -p "$EX" "$ENG" "$APPS"
unzip -q -o "$ZIP" -d "$EX"
cp -a "$EX/Horse-main/mini-services/torrent-service/." "$ENG/"
rm -rf "$EX" "$ZIP" "$ENG.old"

echo "[installer] Installing dependencies (first run only, may take a minute)..."
cd "$ENG"
[ -d node_modules ] || npm install

echo "[installer] Registering the one-click trigger (horse-engine://)..."
cat > "$ENG/engine-run.sh" <<'EOS'
#!/usr/bin/env bash
cd "$(dirname "$0")"
if ! node -e "fetch('http://127.0.0.1:3031/health').then(r=>process.exit(0)).catch(()=>process.exit(1))"; then
  nohup npm start >/dev/null 2>&1 &
fi
EOS
chmod +x "$ENG/engine-run.sh"

cat > "$APPS/horse-engine.desktop" <<EOX
[Desktop Entry]
Type=Application
Name=Horse Engine
NoDisplay=true
Exec="$ENG/engine-run.sh"
MimeType=x-scheme-handler/horse-engine;
EOX
if command -v xdg-mime >/dev/null 2>&1; then
  xdg-mime default horse-engine.desktop x-scheme-handler/horse-engine || true
fi

echo "[installer] Starting the engine..."
"$ENG/engine-run.sh"

echo ""
echo "[installer] DONE."
echo "[installer] Back in the website: Settings -> Integrations -> P2P"
echo "[installer] press \"Save & test\" (or the one-click Start button)."
