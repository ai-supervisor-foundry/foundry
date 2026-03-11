#!/usr/bin/env bash

set -euo pipefail

# Bootstrap first ADMIN user - creates user and upgrades to ADMIN in one go
# Usage: ./bootstrap-admin.sh [email] [name] [password]

ENDPOINT=${API_URL:-http://localhost:3002/api/v1}
DB_NAME=${DB_NAME:-timesheet}
DB_USER=${DB_USER:-postgres}

EMAIL=${1:-"admin@example.com"}
NAME=${2:-"Admin User"}
PASSWORD=${3:-"Admin1234!"}

echo "=== Bootstrapping First Admin User ==="
echo "Email: $EMAIL"
echo "Name: $NAME"
echo ""

# Step 1: Create user via signup
echo "Step 1: Creating user via signup..."
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

if [ "$HTTP_CODE" -ne 201 ]; then
    echo "✗ Signup failed (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi

USER_ID=$(echo "$BODY" | jq -r '.user.id')
echo "✓ User created (ID: $USER_ID)"
echo ""

# Step 2: Upgrade to ADMIN in database
echo "Step 2: Upgrading user to ADMIN role in database..."

# Try psql with different connection methods
PSQL_SUCCESS=false

# Method 1: Direct psql command
if command -v psql &> /dev/null; then
    # Try with connection string from env if available
    if [ -n "${DB_URI:-}" ]; then
        psql "$DB_URI" -c "UPDATE \"user\" SET role = 'ADMIN' WHERE id = $USER_ID;" > /dev/null 2>&1 && PSQL_SUCCESS=true
    fi
    
    # Method 2: Try with user/db params
    if [ "$PSQL_SUCCESS" = false ]; then
        psql -U "$DB_USER" -d "$DB_NAME" -c "UPDATE \"user\" SET role = 'ADMIN' WHERE id = $USER_ID;" > /dev/null 2>&1 && PSQL_SUCCESS=true
    fi
    
    # Method 3: Try without user (uses current user)
    if [ "$PSQL_SUCCESS" = false ]; then
        psql -d "$DB_NAME" -c "UPDATE \"user\" SET role = 'ADMIN' WHERE id = $USER_ID;" > /dev/null 2>&1 && PSQL_SUCCESS=true
    fi
fi

if [ "$PSQL_SUCCESS" = true ]; then
    echo "✓ Role updated to ADMIN in database"
else
    echo "⚠ psql not available or connection failed."
    echo ""
    echo "Please run this SQL command manually:"
    echo ""
    if [ -n "${DB_URI:-}" ]; then
        echo "  psql \"$DB_URI\" -c \"UPDATE \\\"user\\\" SET role = 'ADMIN' WHERE id = $USER_ID;\""
    else
        echo "  psql -U $DB_USER -d $DB_NAME -c \"UPDATE \\\"user\\\" SET role = 'ADMIN' WHERE id = $USER_ID;\""
    fi
    echo ""
    echo "Or use Docker if database is in container:"
    echo "  docker exec -it <postgres-container> psql -U $DB_USER -d $DB_NAME -c \"UPDATE \\\"user\\\" SET role = 'ADMIN' WHERE id = $USER_ID;\""
    echo ""
    read -p "Press Enter after updating the role in database, or Ctrl+C to cancel..."
fi

echo ""

# Step 3: Get admin token
echo "Step 3: Getting admin token..."
LOGIN_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    "${ENDPOINT}/auth/login" \
    -d "{
        \"email\": \"$EMAIL\",
        \"password\": \"$PASSWORD\"
    }")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "✗ Failed to get token"
    echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
    exit 1
fi

echo "✓ Admin user ready!"
echo ""
echo "=== Admin Credentials ==="
echo "Email: $EMAIL"
echo "Password: $PASSWORD"
echo ""
echo "=== Admin Token ==="
echo "$TOKEN"
echo ""
echo "=== Usage ==="
echo "Export token for register-user.sh:"
echo "  export ADMIN_TOKEN=\"$TOKEN\""
echo ""
echo "Or use directly:"
echo "  ADMIN_TOKEN=\"$TOKEN\" ./users/register-user.sh manager@example.com \"Manager\" \"Test1234!\" MANAGER"
echo ""

