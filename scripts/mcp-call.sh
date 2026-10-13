#!/usr/bin/env bash
# Call an AppMap MCP tool over stdio (newline-delimited JSON-RPC 2.0).
#
# Usage:
#   mcp-call.sh <tool-name> [tool-args-json] [-- extra server args...]
#
# Examples:
#   scripts/mcp-call.sh list_labels
#   scripts/mcp-call.sh find_recordings '{"limit":5}'
#   scripts/mcp-call.sh find_recordings '{}' -- query mcp --appmap-dir gold_traces/baseline/appmaps --query-db tmp/gold_traces_query.db
set -euo pipefail
TOOL="${1:?usage: mcp-call.sh <tool> [args-json] [-- server args...]}"
shift || true
ARGS='{}'
if [ $# -gt 0 ] && [ "$1" != "--" ]; then ARGS="$1"; shift || true; fi
if [ "${1:-}" = "--" ]; then shift; fi
SERVER_ARGS=("$@")
if [ ${#SERVER_ARGS[@]} -eq 0 ]; then SERVER_ARGS=(query mcp); fi
cd /home/z/my-project
PAYLOAD=$(printf '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"%s","arguments":%s}}' "$TOOL" "$ARGS")
{
  printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"sandbox","version":"1.0"}}}'
  printf '%s\n' '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  printf '%s\n' "$PAYLOAD"
  sleep 5
} | /home/z/.appmap/bin/appmap "${SERVER_ARGS[@]}" 2>/dev/null | python3 -c '
import json,sys
for line in sys.stdin:
    line=line.strip()
    if not line: continue
    m=json.loads(line)
    if m.get("id")==2:
        r=m["result"]
        print(r["content"][0]["text"])
'
