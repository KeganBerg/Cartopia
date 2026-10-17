#!/usr/bin/env bash
# Every migration on a brand-new database, then the live race, wager and crew race checks in
# server-check.sql, played as signed-in players. Its own throwaway Postgres; nothing real is touched.
#   scripts/twoplayer/server-check.sh
# Needs Postgres binaries (initdb, pg_ctl, psql); CI's Ubuntu runner has them.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${CHECK_PGPORT:-54339}"
DIR="$(mktemp -d /tmp/cartopia-sqlcheck.XXXXXX)"
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$DIR"
cleanup() { as_pg "$PGBIN/pg_ctl -D $DIR/pg -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
as_pg "$PGBIN/initdb -D $DIR/pg -U postgres --auth=trust" >/dev/null
as_pg "$PGBIN/pg_ctl -D $DIR/pg -o '-p $PORT -k $DIR' -l $DIR/pg.log -w start" >/dev/null
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -qX)
"${PSQL[@]}" -d postgres -c "create database cartopia"
"${PSQL[@]}" -d cartopia -f "$ROOT/scripts/twoplayer/supabase-shim.sql" >/dev/null 2>&1
n=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -d cartopia -f "$f" >/dev/null 2>"$DIR/err" || { echo "FAIL migration $(basename "$f")"; cat "$DIR/err"; exit 1; }
  n=$((n + 1))
done
echo "ok   $n migrations apply to a fresh database"
"${PSQL[@]}" -d cartopia -f "$ROOT/scripts/twoplayer/server-check.sql" 2>&1 | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR):  //'
