#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

COMMIT_MESSAGE="${1:-chore: update service $(date '+%Y-%m-%d %H:%M:%S')}"
BRANCH="$(git branch --show-current)"
VERIFY_PORT="${VERIFY_PORT:-3010}"
BASE_URL="http://localhost:${VERIFY_PORT}"
SERVER_LOG="${TMPDIR:-/tmp}/node-servers-verify.log"

if [ -z "$BRANCH" ]; then
  echo "No current git branch found."
  exit 1
fi

echo "Checking JavaScript syntax..."
find src scripts -name '*.js' -print | while IFS= read -r file; do
  node -c "$file"
done

echo "Starting mock API on ${BASE_URL}..."
env USE_MOCK_DB=true PORT="$VERIFY_PORT" npm run start > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

READY=0
TRIES=0
while [ "$TRIES" -lt 30 ]; do
  if curl -fsS "${BASE_URL}/demo" > /dev/null 2>&1; then
    READY=1
    break
  fi

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Mock API failed to start. Log:"
    cat "$SERVER_LOG"
    exit 1
  fi

  TRIES=$((TRIES + 1))
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "Mock API did not become ready. Log:"
  cat "$SERVER_LOG"
  exit 1
fi

echo "Verifying device, invite, family data, and sync APIs..."
API_BASE_URL="$BASE_URL" node scripts/demo-call.js > /dev/null

cleanup
trap - EXIT INT TERM

echo "Verification passed."

if [ -n "$(git status --porcelain)" ]; then
  echo "Committing changes..."
  git add .
  git commit -m "$COMMIT_MESSAGE"
else
  echo "No local changes to commit."
fi

echo "Pushing ${BRANCH} to origin..."
git push -u origin "$BRANCH"

echo "Done."
