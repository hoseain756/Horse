#!/usr/bin/env bash
# Horse — re-provision the SANDBOX-LOCAL Postgres used when no Supabase URL
# exists in this environment (dev-only; production keeps Supabase).
#
# Why: src/lib/db.ts + prisma/schema.prisma are Postgres-only (Supabase
# contract). The sandbox has no Postgres server and no POSTGRES_URL, so every
# DB-backed API route 500s. This script boots an embedded PostgreSQL
# (embedded-postgres npm binaries) on 127.0.0.1:5433 with self-signed SSL,
# creates the `horse` DB, and writes the POSTGRES_URL / POSTGRES_URL_NON_POOLING
# lines into .env (gitignored — credentials never enter the repo).
#
# Usage:  bash .zscripts/local-pg.sh        (idempotent — safe to re-run)
# After:  cd /home/z/my-project && bunx prisma db push && restart dev server
set -euo pipefail

PORT=5433
ROOT=/tmp/horse-pg
SETUP=/tmp/pgsetup
DATA="$ROOT/data"
ICU=/tmp/icu60

# 0. ICU 60 shared libs — the embedded-postgres binaries link libicuuc.so.60
#    but modern sandbox images ship ICU 7x only. Extract the Ubuntu bionic
#    libicu60 deb next to the binaries and prepend it to LD_LIBRARY_PATH for
#    every postgres invocation below (wiped on container restart — re-fetched).
if [[ ! -f "$ICU/usr/lib/x86_64-linux-gnu/libicuuc.so.60" ]]; then
  mkdir -p "$ICU" && cd "$ICU"
  curl -sL -o icu.deb "http://archive.ubuntu.com/ubuntu/pool/main/i/icu/libicu60_60.2-3ubuntu3.2_amd64.deb"
  ar x icu.deb && tar xf data.tar.* 2>/dev/null || tar xf data.tar.zst 2>/dev/null
  cd /home/z/my-project
fi
export LD_LIBRARY_PATH="$ICU/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"

# 1. Binaries (wiped on container restart — re-download in ~1s via bun).
if [[ ! -x "$SETUP/node_modules/@embedded-postgres/linux-x64/native/bin/initdb" ]]; then
  mkdir -p "$SETUP"
  cd "$SETUP"
  [[ -f package.json ]] || bun init -y >/dev/null
  bun add embedded-postgres@latest >/dev/null
fi
BIN="$SETUP/node_modules/@embedded-postgres/linux-x64/native/bin"

# 2. Already running? Then just make sure .env points at it.
if "$BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
  echo "[local-pg] already running on :$PORT"
else
  rm -rf "$ROOT"
  mkdir -p "$ROOT"
  PW="$(openssl rand -hex 16)"
  printf '%s\n' "$PW" > "$ROOT/pwfile"
  "$BIN/initdb" -D "$DATA" -U horse -A scram-sha-256 --pwfile="$ROOT/pwfile" >/dev/null
  openssl req -new -x509 -days 3650 -nodes -subj "/CN=localhost" \
    -keyout "$DATA/server.key" -out "$DATA/server.crt" >/dev/null 2>&1
  chmod 600 "$DATA/server.key"
  {
    printf "\nlisten_addresses = '127.0.0.1'\nport = %s\nssl = on\n" "$PORT"
    printf "ssl_cert_file = '%s/server.crt'\n" "$DATA"
    printf "ssl_key_file = '%s/server.key'\n" "$DATA"
  } >> "$DATA/postgresql.conf"
  ( setsid "$BIN/pg_ctl" -D "$DATA" -l "$ROOT/pg.log" -o "-p $PORT" start </dev/null >/dev/null 2>&1 & )
  for _ in $(seq 1 20); do
    "$BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1 && break
    sleep 1
  done
  cd /home/z/my-project
  bun -e "import('pg').then(async ({Client}) => { const c = new Client({host:'127.0.0.1',port:$PORT,user:'horse',password:'$PW',database:'postgres',ssl:{rejectUnauthorized:false}}); await c.connect(); await c.query('CREATE DATABASE horse').catch(e => { if (!/already exists/.test(e.message)) throw e; }); await c.end(); })"
  echo "[local-pg] started postgres on 127.0.0.1:$PORT"
fi

# 3. Point .env at it (idempotent — replace previous local lines if present).
cd /home/z/my-project
sed -i '/^# Local sandbox Postgres/,+2d; /^POSTGRES_URL=/d; /^POSTGRES_URL_NON_POOLING=/d' .env
if grep -q "POSTGRES_URL=" .env 2>/dev/null; then
  echo "[local-pg] .env already has POSTGRES_URL lines — kept"
else
  PW2="$(cat "$ROOT/pwfile" 2>/dev/null || echo horse-local-pw)"
  {
    printf '\n# Local sandbox Postgres (embedded, SSL, 127.0.0.1:%s) — sandbox-only, not for prod\n' "$PORT"
    printf 'POSTGRES_URL="postgresql://horse:%s@127.0.0.1:%s/horse?sslmode=require"\n' "$PW2" "$PORT"
    printf 'POSTGRES_URL_NON_POOLING="postgresql://horse:%s@127.0.0.1:%s/horse?sslmode=require"\n' "$PW2" "$PORT"
  } >> .env
  echo "[local-pg] .env updated"
fi
echo "[local-pg] done — now run: bunx prisma db push (and restart the dev server if the env changed)"
