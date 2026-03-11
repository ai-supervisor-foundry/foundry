#!/usr/bin/env bash
# Non-interactive test: POST create, GET list, PATCH update, DELETE archive.
# Requires: server running, .env with valid DB and JWT_SECRET.
# Usage: ./scripts/test-project-crud.sh [base_url]
set -e
BASE="${1:-http://localhost:3000/api/v1}"

echo "=== Login ==="
LOGIN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"Test123!@#"}')
TOKEN=$(echo "$LOGIN" | jq -r '.accessToken // empty')
if [ -z "$TOKEN" ]; then
  echo "Login failed. Create a user first (e.g. signup)."
  exit 1
fi

echo "=== POST /projects ==="
CREATE=$(curl -s -X POST "$BASE/projects" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"code":"PRJ-CURL","description":"Curl test"}')
echo "$CREATE" | jq .
ID=$(echo "$CREATE" | jq -r '.id')
if [ "$ID" = "null" ] || [ -z "$ID" ]; then
  echo "Create failed."
  exit 1
fi

echo "=== GET /projects ==="
curl -s "$BASE/projects?limit=10&offset=0" -H "Authorization: Bearer $TOKEN" | jq .

echo "=== GET /projects?include_archived=true ==="
curl -s "$BASE/projects?limit=10&offset=0&include_archived=true" -H "Authorization: Bearer $TOKEN" | jq .

echo "=== GET /projects/$ID ==="
curl -s "$BASE/projects/$ID" -H "Authorization: Bearer $TOKEN" | jq .

echo "=== PATCH /projects/$ID ==="
curl -s -X PATCH "$BASE/projects/$ID" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"description":"Updated by curl"}' | jq .

echo "=== DELETE /projects/$ID (archive) ==="
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/projects/$ID" -H "Authorization: Bearer $TOKEN")
echo "HTTP $HTTP (expected 204)"

echo "=== GET /projects (without archived) - should not include archived ==="
curl -s "$BASE/projects?limit=10&offset=0" -H "Authorization: Bearer $TOKEN" | jq .

echo "Done."
