# Marketplace Polish — Finish the Remaining 4 Fixes

We already shipped the FirstLookUpsellGate cooldown last turn. This plan closes the last 4 P0/P1 items so every à la carte vertical (`/mortgage-leads`, `/talent-leads`, `/demand-leads`, `/supply-leads`, `/growth-leads`) is sellable with confidence.

---

## 1. Backfill `signal_strength_tier` (P0 — biggest confidence killer)

**Problem (verified in DB):**
```
mortgage: 89 NULL / 1 warm
talent:   229 NULL / 1 cool
supply:   187 NULL
demand:   14 NULL
growth:   0 leads
```
Buyers click HOT/WARM/COOL filters → empty results. Looks broken.

**Fix — derive tier from `score` at the view level so it's always populated:**

Migration that updates `unified_lead_marketplace_view` to compute tier when NULL:
```sql
COALESCE(
  signal_strength_tier,
  CASE
    WHEN score >= 8 THEN 'hot'
    WHEN score >= 5 THEN 'warm'
    ELSE 'cool'
  END
) AS signal_strength_tier
```
No data writes — pure view logic, instantly correct for all 520 existing leads, and any new lead with a score gets a tier automatically.

---

## 2. Honest empty-inventory state for `growth-leads` (P0)

**Problem:** Empty `growth` shows "No leads match your filters" + "Clear filters" — implies user error.

**Fix in `src/pages/Marketplace.tsx`:** distinguish three states in the grid block:
- `loading` → spinner (unchanged)
- `leads.length === 0` (no inventory) → new "Restocking" state:
  > "Fresh `Growth Leads` are being scored right now. New batches drop every 15 min for First Look subscribers, every 60 min for everyone else."  
  > [Get notified when stocked] (uses `BuyerEmailDialog` → existing `marketplace-watch-add` w/ `product` only)  
  > [Browse other verticals] → links to populated products
- `filtered.length === 0` (filters too tight) → existing "No leads match" + Clear filters

---

## 3. Active-chip auto-scroll + clearer fade (P1)

**Problem:** On 344px viewport, the active product chip gets hidden behind the right-edge fade and never scrolls into view.

**Fix in `src/pages/Marketplace.tsx` product switcher:**
- Add `ref` to the active chip, `useEffect` on `product` change → `scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })`
- Add a matching left-edge fade (currently only right) so it's symmetric
- Add `aria-current="page"` for a11y

Same treatment for the tier filter row.

---

## 4. Loading resilience — don't let one failure block both (P1)

**Problem:** `Promise.all([leads, locks])` — if the locks query errors (e.g. RLS hiccup), the spinner stays forever and we never render leads.

**Fix in `src/pages/Marketplace.tsx`:**
- Switch to `Promise.allSettled`
- Set `leads` and `soldIds` independently from each result
- Always `setLoading(false)` in a `finally`
- If leads errors, show an inline error banner + Retry button instead of an empty grid

---

## Technical Details

| File | Change |
|---|---|
| `supabase/migrations/2026XXXX_marketplace_tier_fallback.sql` | `CREATE OR REPLACE VIEW public.unified_lead_marketplace_view` with `COALESCE(signal_strength_tier, CASE…)` derived from `score`. Re-grant SELECT to `anon, authenticated`. |
| `src/pages/Marketplace.tsx` | (a) Empty-inventory branch with notify CTA; (b) active-chip ref + `scrollIntoView` for product + tier rows; (c) `Promise.allSettled` + error banner + Retry; (d) left-edge fade. |

No new edge functions, no schema changes beyond the view, no breaking changes to existing buyer flow. Existing `marketplace-watch-add` already accepts a product-only watch (no `lead_id`) for "notify on restock" — we'll reuse it.

---

## What stays the same
- Pricing logic (`src/lib/marketplacePricing.ts`)
- Checkout flow (`create-marketplace-lead-checkout`)
- FirstLookUpsellGate (already patched last turn)
- Share-link flow (`/lead/share/:token`)

## Out of scope
- Building new `growth-leads` inventory (separate sourcing job — Tom agent territory)
- Buyer dashboard / receipt UX (already audited clean)

---

**Approve and I'll ship all 4 in one pass.**