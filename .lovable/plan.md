

# Final Gap-Fill Plan — Marketplace v2.1

## Audit (honest)

5 of your 7 bullets are already shipped from Sessions 1–3. Re-doing them = waste. Here's the truth:

| # | Item | Status |
|---|---|---|
| 1 | Locked/Unlocked/Sold cards + PDF + share-token | ✅ Built (Session 1+2) |
| 2 | GoldenTicketCard + filters + watch/dismiss | ✅ Built (cards + filters live; dismiss persists to localStorage) |
| 3 | marketplace-track-view endpoint | ✅ Built (Session 1) |
| 4 | marketplace-lead-summarize | ✅ Built (Session 1) |
| 5 | marketplace-lead-equity-enrich | ✅ Built (Session 1) |
| 6 | **Receipts Inbox** | ❌ Missing |
| 7 | **Upsell Gate (subscribe for faster access)** | ❌ Missing |

Plus one small bug worth fixing while we're in there: `Marketplace.tsx` has `soldIds = []` hardcoded so `SoldDossierCard` never renders even when leads are sold.

---

## What we'll build

### 1. Receipts Inbox — `/marketplace/receipts`
Buyer enters their email (cached in localStorage from prior purchase) → sees every dossier they've bought.

**New edge function:** `marketplace-buyer-receipts`
- POST `{ buyer_email }` → returns array of `marketplace_lead_locks` rows where `status='sold'` and `buyer_email` matches, joined with lead summary fields from `unified_lead_marketplace_view`.
- For each row, generate a fresh 30-day signed PDF URL by calling `marketplace-generate-dossier-pdf` (cached if PDF already in `lead-dossier-pdfs` bucket).
- Returns: `{ purchases: [{ lead_id, product, purchased_at, amount_cents, pdf_url, share_token_url, lead_summary, provenance: [...] }] }`

**New page:** `src/pages/MarketplaceReceipts.tsx`
- Email entry → fetches receipts → grid of compact "receipt cards"
- Each card: product badge, purchase date, amount, lead headline, three buttons:
  - 📄 **Download PDF** (opens signed URL)
  - 🔗 **Share (redacted)** (calls `marketplace-share-token` to mint new 7-day link, copy to clipboard)
  - 📋 **View Provenance** (expands inline showing `provenance_source_urls` audit trail with timestamps + source labels)
- Route: `/marketplace/receipts` added to `App.tsx`
- Link added in Marketplace header: `📁 My Receipts`

### 2. Upsell Gate — "Subscribe for First Look"
A new subscription tier that unlocks **faster access** (sees new hot leads 1 hour before public) without paying per-lead.

**Migration:** `marketplace_first_look_subscribers` table
- columns: `id`, `email`, `product` (mortgage/talent/demand/growth/supply or 'all'), `stripe_customer_id`, `stripe_subscription_id`, `status` ('active'|'cancelled'), `created_at`
- RLS: service_role only

**New edge function:** `create-marketplace-first-look-checkout`
- Stripe subscription checkout: $49/mo single product or $129/mo all-products
- `metadata.type = "marketplace_first_look_subscription"`

**stripe-webhook handler:** new branch for `marketplace_first_look_subscription` → upserts row, sends welcome email via `dwaEmail`.

**Frontend gate component:** `src/components/marketplace/FirstLookUpsellGate.tsx`
- Triggers on the **3rd lead view** in a session (tracked via localStorage `mp_views_session`)
- Modal overlay: shows the **single highest-scored unlocked sample lead** (a real `UnlockedDossierCard` for one demo lead) so buyer sees what they'd get
- Two CTAs:
  - "Continue browsing" (dismisses for 24h via localStorage)
  - "Get First Look — $49/mo" → calls checkout function
- Suppressed entirely if `localStorage.mp_first_look_subscriber === buyer_email`
- Suppressed if buyer has any existing purchase (we already know their email)

**Hot-lead delay logic:** `marketplace-saved-search-notifier` cron (already shipped) gets a 1-line update — if `signal_strength_tier='hot'` AND lead is < 1 hour old AND no first-look subscriber matches → skip this run, wait for next cycle. Subscribers get the 15-minute alert; everyone else waits an hour.

### 3. Bug fix (5-line change)
`Marketplace.tsx` lines 35 + initial-load query: fetch sold lead IDs once on mount via `marketplace_lead_locks WHERE status='sold' AND product=X` so `SoldDossierCard` actually renders for sold inventory (currently invisible — buyers think everything's available).

---

## Files

**New:**
- `supabase/functions/marketplace-buyer-receipts/index.ts`
- `supabase/functions/create-marketplace-first-look-checkout/index.ts`
- `src/pages/MarketplaceReceipts.tsx`
- `src/components/marketplace/FirstLookUpsellGate.tsx`
- `supabase/migrations/<ts>_marketplace_first_look.sql`

**Edited:**
- `src/App.tsx` — add `/marketplace/receipts` route
- `src/pages/Marketplace.tsx` — fetch sold IDs, mount `<FirstLookUpsellGate />`, add "📁 My Receipts" link
- `supabase/functions/stripe-webhook/index.ts` — add `marketplace_first_look_subscription` handler
- `supabase/functions/marketplace-saved-search-notifier/index.ts` — 1-hour public delay for hot leads
- `supabase/config.toml` — `verify_jwt = false` for the 2 new functions

---

## What I'm explicitly NOT doing

- Re-creating GoldenTicketCard / Locked / Unlocked / Sold cards (already exist)
- Re-creating `marketplace-track-view`, `marketplace-lead-summarize`, `marketplace-lead-equity-enrich` (already shipped Session 1)
- Re-adding `ProvenanceTooltip` (already exists; will reuse it inside receipts inline expander)
- PDF / share-token edge functions (already shipped Session 2)

---

## Estimated scope

~2 hours. One ship.

