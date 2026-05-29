#!/bin/bash
# repair-apparel.sh
# Rescales ALL shirt/hoodie designs to scale=0.85 to prevent text cutoff at edges.
# Safe to run at any time — idempotent (same scale applied, mockups regenerated).
# Each call processes 3 apparel per batch: ~45s total. Non-apparel batches skip instantly.
# Total: ~30 minutes for ~65 shirts+hoodies.
#
# Usage: chmod +x repair-apparel.sh && ./repair-apparel.sh
# Or resume from a specific offset: ./repair-apparel.sh 42

ANON_KEY="eyJ.REDACTED.JWT"
URL="https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/printify-product-creator"
OFFSET=${1:-0}

echo "Starting repairApparel from offset=$OFFSET"
echo "==========================================="

while true; do
  echo ""
  echo "--- repairApparel offset=$OFFSET ---"

  result=$(curl -s -X POST "$URL" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"repairApparel\":true,\"offset\":$OFFSET}" \
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
    echo "All apparel repaired!"
    break
  fi

  OFFSET=$NEXT
  sleep 2
done
