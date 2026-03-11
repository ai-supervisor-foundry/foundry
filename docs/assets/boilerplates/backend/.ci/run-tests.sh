#!/usr/bin/env bash
# CI test runner: reads .ci/tests.yml and runs each test command.
#
# Usage:
#   From repo root:  backend/.ci/run-tests.sh
#   From backend:    ./.ci/run-tests.sh
#
# Customize: Edit backend/.ci/tests.yml to add/remove or change test commands.
# Projects with different UT/FT scripts only need to update the config file.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG="$SCRIPT_DIR/tests.yml"

cd "$BACKEND_DIR"

if [[ ! -f "$CONFIG" ]]; then
  echo "Config not found: $CONFIG"
  exit 1
fi

# Parse YAML and run each test
# Prefer Node (always in backend); fallback to Ruby (on GitHub runners)
extract_commands() {
  if command -v node &>/dev/null; then
    node -e "
      const fs = require('fs');
      const y = fs.readFileSync('$CONFIG', 'utf8');
      const m = y.matchAll(/command:\s*([^\n]+)/g);
      for (const x of m) console.log(x[1].trim());
    "
  elif command -v ruby &>/dev/null; then
    ruby -r yaml -e "
      YAML.load_file('$CONFIG')['tests']&.each do |_n, opts|
        puts opts['command'] if opts.is_a?(Hash) && opts['command']
      end
    "
  else
    echo "Need node or ruby to parse config" >&2
    exit 1
  fi
}

while IFS= read -r cmd; do
  [[ -z "$cmd" ]] && continue
  echo "Running: $cmd"
  eval "$cmd" || exit 1
done < <(extract_commands)

echo "All tests passed."
