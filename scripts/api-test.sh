#!/usr/bin/env bash
# End-to-end API test. Requires the dev server running and DATABASE_URL set.
# Usage: bash scripts/api-test.sh [base-url]
set -uo pipefail
BASE="${1:-http://localhost:3000}"
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

# Evaluate a Python expression against the piped JSON, e.g. "['prompt']['id']".
jsonfield() {
  python3 -c "import sys,json;print(eval('d'+sys.argv[1],{'d':json.load(sys.stdin)}))" "$1" 2>/dev/null
}

echo "Testing API at $BASE"
echo

# --- Folders ---------------------------------------------------------------
echo "Folders"
RESP=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/api/folders" \
  -H 'content-type: application/json' -d '{"name":"Writing"}')
CODE=$(echo "$RESP" | tail -1); BODY=$(echo "$RESP" | sed '$d')
check "POST /api/folders creates a folder" 201 "$CODE"
PARENT_ID=$(echo "$BODY" | jsonfield "['folder']['id']")

RESP=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/api/folders" \
  -H 'content-type: application/json' -d "{\"name\":\"Blog\",\"parentId\":\"$PARENT_ID\"}")
CODE=$(echo "$RESP" | tail -1); BODY=$(echo "$RESP" | sed '$d')
check "POST /api/folders nests under a parent" 201 "$CODE"
CHILD_ID=$(echo "$BODY" | jsonfield "['folder']['id']")

CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/folders" \
  -H 'content-type: application/json' -d '{"name":""}')
check "POST /api/folders rejects an empty name" 400 "$CODE"

CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X PATCH "$BASE/api/folders/$PARENT_ID" \
  -H 'content-type: application/json' -d "{\"parentId\":\"$CHILD_ID\"}")
check "PATCH rejects moving a folder inside its own subtree" 400 "$CODE"

# --- Categories ------------------------------------------------------------
echo
echo "Categories"
RESP=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/api/categories" \
  -H 'content-type: application/json' -d '{"name":"marketing"}')
CODE=$(echo "$RESP" | tail -1); BODY=$(echo "$RESP" | sed '$d')
check "POST /api/categories creates a category" 201 "$CODE"
CAT_ID=$(echo "$BODY" | jsonfield "['category']['id']")

CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/categories" \
  -H 'content-type: application/json' -d '{"name":"marketing"}')
check "POST /api/categories rejects a duplicate name" 409 "$CODE"

# --- Prompts ---------------------------------------------------------------
echo
echo "Prompts"
RESP=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/api/prompts" \
  -H 'content-type: application/json' \
  -d "{\"title\":\"Blog outline\",\"content\":\"Draft an outline about {{topic}}\",\"folderId\":\"$CHILD_ID\",\"categoryIds\":[\"$CAT_ID\"]}")
CODE=$(echo "$RESP" | tail -1); BODY=$(echo "$RESP" | sed '$d')
check "POST /api/prompts creates a prompt" 201 "$CODE"
PROMPT_ID=$(echo "$BODY" | jsonfield "['prompt']['id']")

CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/prompts" \
  -H 'content-type: application/json' -d '{"title":"No content"}')
check "POST /api/prompts rejects a missing body" 400 "$CODE"

CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/prompts" \
  -H 'content-type: application/json' \
  -d '{"title":"x","content":"y","folderId":"00000000-0000-4000-8000-000000000000"}')
check "POST /api/prompts rejects an unknown folder" 404 "$CODE"

COUNT=$(curl -sS "$BASE/api/prompts" | jsonfield "['prompts'].__len__()")
check "GET /api/prompts lists prompts" 1 "$COUNT"

COUNT=$(curl -sS "$BASE/api/prompts?q=outline" | jsonfield "['prompts'].__len__()")
check "GET /api/prompts?q= matches on content" 1 "$COUNT"

