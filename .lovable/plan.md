

## Free Taste Strategy — Per Product

Plain English: each product gets the cheapest "free taste" mechanic that doesn't burn margin or break ad rules. No Stripe trials on Contractor Leads (you can't ad-spend trials). Free first-lead on Dead Reactivation. Sneak peeks (no card) on Buyer/Demand Radar. Real Stripe trials on Talent Radar + Industry Pulse. Newsletter stays free + becomes the top-of-funnel for everything.

### What gets which offer

| Product | Offer | Why |
|---|---|---|
| **Dead Lead Reactivation** | **First positive reply FREE, $50 each after** | Already wired — `free_dead_leads_quota` column exists. Just default to `1`. |
| **Contractor Leads ($399/mo)** | No trial. Keep "30-day refund if zero leads" + 3 free seed leads on signup. | Can't run paid ads to trials. Refund guarantee = same psychology, no Stripe trial-end disputes. |
| **Buyer Radar (Ameristeel)** | **Sneak Peek**: email-gated 1-week sample feed (no card), then $X/mo | Enterprise B2B — they want to see the data before card-on-file. |
| **Demand Radar / Industry Pulse** | **Sneak Peek**: 5 free signals via magic link, then **7-day Stripe trial** on the $199 tier | Already has `snapshot` $99 one-time — keep it, add trial on `weekly` tier. |
| **Talent Radar / TechAlert** | **3-day "phantom alert" preview** (already exists at `/hire-alert-trial`) → convert to paid | Don't touch — it works. Just surface it harder on the landing page. |
| **Newsletter (Field Rep Weekly)** | Already free. Add **footer CTA** rotating between Buyer/Demand/Talent Radar sneak peeks. | Free top-of-funnel to feed the radar products. |
| **Mortgage Radar** | Already has `trial_period_days: 7`. ✅ Leave alone. | |

---

### What I'll build

**1. Dead Lead — default quota = 1 + landing copy**
- New migration: `ALTER TABLE contractor_clients ALTER COLUMN free_dead_leads_quota SET DEFAULT 1;`
- Update `DeadLeadIntake.tsx` headline + `FreeBoostCard.tsx`: "Your first reply is FREE. $50 per reply after that."
- Update outreach SMS template in `_shared/sms-templates.ts`: `dead_lead_free_first_v1`
- Existing `handle-dead-lead-reply` charge logic already respects `used < quota` — no code change needed.

**2. Buyer Radar Sneak Peek**
- New page `/buyer-radar-preview` — email capture form, no auth.
- New edge function `buyer-radar-sneak-peek` — generates a magic-link token, emails 5 sample signals (Detroit-area fab/metal NAICS) via Resend with "upgrade to see live feed" CTA.
- Token gives 7-day read access to a stripped-down `MyBuyerRadar` view.

**3. Demand Radar / Industry Pulse — add trial on $199 tier**
- Edit `create-industry-pulse-checkout/index.ts`: add `subscription_data: { trial_period_days: 7 }` to the `weekly` tier only.
- Add 5-signal sneak peek edge function `industry-pulse-sneak-peek` mirroring Buyer Radar pattern.
- New `/demand-radar-preview` landing.

**4. Talent Radar — boost existing trial visibility**
- `HireAlert.tsx`: add a hero CTA strip "👀 See 3 days of alerts free, no card" above the pricing. Routes to existing `/hire-alert-trial`.
- No backend changes.

**5. Newsletter footer CTA rotator**
- Edit `newsletter-send/index.ts`: add `getRotatingRadarCTA()` helper that picks one of (Buyer/Demand/Talent) sneak-peek links per send. Inserts above unsubscribe.

**6. Admin visibility**
- New row in `AdminDWAOverview.tsx`: "Free Taste Funnel" — counts of sneak-peek signups (last 7 days) per product, conversion %.

---

### Legal / TCPA notes

- **Dead Lead first-free**: same EBR rules apply. Already enforced (548-day cutoff in `dead-lead-intake` + `dead-lead-drip`). No new exposure.
- **Sneak peek emails**: CAN-SPAM only (email, not SMS). Footer needs unsubscribe — `dwaEmail()` wrapper already includes it.
- **Stripe trials on Industry Pulse**: must show "Cancel anytime — $199 charges Day 8" on checkout button per FTC ROSCA rule. Will add to `IndustryPulse.tsx` CTA.

---

### What I won't build (and why)

- **Trial on Contractor Leads** — you said no, and I agree (ad-spend rules + chargeback risk).
- **Trial on FieldDesk / Missed Call** — keep refund guarantee. Adding trials creates day-7 involuntary churn.
- **New newsletter** — you already have the Field Rep Weekly Newsletter. We just need to use it as the funnel. No new product.

---

### Files touched (technical detail)

**New:**
- `supabase/migrations/20260423140000_dead_lead_default_quota_one.sql`
- `supabase/functions/buyer-radar-sneak-peek/index.ts`
- `supabase/functions/industry-pulse-sneak-peek/index.ts`
- `src/pages/BuyerRadarPreview.tsx`
- `src/pages/DemandRadarPreview.tsx`

**Edited:**
- `supabase/functions/_shared/sms-templates.ts` — add `dead_lead_free_first_v1`
- `supabase/functions/create-industry-pulse-checkout/index.ts` — add `trial_period_days: 7` on weekly tier
- `supabase/functions/newsletter-send/index.ts` — add rotating radar CTA
- `src/pages/DeadLeadIntake.tsx` + `src/components/contractor/FreeBoostCard.tsx` — copy update
- `src/pages/HireAlert.tsx` — surface trial CTA
- `src/pages/IndustryPulse.tsx` — trial disclosure on weekly tier button
- `src/components/dwa-admin/AdminDWAOverview.tsx` — sneak peek funnel row
- `src/App.tsx` — 2 new public routes
- `supabase/config.toml` — `verify_jwt = false` for 2 new functions

Reply "go" and I'll ship it in build mode.

