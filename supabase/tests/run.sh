#!/usr/bin/env bash
# Applies every migration in supabase/migrations/ to a fresh, throwaway
# local Postgres database (stubbing the parts of Supabase's managed
# auth/storage schemas our RLS depends on) and runs the self-asserting
# test cases in supabase/tests/cases/ against it.
#
# There's no Docker in this repo's dev/CI sandbox, so this is a plain-psql
# harness rather than `supabase start` + pgTAP -- see LOCAL_DEV.md. It
# expects a local Postgres server reachable as `sudo -u postgres psql`
# (matching the local dev setup), and formalizes checks that were
# previously re-derived by hand each session; run it with:
#
#   npm run test:db   (from apps/web), or
#   supabase/tests/run.sh   directly
set -euo pipefail

DB_NAME="${ETVET_TEST_DB:-etvet_test}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$(cd "$SCRIPT_DIR/../migrations" && pwd)"
PSQL_ADMIN=(sudo -u postgres psql -X -q)
PSQL_TEST=(sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB_NAME")

MIGRATION_LOG="$(mktemp)"
trap 'rm -f "$MIGRATION_LOG"; "${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS $DB_NAME;" > /dev/null 2>&1 || true' EXIT

echo "==> Resetting database $DB_NAME"
"${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS $DB_NAME;" -c "CREATE DATABASE $DB_NAME;" > /dev/null

echo "==> Stubbing auth/storage schemas"
"${PSQL_ADMIN[@]}" -d "$DB_NAME" -f "$SCRIPT_DIR/00_stub.sql" > /dev/null

echo "==> Applying migrations"
for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "    $(basename "$f")"
  if ! "${PSQL_ADMIN[@]}" -d "$DB_NAME" -f "$f" > "$MIGRATION_LOG" 2>&1; then
    : # psql's default (non ON_ERROR_STOP) mode already reports the failing
      # statement and continues -- check below for anything beyond the one
      # expected error.
  fi
  # The only error every migration run is expected to hit outside a real
  # Supabase project: `alter publication supabase_realtime add table ...`
  # in 0009_live_sessions.sql, since vanilla Postgres has no such
  # publication until we create an empty stand-in for it. Anything else
  # is a real migration failure.
  if grep -qi "error" "$MIGRATION_LOG" \
      && grep -vi 'publication "supabase_realtime" does not exist' "$MIGRATION_LOG" | grep -qi "error"; then
    echo "MIGRATION FAILED: $(basename "$f")"
    cat "$MIGRATION_LOG"
    exit 1
  fi
done
"${PSQL_ADMIN[@]}" -d "$DB_NAME" -c "create publication supabase_realtime;" > /dev/null 2>&1 || true

echo "==> Loading test helpers"
"${PSQL_ADMIN[@]}" -d "$DB_NAME" -f "$SCRIPT_DIR/01_assert.sql" > /dev/null

FAILED=0
echo "==> Running test cases"
for f in "$SCRIPT_DIR"/cases/*.sql; do
  name="$(basename "$f")"
  echo "    $name"
  if ! "${PSQL_TEST[@]}" -f "$f" > /tmp/etvet_test_case_output.log 2>&1; then
    echo "FAILED: $name"
    cat /tmp/etvet_test_case_output.log
    FAILED=1
  fi
  rm -f /tmp/etvet_test_case_output.log
done

if [ "$FAILED" -ne 0 ]; then
  echo "==> One or more database test cases FAILED"
  exit 1
fi
echo "==> All database tests passed"
