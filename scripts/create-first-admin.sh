#!/usr/bin/env bash
# Create or promote first admin user in Postgres using pgcrypto (bcrypt)
# Usage:
#   PG_CONN="postgresql://user:pass@host:5432/dbname" bash scripts/create-first-admin.sh admin@example.com Admin123! "First Admin"
# If PG_CONN not set, defaults to postgres://postgres:postgres@localhost:5432/timesheet

set -euo pipefail

PG_CONN=${PG_CONN:-"postgresql://postgres:postgres@localhost:5432/timesheet"}
EMAIL=${1:-admin@example.com}
PASSWORD=${2:-Admin123!}
FULLNAME=${3:-"First Admin"}

SQL=$(cat <<SQL
-- enable pgcrypto extension if missing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- upsert admin user with bcrypt password via crypt/gen_salt
WITH upsert AS (
  INSERT INTO users (id, email, password_hash, role, status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    $1,
    crypt($2, gen_salt('bf', 10)),
    'ADMIN',
    'active',
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE
  SET role = 'ADMIN', updated_at = now(), password_hash = crypt($2, gen_salt('bf', 10))
  RETURNING *
)
SELECT 'OK' as result;
SQL
)

# Run the SQL with psql
psql "$PG_CONN" --set ON_ERROR_STOP=1 --no-psqlrc --quiet --command "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql "$PG_CONN" --set="email='$EMAIL'" --set="pwd='$PASSWORD'" --no-psqlrc --set ON_ERROR_STOP=1 <<'PSQL'
INSERT INTO users (id, email, password_hash, role, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  :'email',
  crypt(:'pwd', gen_salt('bf', 10)),
  'ADMIN',
  'active',
  now(),
  now()
)
ON CONFLICT (email) DO UPDATE
SET role = 'ADMIN', updated_at = now(), password_hash = crypt(:'pwd', gen_salt('bf', 10));
PSQL

if [ $? -eq 0 ]; then
  echo "Admin user ensured: $EMAIL"
  echo "You can now login via POST /auth/login with the provided password."
else
  echo "Failed to create/promote admin user."
  exit 1
fi
