# Final Pre-Sale QA — Bugs Found + "Wow" Upgrades

I ran a real customer click-through on `/mortgage-leads` (mobile, 390px, the viewport 70%+ of LO buyers will land on). Stopped after 4 actions because I had enough findings — all 5 verticals share `Marketplace.tsx`, so every fix below applies to all of them at once.

## What's working (don't touch)

- Tier backfill is live: HOT (34), WARM (26), COOL filters all populate ✓
- 60 leads loaded fast, locks query parallel, no spinner hang
- Card design (HOT badge + score bars + source provenance + wax-seal CTA) is genuinely strong
- Trust strip ("Single-buyer guarantee · Refund if uncontactable · Cross-referenced sources") is good copy
- Active product chip is centered and visible

## Bugs found (ranked by sale-killing severity)

### P0 — Trust / brand confusion
**The M² Training fitness bottom nav (`Home / Portal / Shop / Schedule / More`) renders on every marketplace page.** A loan officer paying $49 for a refi lead sees "Shop" and "Schedule a workout." Instant credibility hit. Plus it physically clips the orange "Unlock Full Dossier · $49" button. Fix: add the 5 marketplace routes + `/lead/` + `/marketplace` + `/b2b-leads` + `/storm-damage-leads` to the existing `HIDDEN_PATHS` array in `BottomTabBar.tsx`.

### P0 — Performance: N+1 edge function storm
Every visible card fires its own `marketplace-track-view` POST on mount. **60 leads = 60 separate edge function invocations**, each 500–900ms, all racing in parallel, hammering Supabase. Fix:
- New endpoint `marketplace-track-views-bulk` that accepts `{ visitor_hash, product, lead_ids: [...] }`, does ONE bulk insert + ONE viewer-count query.
- `Marketplace.tsx` calls it once after leads load. Removes 59 round trips.
- Keep per-card `viewers_now` by returning `{ [lead_id]: count }` map and passing into each `LockedDossierCard` via prop instead of the card fetching itself.

### P1 — "REDACTED ST" looks like a placeholder bug
Every locked card hard-codes the literal string `"REDACTED ST,"` next to the city. To a buyer this reads "broken template." Fix in `LockedDossierCard.tsx`:
> 🔒 **REDACTED · Detroit, MI 48221** · 4 active equity signals nearby

Use the actual city/state/zip we already have, present the redaction as intentional intel-tradecraft (lock icon + "Address unlocks at purchase"), and add a contextual nearby-signals teaser — competitors don't do this.

## "Wow" visual upgrades — beat every competitor

### 1. Live activity ticker in hero
Right now the hero is static text. Add a single line under the tagline that auto-rotates every 4s:
> 🔴 LIVE · 3 leads sold in last hour · 12 LOs viewing now · Next batch drops in 14 min

Pulls from existing `marketplace_buyer_views` + `marketplace_lead_locks` tables — no new schema. Creates urgency the moment they land.

### 2. Subtle hero animation
Numbers in the trust strip count up on load (`0 → 60 live leads`, `0 → 34 HOT`). framer-motion already in deps. One-time on mount, never repeats — feels expensive, not gimmicky.

### 3. Floating "How it works" peek
A tiny 32px chip in the corner: `?? How this works (15s)`. Opens a slide-up sheet:
1. Pick a HOT lead (we score 1–10)
2. Pay once — single buyer, refund if uncontactable
3. Get full dossier + verified phone in 60 sec
4. Call them while they're still hot

Removes the #1 first-time-buyer hesitation: "what am I actually getting?"

### 4. Promote "My Receipts" to a real button
Currently it's a small ghost outline. Make it primary-looking once `mp_buyer_email` exists in localStorage (returning buyer) — they want to find their purchases fast.

### 5. Sold-card social proof
When a `SoldDossierCard` is shown, replace "Sold" with `Sold to a Detroit LO · 2h ago`. Already have `created_at` on the lock — just expose anonymized tier+region. Makes empty slots feel like FOMO instead of dead inventory.

### 6. Sticky "What you get" mobile reassurance bar
A 28px sticky bar pinned just above the (now-removed) bottom nav:
> ✓ Verified phone · ✓ TCPA-clean · ✓ Refund if bad · 🔒 Single buyer

Constant trust reinforcement during scroll. Disappears once user scrolls back to top.

---

## Files I'll touch

| File | Change |
|---|---|
| `src/components/layout/BottomTabBar.tsx` | Add marketplace routes to `HIDDEN_PATHS` |
| `supabase/functions/marketplace-track-views-bulk/index.ts` | NEW — bulk view tracker, returns viewer-count map |
| `src/pages/Marketplace.tsx` | Single bulk call after leads load · live activity ticker · count-up trust strip · promoted Receipts CTA · sticky reassurance bar · How-it-works sheet |
| `src/components/marketplace/LockedDossierCard.tsx` | Drop per-card track-view fetch · accept `viewersNow` prop · replace "REDACTED ST" with intel-styled redacted address + nearby-signal teaser |
| `src/components/marketplace/SoldDossierCard.tsx` | "Sold to a Detroit LO · 2h ago" social-proof line |
| `src/components/marketplace/HowItWorksSheet.tsx` | NEW — 15-second explainer slide-up |
| `src/components/marketplace/LiveActivityTicker.tsx` | NEW — rotating live-stat strip |

No DB migrations. No new secrets. No breaking changes to checkout, share-link, or receipts flows.

## Out of scope
- Adding inventory to `growth-leads` (sourcing job, not UI)
- Stripe checkout itself — already verified working in prior tests

**Approve and I'll ship all 9 in one pass.**