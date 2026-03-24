# Restore Point — Before New Membership Changes
**Created:** 2026-03-24
**Purpose:** Snapshot of all key files before upcoming membership/billing changes.

## Key Files at This Point
| File | Notes |
|------|-------|
| `src/components/billing/FamilyBilling.tsx` | Family plan management UI |
| `src/components/billing/PaywallGate.tsx` | Paywall gate component |
| `src/components/billing/SubscriptionGuard.tsx` | Subscription guard wrapper |
| `src/components/billing/TrialCTA.tsx` | Trial call-to-action |
| `src/components/billing/TrialPaywallModal.tsx` | Trial paywall modal |
| `src/components/billing/CheckoutConfirmationModal.tsx` | Checkout confirmation |
| `src/components/pricing/AnnualUpsellCard.tsx` | Annual upsell card |
| `src/components/landing/MembershipTiers.tsx` | Membership tier display |
| `src/hooks/useAuth.tsx` | Auth & tier definitions |
| `src/hooks/useTierAccess.tsx` | Tier access logic |
| `src/hooks/useTrialStatus.tsx` | Trial status hook |
| `src/pages/Pricing.tsx` | Pricing page |

## How to Restore
Revert each file listed above to the git commit prior to any membership redesign changes.
