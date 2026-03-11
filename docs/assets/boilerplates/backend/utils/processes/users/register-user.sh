#!/usr/bin/env bash

set -euo pipefail

# Timesheet App User Registration Script
# Usage: ./register-user.sh [email] [name] [password] [role]
#   role: USER (default), MANAGER, or ADMIN
#   For MANAGER/ADMIN roles, requires ADMIN_TOKEN env var or prompts for admin JWT
#
# Examples:
#   ./register-user.sh john@example.com "John Doe" "Test1234!" USER
#   ./register-user.sh admin@example.com "Admin User" "Test1234!" ADMIN
#   ADMIN_TOKEN="..." ./register-user.sh manager@example.com "Manager" "Test1234!" MANAGER

ENDPOINT=${API_URL:-http://localhost:3002/api/v1}

# Use provided values or generate defaults
EMAIL=${1:-"test.$(date +%s)@example.com"}
NAME=${2:-"Test User $(date +%s)"}
PASSWORD=${3:-"Test1234!"}
ROLE=${4:-"USER"}

# Normalize role to uppercase
ROLE=$(echo "$ROLE" | tr '[:lower:]' '[:upper:]')

# Validate role
if [[ ! "$ROLE" =~ ^(USER|MANAGER|ADMIN)$ ]]; then
    echo "✗ Invalid role: $ROLE. Must be USER, MANAGER, or ADMIN"
    exit 1
fi

echo "Registering user..."
echo "Email: $EMAIL"
echo "Name: $NAME"
echo "Role: $ROLE"
echo ""

# Determine endpoint and auth
if [ "$ROLE" = "USER" ]; then
    # Regular signup - no auth needed
    MODULE="/auth/signup"
    AUTH_HEADER=""
    echo "Using public signup endpoint (no auth required)"
else
    # Admin endpoint - requires admin token
    MODULE="/users"
    if [ -z "${ADMIN_TOKEN:-}" ]; then
        read -p "Enter admin JWT token (required for $ROLE role): " ADMIN_TOKEN
        if [ -z "$ADMIN_TOKEN" ]; then
            echo "✗ Admin token required for $ROLE role"
            exit 1
        fi
    fi
    AUTH_HEADER="Authorization: Bearer ${ADMIN_TOKEN}"
    echo "Using admin endpoint (requires admin token)"
fi

echo "Endpoint: ${ENDPOINT}${MODULE}"
echo ""

# Build request
if [ -z "$AUTH_HEADER" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        "${ENDPOINT}${MODULE}" \
        -d "{
            \"name\": \"$NAME\",
            \"email\": \"$EMAIL\",
            \"password\": \"$PASSWORD\"
        }")
else
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        "${ENDPOINT}${MODULE}" \
        -d "{
            \"name\": \"$NAME\",
            \"email\": \"$EMAIL\",
            \"password\": \"$PASSWORD\",
            \"role\": \"$ROLE\"
        }")
fi

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
    echo "✓ User registered successfully!"
    echo ""
    echo "$BODY" | jq '.'
    if [ "$ROLE" = "USER" ]; then
        echo ""
        echo "Access Token: $(echo "$BODY" | jq -r '.accessToken // empty')"
    fi
else
    echo "✗ Registration failed (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi

