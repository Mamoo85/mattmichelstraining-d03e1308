

## Sitewide Pricing & Copy Overhaul

This is a large, coordinated change across ~12 files to move from a 4-tier system (Basic/Foundation/Custom/Team-Elite) to a 3-tier system (Foundation/Pro/Elite) with new pricing and marketing copy, plus a Team inquiry card.

---

### Files to Change

#### 1. `src/hooks/useAuth.tsx` — Global tier constants
- Rename `TIERS` keys: `basic` → `foundation`, `foundation` → `pro`, `custom` → `elite`. Remove `team_elite`.
- Update display names: "The Foundation" ($19.99), "Pro (Semi-Custom)" ($149.99), "Elite (1-on-1)" ($349.99)
- Update `ANNUAL_TIERS` to match: Foundation $199.99, Pro $1,499.99, Elite $3,499.99
- Keep existing Stripe price IDs as placeholders (mark with comments)
- Update `TierKey` type, `TIER_DISCOUNTS`, `getTierByProductId`

#### 2. `src/pages/Pricing.tsx` — Full redesign
- Replace `TIER_CARDS` with 3 cards using the exact headlines/pitches from the prompt
- Card 1 (Foundation $19.99): "20 Years of Iron Game Knowledge in Your Pocket."
- Card 2 (Pro $149.99, highlighted "Most Popular"): "YouTube Can't Watch You Squat. I Can."
- Card 3 (Elite $349.99): "Undivided Attention. Zero Guesswork."
- Add a 4th non-purchasable Team card: "Team & Organization Programming", "Custom Bid", mailto CTA
- Change grid to `lg:grid-cols-4` (3 tiers + team)
- Update `TIER_COLS` comparison table to 3 columns (remove basic)
- Update SEO description from "$12.99" to "$19.99"
- Update hero/value banner copy
- **Add FAQ accordion section** below pricing grid with the 3 Q&As from the prompt
- Import `Accordion` components from `@/components/ui/accordion`

#### 3. `src/components/landing/MembershipTiers.tsx`
- Replace 3-card array: Foundation ($19.99), Pro ($149.99), Elite ($349.99) with new names/copy
- Update highlight to Pro card

#### 4. `src/pages/Index.tsx`
- Update FAQ schema: change "$12.99/mo" to "$19.99/mo", "Basic" references to "Foundation"

#### 5. `src/pages/ForParents.tsx`
- Update SEO description: "$12.99/mo" → "$19.99/mo"

#### 6. `src/pages/FreeAiGenerator.tsx`
- Replace line 284 copy with: "I built this AI engine myself and tested it a million times. It is fueled exclusively by my 20 years of in-the-trenches sports science data. No generic internet fluff. I guarantee its effectiveness. - Coach Matt"
- Update upsell CTA: "$12.99/mo" → "$19.99/mo"

#### 7. `src/pages/TrialWelcome.tsx`
- Rename trial paths: "basic" → "foundation", update to Foundation/Pro/Elite tier names and pricing
- Update `autoChargeLabel` to reflect new tier names/prices
- Update `TrialPathCard` content for Foundation ($19.99), Pro ($149.99), Elite ($349.99)

#### 8. `src/components/landing/OnlineServices.tsx`
- Replace 4-card grid with 3 cards: Foundation $19.99, Pro $149.99, Elite $349.99
- Update descriptions

#### 9. `src/components/landing/M2Difference.tsx`
- Change "$12.99/mo" → "$19.99/mo" in copy

#### 10. `src/components/landing/TechShowcaseMarketing.tsx`
- Change all "$12.99" references to "$19.99"

#### 11. `src/components/landing/FirstMonthPromo.tsx`
- Update strikethrough price from "$12.99" to "$19.99", auto-renew copy

#### 12. `src/pages/Welcome.tsx`
- No direct pricing references found — no changes needed

#### 13. `supabase/functions/trial-day6-email/index.ts`
- Update tier names and prices in email HTML

---

### Technical Details

- The `TierKey` union type changes from `"basic" | "foundation" | "custom" | "team_elite"` to `"foundation" | "pro" | "elite"`
- All downstream consumers of `TierKey` (e.g., `useTierAccess`, `TIER_DISCOUNTS`, checkout flows) will be updated to use the new keys
- The Team card on Pricing.tsx will be a static card with a `mailto:` link — no Stripe integration
- FAQ section uses existing `Accordion` UI components already in the project
- Stripe price IDs will be kept as placeholder strings with `// TODO: replace with real Stripe price ID` comments

