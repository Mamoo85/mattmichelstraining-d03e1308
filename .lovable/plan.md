

# Condense Membership Copy & Update Custom/Team Tiers Sitewide

## What Changes

**Custom tier** — stripped down to two value props: free online assessment + custom programming. Local members get 20% off every in-person session where Matt teaches them their custom workout personally. Private sessions are extra (not included).

**Team/Elite tier** — add "optional 30-min monthly video chat" as a feature.

**All tiers** — condense bullet points. Kill the "Everything in X" stacking pattern. Each tier states only what it adds. Shorter, punchier copy.

## Files to Edit

### 1. `src/pages/Pricing.tsx` (TIER_CARDS array, lines 29-86)
- **Basic**: 3-4 short bullets (exercise library, daily workouts, monthly challenges, progress logging)
- **Foundation**: 3-4 bullets (8-week training blocks, Fix It library, coach form feedback, real programming)
- **Custom**: "Free online assessment", "Custom program built by Matt", "Local? 20% off every session — Matt teaches you the program in person", "Direct message Coach Matt", remove Family Pack / gift session bullets. Subtitle updated.
- **Team/Elite**: Add "Optional 30-min video chat monthly", keep roster/team management bullets condensed. Remove "Everything in Custom" stacking.
- Update `badge` on Custom to reflect "Free Assessment · 20% Off In-Person (Private Sessions Extra)"
- Update Family Pack callout below grid (lines 446-467) to note "Private sessions extra"

### 2. `src/components/landing/MembershipTiers.tsx` (For Parents page)
- Same condensed copy for Basic/Foundation/Custom
- Custom highlights: "Free online assessment", "Custom program from Matt", "Near GPP? 20% off sessions — learn your workout in person", "(Private sessions extra)"

### 3. `src/components/billing/TrialPaywallModal.tsx` (lines 15-38)
- Condense perks arrays for all 3 tiers
- Custom: "Free online assessment", "Custom program", "20% off in-person sessions (private sessions extra)"

### 4. `src/pages/TrialWelcome.tsx` (lines 190-220)
- Update `desc` strings for parent/custom paths
- Custom: "Free assessment + custom program from Matt. Local? 20% off every session. (Private sessions extra)"

### 5. `supabase/functions/trial-day6-email/index.ts` (lines 42-47)
- Update email copy with correct prices ($12.99, $19.99, $49.99, $99.99) and condensed descriptions
- Custom: "Custom program + free assessment. 20% off in-person. (Private sessions extra)"
- Team: add "optional monthly video chat"

### 6. `src/components/landing/BringAFriendCard.tsx`
- No structural change needed — referral card is fine as-is

### 7. Stripe Product Descriptions
- Audit Stripe product descriptions for Custom and Team/Elite to match new copy (via stripe tools)

## Copy Direction (condensed)

| Tier | Bullets |
|------|---------|
| **Basic** | Exercise library (200+) · 10 daily workouts · Monthly challenges · Progress logging |
| **Foundation** | 8-week training blocks · Fix It recovery library · Coach form feedback · Real programming, not random workouts |
| **Custom** | Free online assessment · Custom program built by Matt · 20% off every in-person session (Matt teaches you your workout) · Direct coach messaging · (Private sessions extra) |
| **Team/Elite** | Full-season team programming · Roster management · Bulk workout assignment · Optional 30-min video chat monthly |