COUNT=$(curl -sS "$BASE/api/prompts?q=nonexistentzzz" | jsonfield "['prompts'].__len__()")
check "GET /api/prompts?q= excludes non-matches" 0 "$COUNT"

COUNT=$(curl -sS "$BASE/api/prompts?folderId=$PARENT_ID" | jsonfield "['prompts'].__len__()")
check "GET /api/prompts?folderId= includes subfolders" 1 "$COUNT"

COUNT=$(curl -sS "$BASE/api/prompts?categoryIds=$CAT_ID" | jsonfield "['prompts'].__len__()")
check "GET /api/prompts?categoryIds= filters by category" 1 "$COUNT"

NVERSIONS=$(curl -sS "$BASE/api/prompts/$PROMPT_ID" | jsonfield "['prompt']['versions'].__len__()")
check "creating a prompt records an initial version" 1 "$NVERSIONS"

curl -sS -o /dev/null -X PATCH "$BASE/api/prompts/$PROMPT_ID" \
  -H 'content-type: application/json' -d '{"content":"Draft a detailed outline about {{topic}}"}'
NVERSIONS=$(curl -sS "$BASE/api/prompts/$PROMPT_ID" | jsonfield "['prompt']['versions'].__len__()")
check "editing the content records a new version" 2 "$NVERSIONS"

curl -sS -o /dev/null -X PATCH "$BASE/api/prompts/$PROMPT_ID" \
  -H 'content-type: application/json' -d '{"title":"Renamed only"}'
NVERSIONS=$(curl -sS "$BASE/api/prompts/$PROMPT_ID" | jsonfield "['prompt']['versions'].__len__()")
check "renaming alone does NOT record a version" 2 "$NVERSIONS"

CODE=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/prompts/not-a-uuid")
check "GET /api/prompts/[id] rejects a malformed id" 400 "$CODE"

CODE=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/prompts/00000000-0000-4000-8000-000000000000")
check "GET /api/prompts/[id] 404s on an unknown id" 404 "$CODE"

# --- Optimize --------------------------------------------------------------
echo
echo "Optimize"
RESP=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/api/prompts/$PROMPT_ID/optimize" \
  -H 'content-type: application/json' -d '{}')
CODE=$(echo "$RESP" | tail -1); BODY=$(echo "$RESP" | sed '$d')
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  check "POST optimize returns a suggestion" 200 "$CODE"
  HAS=$(echo "$BODY" | jsonfield "['optimized'].__class__.__name__")
  check "the suggestion carries rewritten text" str "$HAS"
else
  check "POST optimize reports the missing API key" 501 "$CODE"
  NEEDS=$(echo "$BODY" | jsonfield "['needsSetup']")
  check "the error flags it as a setup problem" True "$NEEDS"
fi

CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  "$BASE/api/prompts/00000000-0000-4000-8000-000000000000/optimize" \
  -H 'content-type: application/json' -d '{}')
check "optimize 404s on an unknown prompt" 404 "$CODE"

# --- Cascade behavior ------------------------------------------------------
echo
echo "Cascades"
curl -sS -o /dev/null -X DELETE "$BASE/api/folders/$PARENT_ID"
FOLDER_OF_PROMPT=$(curl -sS "$BASE/api/prompts/$PROMPT_ID" | jsonfield "['prompt']['folderId']")
check "deleting a folder keeps its prompts (moved to root)" None "$FOLDER_OF_PROMPT"

curl -sS -o /dev/null -X DELETE "$BASE/api/categories/$CAT_ID"
NCATS=$(curl -sS "$BASE/api/prompts/$PROMPT_ID" | jsonfield "['prompt']['categories'].__len__()")
check "deleting a category unlinks it from prompts" 0 "$NCATS"

CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/prompts/$PROMPT_ID")
check "DELETE /api/prompts/[id] returns 204" 204 "$CODE"

COUNT=$(curl -sS "$BASE/api/prompts" | jsonfield "['prompts'].__len__()")
check "library is empty after cleanup" 0 "$COUNT"

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
