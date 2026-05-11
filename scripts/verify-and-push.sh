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

RUN_ID="$(date +%s)"
FAMILY_CODE="ci_family_${RUN_ID}"
MEMBER_CODE="ci_member_${RUN_ID}"

echo "Verifying family recipe upload..."
curl -fsS -X POST "${BASE_URL}/api/family-recipes/upload" \
  -H 'Content-Type: application/json' \
  -d "{\"memberCode\":\"${MEMBER_CODE}\",\"familyCode\":\"${FAMILY_CODE}\",\"recipeJson\":{\"name\":\"CI recipe\"}}" \
  > /dev/null

echo "Verifying shopping list sync..."
curl -fsS -X POST "${BASE_URL}/api/family-shopping/items" \
  -H 'Content-Type: application/json' \
  -d "{\"memberCode\":\"${MEMBER_CODE}\",\"familyCode\":\"${FAMILY_CODE}\",\"shoppingItemJson\":{\"name\":\"CI shopping\",\"num\":\"1\",\"category\":\"test\",\"price\":\"1\",\"done\":false,\"family_id\":\"${FAMILY_CODE}\",\"_id\":\"shop_${RUN_ID}\",\"create_time\":${RUN_ID},\"id\":\"shop_${RUN_ID}\"}}" \
  > /dev/null

curl -fsS "${BASE_URL}/api/family-shopping/member/${MEMBER_CODE}/changes?since=0" > /dev/null

echo "Verifying ingredient library sync..."
curl -fsS -X POST "${BASE_URL}/api/family-ingredients/items" \
  -H 'Content-Type: application/json' \
  -d "{\"memberCode\":\"${MEMBER_CODE}\",\"familyCode\":\"${FAMILY_CODE}\",\"ingredientItemJson\":{\"name\":\"CI ingredient\",\"num\":\"1\",\"category\":\"test\",\"price\":\"1\",\"done\":false,\"family_id\":\"${FAMILY_CODE}\",\"_id\":\"ingredient_${RUN_ID}\",\"create_time\":${RUN_ID},\"id\":\"ingredient_${RUN_ID}\"}}" \
  > /dev/null

curl -fsS "${BASE_URL}/api/family-ingredients/member/${MEMBER_CODE}/changes?since=0" > /dev/null

echo "Verifying aggregate family data..."
curl -fsS "${BASE_URL}/api/family-data/member/${MEMBER_CODE}" > /dev/null

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
