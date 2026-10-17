#!/usr/bin/env bash
# A private, throwaway Cartopia server for two-player tests: local Postgres with every migration,
# PostgREST, the local gateway (auth + realtime) and vite pointed at it. Nothing here talks to the
# real Supabase project, so no real player's save is ever touched.
#   scripts/twoplayer/stack.sh up     fresh database, everything started (prints the game URL)
#   scripts/twoplayer/stack.sh down   stop it all
# Needs Postgres 16 binaries (initdb, pg_ctl, psql). PostgREST is downloaded once.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="${STACK_DIR:-/var/tmp/cartopia-2p}"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PGPORT="${PGPORT:-54329}"
VITE_PORT="${VITE_PORT:-5199}"
PGRST_VERSION=12.2.3
export PGPORT PGDATABASE=cartopia
PSQL=(psql -h 127.0.0.1 -p "$PGPORT" -U postgres -v ON_ERROR_STOP=1 -qX)
# initdb and postgres refuse to run as root.
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }

stop_pid() {
  local f="$DIR/$1.pid"
  if [ -f "$f" ]; then kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; fi
}

down() {
  stop_pid vite; stop_pid gateway; stop_pid postgrest
  # Anything else still holding the ports (an earlier run whose pid files were overwritten) would
  # keep serving the old database's schema.
  command -v fuser >/dev/null && for port in 54330 54321 "$VITE_PORT"; do fuser -k -n tcp "$port" >/dev/null 2>&1 || true; done
  [ -d "$DIR/pg" ] && as_pg "$PGBIN/pg_ctl -D $DIR/pg -m fast stop" >/dev/null 2>&1 || true
}

up() {
  down
  mkdir -p "$DIR"
  rm -rf "$DIR/pg"
  [ "$(id -u)" = 0 ] && chown postgres "$DIR"
  as_pg "$PGBIN/initdb -D $DIR/pg -U postgres --auth=trust" >/dev/null
  as_pg "$PGBIN/pg_ctl -D $DIR/pg -o '-p $PGPORT -k $DIR' -l $DIR/pg.log -w start" >/dev/null
  "${PSQL[@]}" -d postgres -c "create database cartopia"
  "${PSQL[@]}" -f "$ROOT/scripts/twoplayer/supabase-shim.sql" 2>&1 | grep -v -e NOTICE -e WARNING -e HINT || true
  for f in "$ROOT"/supabase/migrations/*.sql; do
    "${PSQL[@]}" -f "$f" >/dev/null 2>"$DIR/migrate.err" || { echo "migration failed: $f"; cat "$DIR/migrate.err"; exit 1; }
  done
  echo "migrations: $(ls "$ROOT"/supabase/migrations/*.sql | wc -l) applied"

  if [ ! -x "$DIR/postgrest" ]; then
    curl -sSL "https://github.com/PostgREST/postgrest/releases/download/v$PGRST_VERSION/postgrest-v$PGRST_VERSION-linux-static-x64.tar.xz" | tar xJ -C "$DIR"
  fi
  local secret
  secret=$(cd "$ROOT" && GATEWAY_QUIET=1 node -e "import('./scripts/twoplayer/gateway.mjs').then((m) => { console.log(m.JWT_SECRET); process.exit(0) })")
  cat > "$DIR/postgrest.conf" <<EOF
db-uri = "postgres://authenticator:authenticator@127.0.0.1:$PGPORT/cartopia"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$secret"
server-host = "127.0.0.1"
server-port = 54330
EOF
  (cd "$DIR" && nohup ./postgrest postgrest.conf > postgrest.log 2>&1 & echo $! > "$DIR/postgrest.pid")
  (cd "$ROOT" && nohup node scripts/twoplayer/gateway.mjs > "$DIR/gateway.log" 2>&1 & echo $! > "$DIR/gateway.pid")
  local anon
  anon=$(cd "$ROOT" && GATEWAY_QUIET=1 node -e "import('./scripts/twoplayer/gateway.mjs').then((m) => { console.log(m.anonKey); process.exit(0) })")
  (cd "${VITE_ROOT:-$ROOT}" && VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY="$anon" nohup npx vite --port "$VITE_PORT" --strictPort --host 127.0.0.1 > "$DIR/vite.log" 2>&1 & echo $! > "$DIR/vite.pid")
  for _ in $(seq 60); do
    curl -sfm 2 "http://127.0.0.1:$VITE_PORT/" >/dev/null && curl -sfm 2 http://127.0.0.1:54321/health >/dev/null && curl -sfm 2 http://127.0.0.1:54330/ >/dev/null && break
    sleep 1
  done
  echo "game: http://127.0.0.1:$VITE_PORT/  (server: http://127.0.0.1:54321, logs in $DIR)"
}

case "${1:-up}" in
  up) up ;;
  down) down ;;
  *) echo "usage: $0 up|down"; exit 2 ;;
esac
