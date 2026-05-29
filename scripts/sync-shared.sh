#!/usr/bin/env bash
# sync-shared.sh — keeps shared Supabase utilities in sync between main and frontend.
#
# Run this after changing any file in supabase/functions/_shared/
# or after changing PRODUCT_CREATION_PROTOCOL.md.
#
# Usage:
#   ./scripts/sync-shared.sh          # dry-run (shows what would change)
#   ./scripts/sync-shared.sh --apply  # actually copies the files

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAIN_SHARED="$ROOT/supabase/functions/_shared"
FRONT_SHARED="$ROOT/frontend/supabase/functions/_shared"
APPLY="${1:-}"

# Files that must stay identical between main and frontend
SYNCED_FILES=(
  "ai.ts"
  "twilio.ts"
)

echo "=== sync-shared.sh ==="
echo "Main:     $MAIN_SHARED"
echo "Frontend: $FRONT_SHARED"
echo ""

any_diff=0

for file in "${SYNCED_FILES[@]}"; do
  src="$MAIN_SHARED/$file"
  dst="$FRONT_SHARED/$file"

  if [ ! -f "$src" ]; then
    echo "⚠️  MISSING in main: $file"
    continue
  fi

  if [ ! -f "$dst" ]; then
    echo "⚠️  MISSING in frontend: $file"
    any_diff=1
    if [ "$APPLY" = "--apply" ]; then
      cp "$src" "$dst"
      echo "   ✅ Copied to frontend"
    fi
    continue
  fi

  if diff -q "$src" "$dst" > /dev/null 2>&1; then
    echo "✅ $file — identical"
  else
    echo "❌ $file — DIFFERS"
    diff "$src" "$dst" | head -20 || true
    any_diff=1
    if [ "$APPLY" = "--apply" ]; then
      cp "$src" "$dst"
      echo "   ✅ Synced frontend ← main"
    fi
  fi
done

echo ""
if [ "$APPLY" != "--apply" ]; then
  if [ $any_diff -eq 1 ]; then
    echo "Run with --apply to sync differences."
    exit 1
  else
    echo "All shared files are in sync. No action needed."
  fi
else
  echo "Sync complete."
fi
