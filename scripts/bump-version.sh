#!/usr/bin/env bash
# Bump version across all package.json files.
# Usage: ./scripts/bump-version.sh [major|minor|patch]
# Default: patch

set -euo pipefail

BUMP_TYPE="${1:-patch}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

PACKAGE_FILES=(
  "$ROOT_DIR/package.json"
  "$ROOT_DIR/UI/backend/package.json"
  "$ROOT_DIR/UI/frontend/package.json"
)

# Read current version from root package.json
CURRENT=$(node -p "require('$ROOT_DIR/package.json').version")

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP_TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Unknown bump type: $BUMP_TYPE (use major, minor, or patch)" >&2; exit 1 ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

for f in "${PACKAGE_FILES[@]}"; do
  if [ -f "$f" ]; then
    node -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('$f', 'utf8'));
      pkg.version = '$NEW_VERSION';
      fs.writeFileSync('$f', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "  $f -> $NEW_VERSION"
  fi
done

echo "Bumped $CURRENT -> $NEW_VERSION ($BUMP_TYPE)"
