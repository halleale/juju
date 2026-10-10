#!/usr/bin/env bash
# Applies supabase/migrations to a throwaway local Postgres and runs the RLS checks.
# Needs Postgres 15+ binaries (initdb, pg_ctl, psql) on PATH or in PG_BIN.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
DATA="$(mktemp -d)"
PORT="${PORT:-54329}"
RUN=()
# initdb refuses to run as root.
if [ "$(id -u)" = 0 ]; then
  chown -R postgres "$DATA"
  RUN=(runuser -u postgres --)
fi
cleanup() { "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

"${RUN[@]}" "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
"${RUN[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -w start >/dev/null

PSQL=("$PG_BIN/psql" -h /tmp -p "$PORT" -U postgres -d postgres -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$ROOT/supabase/tests/auth_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f"
done
for t in rls_test ingest_test; do
  "${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/tests/$t.sql"
done
