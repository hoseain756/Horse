#!/usr/bin/env bash
# Reinstall the AppMap MCP stack after a sandbox HOME wipe.
# 1. npm CLI, 2. ${userHome}/.appmap/bin/appmap symlink (as mcp.json expects), 3. query indexes.
set -euo pipefail
command -v appmap >/dev/null || npm install -g @appland/appmap
mkdir -p "$HOME/.appmap/bin"
ln -sf "$(command -v appmap)" "$HOME/.appmap/bin/appmap"
cd "$(dirname "$0")/.."
"$HOME/.appmap/bin/appmap" index || true
"$HOME/.appmap/bin/appmap" index --appmap-dir gold_traces/baseline/appmaps --query-db tmp/gold_traces_query.db || true
echo "appmap mcp ready: $(appmap --version) at $HOME/.appmap/bin/appmap"
