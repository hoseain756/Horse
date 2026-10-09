#!/usr/bin/env bash
# ============================================================
#  Horse torrent engine - one-time installer for macOS.
#  Run it once from Terminal:   bash ~/Downloads/install-mac.command
#  1. downloads the engine (github.com/hoseain756/Horse)
#  2. installs it to ~/.horse-engine
#  3. creates "Horse Engine.app" and registers the horse-engine://
#     trigger, so the website's "Start engine" button works with
#     ONE click afterwards.
#  Safe to run again later (it refreshes the installation).
# ============================================================
set -euo pipefail

command -v node >/dev/null 2>&1 || {
  echo "[installer] Node.js is not installed - get the LTS from https://nodejs.org then run this again."
  exit 1
}

ENG="$HOME/.horse-engine"
APP="$HOME/Applications/Horse Engine.app"
ZIP=/tmp/horse-main.zip
EX=/tmp/horse-main-extract

echo "[installer] Downloading the engine..."
curl -fL --retry 2 -o "$ZIP" https://github.com/hoseain756/Horse/archive/refs/heads/main.zip
rm -rf "$EX" "$ENG.old"
[ -d "$ENG" ] && mv "$ENG" "$ENG.old"
unzip -q -o "$ZIP" -d "$EX"
mv "$EX/Horse-main/mini-services/torrent-service" "$ENG"
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

mkdir -p "$HOME/Applications" "$APP/Contents/MacOS"
cat > "$APP/Contents/Info.plist" <<'EOX'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Horse Engine</string>
  <key>CFBundleDisplayName</key><string>Horse Engine</string>
  <key>CFBundleIdentifier</key><string>app.horse.engine</string>
  <key>CFBundleExecutable</key><string>HorseEngine</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleURLTypes</key><array><dict>
    <key>CFBundleURLName</key><string>app.horse.engine.start</string>
    <key>CFBundleURLSchemes</key><array><string>horse-engine</string></array>
  </dict></array>
</dict></plist>
EOX
cat > "$APP/Contents/MacOS/HorseEngine" <<'EOS'
#!/usr/bin/env bash
"$HOME/.horse-engine/engine-run.sh"
exit 0
EOS
chmod +x "$APP/Contents/MacOS/HorseEngine"

echo "[installer] Starting the engine..."
"$ENG/engine-run.sh"
open "$APP" >/dev/null 2>&1 || true

echo ""
echo "[installer] DONE."
echo "[installer] Back in the website: Settings -> Integrations -> P2P"
echo "[installer] press \"Save & test\" (or the one-click Start button)."
