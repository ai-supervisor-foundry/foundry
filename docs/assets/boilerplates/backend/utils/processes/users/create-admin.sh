#!/usr/bin/env bash

set -euo pipefail

# Helper script to create the first ADMIN user
# This creates a USER first, then you need to manually update role to ADMIN in DB
# Or use this after creating admin manually: just gets you the token

ENDPOINT=${API_URL:-http://localhost:3002/api/v1}

EMAIL=${1:-"admin@example.com"}
NAME=${2:-"Admin User"}
PASSWORD=${3:-"Admin1234!"}

echo "Creating initial admin user..."
echo "Email: $EMAIL"
echo "Name: $NAME"
echo ""
echo "Step 1: Creating user via signup (will be USER role)..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    "${ENDPOINT}/auth/signup" \
    -d "{
        \"name\": \"$NAME\",
        \"email\": \"$EMAIL\",
        \"password\": \"$PASSWORD\"
    }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
    USER_ID=$(echo "$BODY" | jq -r '.user.id')
    echo "✓ User created (ID: $USER_ID)"
    echo ""
    echo "Step 2: Update user role to ADMIN in database:"
    echo ""
    echo "  psql -U postgres -d tm-dev -c \"UPDATE \"user\" SET role = 'ADMIN' WHERE id = $USER_ID;\""
    echo ""
    echo "Step 3: Login to get admin token:"
    echo ""
    echo "  ./users/register-user.sh \"$EMAIL\" \"$NAME\" \"$PASSWORD\" USER"
    echo "  # Then use the accessToken from output"
    echo ""
    echo "Or use this token (after updating role in DB):"
    TOKEN=$(echo "$BODY" | jq -r '.accessToken // empty')
    if [ -n "$TOKEN" ]; then
        echo "  ADMIN_TOKEN=\"$TOKEN\" ./users/register-user.sh ... MANAGER"
    fi
else
    echo "✗ Signup failed (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi

