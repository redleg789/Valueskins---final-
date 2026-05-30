#!/bin/bash
set -e

MIGRATIONS_DIR="$(dirname "$0")/migrations"
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
export PGPASSWORD="FXZ0OcB2zyVkGLQUEIq8uGjAVigm2T9x"
HOST="dpg-d864uujtqb8s73c5abfg-a.singapore-postgres.render.com"
PORT="5432"
USER="valueskins_user"
DB="valueskins"
PSQL="psql -h $HOST -p $PORT -U $USER -d $DB -v ON_ERROR_STOP=1 -q -X"

$PSQL -c "SELECT 'Connected to Postgres ' || version() as info;" 2>&1

SQL_FILES=$(ls "$MIGRATIONS_DIR"/*.sql | sort)
TOTAL=$(echo "$SQL_FILES" | wc -l | xargs)
COUNT=0
FAILED=0

for f in $SQL_FILES; do
  NAME=$(basename "$f")
  COUNT=$((COUNT + 1))
  printf "[%2d/%2d] %s ... " "$COUNT" "$TOTAL" "$NAME"
  if $PSQL -f "$f" > /dev/null 2>&1; then
    echo "OK"
  else
    echo "FAIL"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "--- Migration Summary ---"
echo "Total: $TOTAL | Succeeded: $((TOTAL - FAILED)) | Failed: $FAILED"

if [ "$FAILED" -eq 0 ]; then
  echo "All migrations applied successfully."
  echo ""
  echo "--- Tables Created ---"
  $PSQL -c "\dt" 2>&1
fi
