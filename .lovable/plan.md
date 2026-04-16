

# Full System Audit — Launch Readiness Report

## Summary
After auditing the database (250+ tables), 611 edge functions, 351 routes, 41 secrets, and all RLS policies, here's what needs fixing before launch weekend.

---

## CRITICAL ISSUES (Must Fix)

### 1. `hire_alert_runs` — 0 rows (Scanner cron likely dead)
The TechAlert scanner hasn't logged a run since April 15. There are 148 candidates but 0 runs logged, meaning the daily cron that scans LARA/BPL/Apollo is either not executing or failing silently. The public stats page shows empty data. **This is your flagship product.**
- **Fix**: Re-verify the `hire-alert-scanner-daily` cron schedule exists and runs. Check edge function logs for errors.

### 2. Missing DWA Agent Tables: `outreach_cooldowns` + `campaign_copy_variants`
These tables are referenced by `dwa-operator` and `dwa-closer` edge functions but don't exist in the database. Both agents will crash on every execution.
- **Fix**: Run migration to create both tables from Phase 8 spec.

### 3. `contractor_lead_views` — Missing RLS policies
Only table in the entire database with NO RLS policies. Currently RLS is enabled but with no policies, meaning zero access.
- **Fix**: Add service_role and admin read policies.

### 4. `postcard_campaigns.audience_type` — Not persisting
The column exists and the edge function code sets `audience_type: audience`, but all rows show NULL. The deployed edge function may be an older version that doesn't include the `audience_type` insert field.
- **Fix**: Redeploy `generate-postcard-copy` edge function to pick up the latest code.

### 5. `/web-design` — Missing route (404)
No route for `/web-design` exists in App.tsx. Common URL that prospects would type. Only `/web-design-services` and `/detroit-web-design` exist.
- **Fix**: Add redirect route from `/web-design` → `/web-design-services`.

### 6. 10 agent heartbeats stale since April 4
Oz, Scarlett, Selma, Ops, Mute, Pulse, Scout, Hype, Drill, Ref — all show `last_beat = 2026-04-04`. These were seeded but have never actually run. Only Tom, Shield, Cashier, industry-pulse-scanner, and hire-alert-scanner show recent beats.
- **Fix**: Either activate these agent crons or remove stale heartbeat rows to avoid false monitoring signals.

---

## MODERATE ISSUES

### 7. Contractor Lead Purchases — 0 rows
29 leads exist but 0 purchases. Either no contractors have bought leads, or the purchase flow has a bug.

### 8. Agent heartbeats table missing `status` column
CLAUDE.md references `agent_heartbeats.status` but the table only has `id, agent_name, last_beat, metadata`. Admin UI components that reference `status` will fail.
- **Fix**: Add `status TEXT DEFAULT 'ok'` column.

### 9. Dead Lead Campaigns — low data
Only 3 campaigns and 6 contractor clients. Functional but thin for demo purposes.

---

## VERIFIED WORKING ✅

| System | Status | Details |
|--------|--------|---------|
| **Build** | ✅ Clean | 0 errors, Vite 5.4.19, ready in 538ms |
| **All 250+ tables** | ✅ RLS ON | Every table has RLS enabled (except `contractor_lead_views` — no policies) |
| **41 secrets** | ✅ All present | Stripe, Twilio, Resend, Anthropic, Lovable, Firecrawl, PDL, etc. |
| **TechAlert checkout** | ✅ Returns Stripe URL | `create-hire-alert-checkout` returns checkout session |
| **FieldDesk checkout** | ✅ Returns Stripe URL | `create-field-service-checkout` works |
| **Contractor lead notify** | ✅ Notified 8 | SMS delivery working |
| **Postcard copy generation** | ✅ AI generates 3 variants | Gemini via Lovable AI Gateway works, stores to DB |
| **Dead lead stats page** | ✅ Function boots | Returns 404 only for invalid tokens (expected) |
| **ROI report page** | ✅ Function boots | Returns 404 only for invalid tokens (expected) |
| **`sms_opt_outs` table** | ✅ Exists | TCPA compliance table present |
| **`suppressed_emails` table** | ✅ Exists | Email suppression working |
| **`chargeContractor` bug** | ✅ FIXED | `res.ok` check now on line 45 |
| **Email activity** | ✅ 209 emails (7d) | Resend sending |
| **Comms log** | ✅ 58 entries (7d) | Unified SMS+email logging |
| **Tom agent** | ✅ Active | Last heartbeat today 12:00 UTC |
| **Shield agent** | ✅ Active | Last heartbeat today 11:00 UTC |
| **Cashier agent** | ✅ Active | Last heartbeat today 10:00 UTC |
| **Auth system** | ✅ Working | Matt's session active, admin role assigned |
| **351 routes** | ✅ All defined | App.tsx compiled clean |
| **Profiles** | ✅ 24 users | 1 admin role (Matt) |

---

## Implementation Plan

### Migration 1: Fix missing tables + columns
```sql
-- outreach_cooldowns (DWA agent anti-collision)
CREATE TABLE IF NOT EXISTS public.outreach_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_email TEXT NOT NULL,
  last_agent TEXT NOT NULL,
  last_contacted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.outreach_cooldowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access outreach_cooldowns" ON public.outreach_cooldowns FOR ALL TO service_role USING (true) WITH CHECK (true);

-- campaign_copy_variants (DWA A/B testing)
CREATE TABLE IF NOT EXISTS public.campaign_copy_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.dead_lead_campaigns(id),
  variant_label TEXT NOT NULL,
  sms_body TEXT NOT NULL,
  selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.campaign_copy_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access campaign_copy_variants" ON public.campaign_copy_variants FOR ALL TO service_role USING (true) WITH CHECK (true);

-- contractor_lead_views RLS
CREATE POLICY "Service role full access contractor_lead_views" ON public.contractor_lead_views FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can read contractor_lead_views" ON public.contractor_lead_views FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- agent_heartbeats status column
ALTER TABLE public.agent_heartbeats ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ok';
```

### Route Fix: `/web-design` redirect
Add to App.tsx:
```tsx
<Route path="/web-design" element={<Navigate to="/web-design-services" replace />} />
```

### Redeploy `generate-postcard-copy`
The function code already has `audience_type` but the deployed version may be stale. Force redeploy.

### Investigate hire-alert-scanner cron
Check edge function logs for `hire-alert-scanner` failures. May need cron re-creation if it's using the broken `current_setting('app.supabase_url')` pattern.

---

## What Still Needs Manual Testing (Browser)
After fixes are deployed:
1. Login as admin → verify `/admin` loads all tabs
2. Click every DWA product CTA on `detroitwebagent.com`
3. Test TechAlert checkout flow end-to-end
4. Test FieldDesk checkout flow
5. Test Dead Lead intake form
6. Test Missed Call Catch checkout
7. Verify postcard prospects load (38 should show)
8. Verify postcard campaigns load with audience badges
9. Test mobile nav on all DWA pages
10. Verify M2 Training branding on `mattmichelstraining.com`

