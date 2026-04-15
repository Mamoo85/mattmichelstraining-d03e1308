

# Sales Enablement Sandbox (Demo Zone)

## What We're Building

A fully isolated demo environment that lets Matt present all 4 core DWA products (Contractor Leads, TechAlert, FieldDesk, Dead Lead Reactivation) in live Zoom calls and trade shows — without touching production data, charging real cards, or texting real people.

## Current State

- FieldDesk already has `clientId === "demo"` bypass in DispatchBoard and TechMap with hardcoded demo jobs/locations
- MyTechAlert has no demo mode — it requires a real client token
- No universal demo token exists
- No mock data seeding utility exists
- No communication sinkhole (all SMS/email routes to real recipients)

---

## Architecture: 3 Components

### 1. Universal Demo Token (`?token=DWA_DEMO_MASTER`)

**Files to modify:**
- `src/pages/MyTechAlert.tsx` — detect `DWA_DEMO_MASTER` token, load mock data instead of querying real DB, bypass all Stripe/claim guards
- `src/pages/FieldServiceDispatch.tsx` — accept `DWA_DEMO_MASTER` as demo trigger
- `src/pages/ContractorLeads.tsx` / dead lead pages — bypass paywall when token present
- **New file: `src/components/DemoModeBadge.tsx`** — subtle floating badge ("DEMO MODE") rendered when token detected, positioned in header

**Behavior:**
- URL: `?token=DWA_DEMO_MASTER` on any product page activates demo mode
- All paywall/Stripe checkout buttons become no-ops (show toast "Demo: Checkout bypassed")
- Claim, Fast-Track, Draft Outreach buttons all work but route to sinkhole (see #3)
- Badge: small teal pill in top-right corner — "🔒 DEMO MODE"

### 2. Mock Data Seeder (`seed-demo-environment`)

**New edge function: `supabase/functions/seed-demo-environment/index.ts`**
- Admin-only (checks admin email or auth)
- Generates:
  - 5 fake contractor leads (tagged `is_demo_record = true`) — realistic Metro Detroit addresses, trade types, homeowner names like "John Doe", "Jane Smith"
  - 5 fake TechAlert candidates (tagged `is_demo_record = true`) — mix of boiler/HVAC/healthcare, realistic names, license numbers, qualifications summaries, scores 6-9
  - 3 fake dead lead contacts with a demo campaign
- All records get `is_demo_record = true` flag so they never appear in production analytics or real client dashboards

**Database migration:**
- Add `is_demo_record boolean DEFAULT false` to: `contractor_leads`, `hire_alert_candidates`, `dead_lead_contacts`, `dead_lead_campaigns`
- Add filter `WHERE is_demo_record = false` to all production cron queries (hire-alert-scanner, dead-lead-drip, contractor-lead-notify) — prevents demo data from triggering real automation

**Admin UI:**
- Add "🎭 Seed Demo Data" button in DWA Command Deck (one-click invoke)
- Add "🧹 Clear Demo Data" companion button

### 3. Communication Sinkhole (Safe Routing)

**Files to modify:**
- `supabase/functions/_shared/twilio.ts` — add `isDemoMode` parameter to `sendSMS()`. When true, override `to` phone with `ADMIN_PHONE` (+13138064952) and prepend "[DEMO]" to message body
- `supabase/functions/generate-outreach-draft/index.ts` — when demo flag present, route email drafts to matt@mattmichelstraining.com instead of candidate
- `supabase/functions/claim-candidate/index.ts` — when demo flag, skip real DB claim, return mock success
- `supabase/functions/fast-track-interview/index.ts` — when demo flag, send SMS to admin phone only

**How demo flag propagates:**
- Frontend detects `DWA_DEMO_MASTER` token → passes `is_demo: true` in all API calls to edge functions
- Edge functions check `is_demo` in request body → route comms to admin instead of real recipients
- All demo SMS/emails get "[DEMO]" prefix so Matt can distinguish them on his phone

---

## Files Summary

| File | Action |
|------|--------|
| `src/components/DemoModeBadge.tsx` | Create — floating demo indicator |
| `src/pages/MyTechAlert.tsx` | Modify — demo token detection, mock data loading |
| `src/pages/FieldServiceDispatch.tsx` | Modify — accept demo master token |
| `supabase/functions/seed-demo-environment/index.ts` | Create — mock data generator |
| `supabase/functions/_shared/twilio.ts` | Modify — sinkhole routing for demo SMS |
| `supabase/functions/claim-candidate/index.ts` | Modify — demo bypass |
| `supabase/functions/fast-track-interview/index.ts` | Modify — demo sinkhole |
| `supabase/functions/generate-outreach-draft/index.ts` | Modify — demo email routing |
| `src/components/dwa-admin/DWACommandDeck.tsx` | Modify — add seed/clear buttons |
| Migration | Add `is_demo_record` column to 4 tables |

## Demo Day Flow (What Matt Does)

1. Admin panel → click "Seed Demo Data" (one-time setup)
2. Open `detroitwebagent.com/my-techalert?token=DWA_DEMO_MASTER` on Zoom screen share
3. Show TechAlert dashboard with 5 realistic candidates, full scores, qualifications
4. Click "Claim Candidate" → works, shows success (no real DB mutation)
5. Click "Fast-Track Interview" → Matt's phone buzzes live on camera with "[DEMO] Hi John, we'd like to schedule..."
6. Switch to `/field-service/dispatch?token=DWA_DEMO_MASTER` → show FieldDesk dispatch board
7. All paywall gates bypassed — prospect sees the full product without any checkout interruption

