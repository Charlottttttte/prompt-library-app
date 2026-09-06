#!/usr/bin/env bash
# Exercises the optimizer end to end against a mock OpenAI server, including
# every failure path. Needs the dev server running with:
#   OPENAI_API_KEY=<anything> OPENAI_BASE_URL=http://localhost:4010/v1
#
# Usage: bash scripts/optimize-integration-test.sh [base-url]
set -uo pipefail
BASE="${1:-http://localhost:3000}"
MOCK_PORT=4010
PASS=0
FAIL=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✓ $label"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label (expected $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

# Subscript path against the piped JSON, e.g. "['prompt']['id']".
jsonfield() {
  python3 -c "import sys,json;print(eval('d'+sys.argv[1],{'d':json.load(sys.stdin)}))" "$1" 2>/dev/null
}

# Full Python expression with the parsed JSON bound to `d`.
jsoneval() {
  python3 -c "import sys,json;print(eval(sys.argv[1],{'d':json.load(sys.stdin)}))" "$1" 2>/dev/null
}

restart_mock() {
  pkill -f "[m]ock-openai.mjs" 2>/dev/null
  sleep 1
  MOCK_MODE="$1" setsid node scripts/mock-openai.mjs "$MOCK_PORT" \
    > "/tmp/mock-openai-$1.log" 2>&1 < /dev/null &
  sleep 1.5
}

PROMPT_ID=$(curl -sS "$BASE/api/prompts" | jsonfield "['prompts'][0]['id']")
if [ -z "$PROMPT_ID" ]; then
  echo "No prompts found — run db:seed first."
  exit 1
fi

optimize() {
  curl -sS -w '\n%{http_code}' -X POST "$BASE/api/prompts/$PROMPT_ID/optimize" \
    -H 'content-type: application/json' -d "${1:-\{\}}"
}

echo "Optimizer integration (mock OpenAI on :$MOCK_PORT)"
echo

echo "Happy path"
restart_mock ok
RESP=$(optimize); CODE=$(echo "$RESP" | tail -1); BODY=$(echo "$RESP" | sed '$d')
check "returns 200" 200 "$CODE"
check "carries a rewrite" str "$(echo "$BODY" | jsonfield "['optimized'].__class__.__name__")"
check "carries the original for comparison" str "$(echo "$BODY" | jsonfield "['original'].__class__.__name__")"
check "reports two changes" 2 "$(echo "$BODY" | jsonfield "['changes'].__len__()")"
check "echoes the configured model" gpt-5.6-terra "$(echo "$BODY" | jsonfield "['model']")"
# The mock echoes back a placeholder it found in the request, which proves the
# real prompt text was sent rather than something hardcoded.
HAS_PLACEHOLDER=$(echo "$BODY" | jsoneval "'{{' in d['optimized']")
check "the app sent the actual prompt text" True "$HAS_PLACEHOLDER"

# Optimizing must never write. The version count has to be unchanged after.
BEFORE=$(curl -sS "$BASE/api/prompts/$PROMPT_ID" | jsonfield "['prompt']['versions'].__len__()")
optimize > /dev/null
AFTER=$(curl -sS "$BASE/api/prompts/$PROMPT_ID" | jsonfield "['prompt']['versions'].__len__()")
check "optimizing does NOT save anything" "$BEFORE" "$AFTER"

echo
echo "Custom instructions"
restart_mock ok
RESP=$(optimize '{"instructions":"make it shorter"}')
check "accepts extra instructions" 200 "$(echo "$RESP" | tail -1)"

echo
echo "Failure paths"
restart_mock unauthorized
RESP=$(optimize); CODE=$(echo "$RESP" | tail -1); BODY=$(echo "$RESP" | sed '$d')
check "a rejected key surfaces as 401" 401 "$CODE"
check "and is flagged as a setup problem" True "$(echo "$BODY" | jsonfield "['needsSetup']")"

restart_mock rate_limited
check "rate limiting surfaces as 429" 429 "$(optimize | tail -1)"

restart_mock refusal
RESP=$(optimize); CODE=$(echo "$RESP" | tail -1); BODY=$(echo "$RESP" | sed '$d')
check "a model refusal surfaces as 422" 422 "$CODE"
check "and explains the refusal" True "$(echo "$BODY" | jsoneval "'declined' in d['error']")"

restart_mock truncated
RESP=$(optimize); CODE=$(echo "$RESP" | tail -1); BODY=$(echo "$RESP" | sed '$d')
check "a truncated rewrite surfaces as 413" 413 "$CODE"
check "and says the prompt was too long" True "$(echo "$BODY" | jsoneval "'cut off' in d['error']")"

restart_mock badjson
check "unparseable output surfaces as 502" 502 "$(optimize | tail -1)"

pkill -f "[m]ock-openai.mjs" 2>/dev/null

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
