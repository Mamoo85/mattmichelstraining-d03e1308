#!/bin/bash
# repair-mugs.sh
# Regenerates ALL mug designs with scale=0.30 and center-30% constraint.
# Fixes Lovable's bad wrap-around designs. Safe to run at any time — idempotent.
# Each mug batch takes ~130s. Non-mug batches skip instantly.
# Total: ~20 minutes for ~120 products.
#
# Usage: chmod +x repair-mugs.sh && ./repair-mugs.sh
# Or resume from a specific offset: ./repair-mugs.sh 42

ANON_KEY="eyJ.REDACTED.JWT"
URL="https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/printify-product-creator"
OFFSET=${1:-0}

echo "Starting repairMugs from offset=$OFFSET"
echo "==========================================="

while true; do
  echo ""
  echo "--- repairMugs offset=$OFFSET ---"

  result=$(curl -s -X POST "$URL" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"repairMugs\":true,\"offset\":$OFFSET}" \
    --max-time 150)

  if [ $? -ne 0 ]; then
    echo "  curl error — retrying in 5s..."
    sleep 5
    continue
  fi

  SUCCEEDED=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('succeeded',0))" 2>/dev/null)
  PROCESSED=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('processed',0))" 2>/dev/null)
  NEXT=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('nextOffset'); print(v if v is not None else 'null')" 2>/dev/null)

  echo "  ok: succeeded=$SUCCEEDED/$PROCESSED, next=$NEXT"

  # Print any repair results
  echo "$result" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('results',[]):
    status = r.get('status','?')
    title = r.get('title','?')[:50]
    err = r.get('error','')
    if err:
        print(f'  {status}: {title} — {err[:80]}')
    else:
        print(f'  {status}: {title}')
" 2>/dev/null

  if [ "$NEXT" = "null" ] || [ -z "$NEXT" ]; then
    echo ""
    echo "==========================================="
    echo "All mugs repaired!"
    break
  fi

  OFFSET=$NEXT
  sleep 2
done
