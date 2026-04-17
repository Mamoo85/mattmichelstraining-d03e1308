
User wants me to run a focused diagnostic audit (read-only) on three specific concerns + deliver 10 actionable recommendations. No code edits. Just analysis.

Plan:

## Diagnostic Audit + 10 Enhancements (Read-Only)

**Three focused diagnostic checks:**

1. **Stripe webhook idempotency** — Read `supabase/functions/stripe-webhook/index.ts`. Does it dedupe on `event.id`? If `checkout.session.completed` fires twice (Stripe retry), does it double-SMS the customer, double-insert the client row, double-charge?

2. **Dead lead drip TCPA cutoff** — Read `supabase/functions/dead-lead-drip/index.ts`. Verify the 18-month EBR check actually short-circuits BEFORE Twilio send. Confirm `last_contact_date` is populated correctly at intake. Check if expired leads get marked terminal vs silently retried tomorrow.

3. **hire-alert-scanner LARA failure mode** — Read `supabase/functions/hire-alert-scanner/index.ts`. If a LARA fetch 403s or times out, does the function crash (killing the other parallel scans) or does `Promise.allSettled()` isolate it? Check error logging.

For each: report findings as **PASS / FAIL / RISK** with file:line evidence and the smallest possible fix recommendation (no code).

**Then deliver 10 enhancements grounded in actual files I've read:**

- **5 Product/Marketing**: pricing, onboarding, copy friction. Examples of what I'll look for: TechAlert checkout email collection, DemandRadar tier anchoring, AgencyPortal demo token visibility, FieldDesk pricing page CTA, dead-lead-intake form length.

- **5 Admin/System**: Things in `/admin` and `/dwa-admin` that waste Matt's time. Concrete examples: API burn-rate ticker (Sonar credit usage), Twilio "Nuke" kill switch for rogue campaigns, single "Today's Money" tile combining all revenue tables, paused-cron health card, opt-out trend chart.

**Output format:** One scannable response. Three diagnostic verdicts up top. Ten enhancements grouped 5+5 below. Each enhancement has: what it is, where it lives (file/path), why it matters in one sentence. No essays.

**Files to read during audit:**
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/dead-lead-drip/index.ts`
- `supabase/functions/dead-lead-intake/index.ts` (for `last_contact_date` population)
- `supabase/functions/hire-alert-scanner/index.ts`
- `src/pages/AgencyPortal.tsx`, `src/pages/DemandRadarPortal.tsx`, `src/pages/HireAlert.tsx`, `src/pages/DemandRadar.tsx`
- `src/pages/DWAAdmin.tsx` + key admin tab components
- `src/pages/Admin.tsx` if relevant

No edits. No tests written. No fake percentages. Just verdicts + recommendations.

Approve and I'll run it.
