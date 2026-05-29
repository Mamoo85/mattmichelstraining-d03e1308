#!/usr/bin/env bash
# Usage: PRINTIFY_TOKEN=your_token bash scripts/printify-lookup.sh
TOKEN="${PRINTIFY_TOKEN:?Set PRINTIFY_TOKEN first}"
H="Authorization: Bearer $TOKEN"

echo "=== SHOPS (your shop ID is here) ==="
curl -s -H "$H" https://api.printify.com/v1/shops.json | python3 -m json.tool

SHOP_ID=$(curl -s -H "$H" https://api.printify.com/v1/shops.json | python3 -c "import sys,json; shops=json.load(sys.stdin); print(shops[0]['id'])" 2>/dev/null)
echo ""
echo ">>> Auto-detected shop ID: $SHOP_ID"

echo ""
echo "=== MUG providers (blueprint 68) — pick a US one ==="
curl -s -H "$H" "https://api.printify.com/v1/catalog/blueprints/68/print_providers.json" \
  | python3 -c "import sys,json; [print(f\"  id={p['id']}  {p['title']}  ({p.get('location',{}).get('country','?')})\") for p in json.load(sys.stdin)]"

echo ""
echo "=== SHIRT providers (blueprint 12 = Bella+Canvas 3001) — pick a US one ==="
curl -s -H "$H" "https://api.printify.com/v1/catalog/blueprints/12/print_providers.json" \
  | python3 -c "import sys,json; [print(f\"  id={p['id']}  {p['title']}  ({p.get('location',{}).get('country','?')})\") for p in json.load(sys.stdin)]"

# Auto-pick first US provider for each and print variants
MUG_PID=$(curl -s -H "$H" "https://api.printify.com/v1/catalog/blueprints/68/print_providers.json" \
  | python3 -c "import sys,json; p=[x for x in json.load(sys.stdin) if 'United States' in x.get('location',{}).get('country','')]; print(p[0]['id'] if p else '')" 2>/dev/null)

SHIRT_PID=$(curl -s -H "$H" "https://api.printify.com/v1/catalog/blueprints/12/print_providers.json" \
  | python3 -c "import sys,json; p=[x for x in json.load(sys.stdin) if 'United States' in x.get('location',{}).get('country','')]; print(p[0]['id'] if p else '')" 2>/dev/null)

if [ -n "$MUG_PID" ]; then
  echo ""
  echo "=== MUG variants (provider $MUG_PID) ==="
  curl -s -H "$H" "https://api.printify.com/v1/catalog/blueprints/68/print_providers/$MUG_PID/variants.json" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); vs=d.get('variants',d) if isinstance(d,dict) else d; [print(f\"  id={v['id']}  {v['title']}\") for v in vs]"
fi

if [ -n "$SHIRT_PID" ]; then
  echo ""
  echo "=== SHIRT variants (provider $SHIRT_PID) ==="
  curl -s -H "$H" "https://api.printify.com/v1/catalog/blueprints/12/print_providers/$SHIRT_PID/variants.json" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); vs=d.get('variants',d) if isinstance(d,dict) else d; [print(f\"  id={v['id']}  {v['title']}\") for v in vs]"
fi

echo ""
echo "=== SUMMARY — paste these into Supabase secrets ==="
echo "PRINTIFY_SHOP_ID=$SHOP_ID"
echo "PRINTIFY_MUG_PRINT_PROVIDER_ID=$MUG_PID"
echo "PRINTIFY_SHIRT_PRINT_PROVIDER_ID=$SHIRT_PID"
echo "(copy variant IDs above and set PRINTIFY_MUG_VARIANT_IDS and PRINTIFY_SHIRT_VARIANT_IDS)"
