## Scope

Build 12 UI/UX upgrades across the DWA product suite. Most backend edge functions already exist (`enrich-visitor`, `claim-session`, `create-customer-portal-session`, `create-site-radar-checkout`, `nps-survey-sender`, `site-radar-health-check`). This plan focuses on UI, two new tables, and one URL fix.

## Database changes (one migration)

1. `client_nps_scores` — `id`, `client_email`, `product` (text), `score` (int, nullable for YES/NO), `raw_reply` (text), `surveyed_at` (timestamptz), `milestone_day` (int: 30/60/90), unique(client_email, product, milestone_day). RLS: admin-only read, service-role insert.
2. `missed_call_captures` — `id`, `caller_number`, `city`, `voicemail_transcript`, `text_sent`, `reply_received`, `status` (default 'new'), `google_review_sent_at`, `created_at`. RLS: admin-only.

## Pages & components

### 1. `/my-site-radar` (new page `MySiteRadar.tsx`)
- Auth: read `?token=`, query `field_crm_clients` by `dispatch_token`. If invalid → "Invalid or expired link."
- Cards: today's visitor count, businesses identified count.
- Top 5 companies list (from `crm_visitor_events` joined/aggregated by company).
- Real-time feed: subscribe to `crm_visitor_events` realtime channel filtered by `client_id`. Each row shows page, timestamp, company (green dot if business), "Enrich" button → invokes `enrich-visitor`.
- Health indicator: green if any event in last 24h, red otherwise.
- Tracking snippet panel with copy button (uses `visitor_script_key`).
- Brand: DWA dark teal (#00d4ff / #0a1628).
- Route added to `App.tsx`.

### 2. `/site-radar` (new landing `SiteRadarLanding.tsx`)
- Hero, 3 feature cards, $49/mo pricing, CTA → `create-site-radar-checkout`.
- Success state on `?success=1` with `<PostCheckoutClaim />`.

### 3. `<PostCheckoutClaim />` shared component (`src/components/checkout/PostCheckoutClaim.tsx`)
- Reads `?session_id=` on mount → POST to `claim-session`.
- Shows "Check your inbox — login link sent" with spinning mail icon (lucide `Mail` + animate-spin).
- Drop into success blocks of: FieldDesk, TechAlert, Healthcare HireAlert, SiteRadar, Missed-Call, Mortgage Radar, AI Phone Answering, Bundle Revenue Suite (8 pages — locate each `?success=1` block and inject).

### 4. Missed Call Leads admin tab (DWAAdmin)
- New tab "📞 Missed Call Leads" in `DWAAdmin.tsx`.
- Table from `missed_call_captures`: caller, city, voicemail (truncate 60), text sent, reply, status badge (new=blue, in-progress=yellow, resolved=green), "Mark Resolved" action.

### 5. "Manage billing" buttons
- Add ghost button in footer of `MyMissedCall.tsx`, `MyMortgageRadar.tsx`, `MyContractorLeads.tsx`, `MyTechAlert.tsx`, and field-service-dispatch page → invokes existing `create-customer-portal-session` with `{ email }`, `window.location.href = url`.

### 6. AdminClientHealth upgrade
- Add `Status` column with traffic-light chip per row: 🟢 ≤7d activity + paid, 🟡 7–14d, 🔴 14d+ or inactive/Stripe not active.
- "MRR at Risk" total card at top (sum of monthly price for 🔴 rows; pull pricing from a small map keyed by product).
- Filter toggle: All / At Risk / Danger.
- Add "Last NPS" mini-cell per row pulling latest `client_nps_scores` row by `client_email + product`.

### 7. NPS email templates
- Create 4 React Email templates in `supabase/functions/_shared/email-templates/`: `nps-techalert.tsx`, `nps-fielddesk.tsx`, `nps-mortgage-radar.tsx`, `nps-missed-call.tsx`.
- TechAlert subject: "Quick question from Matt — did TechAlert help you hire this month?" Body: YES/NO ask.
- Others: "How likely are you to recommend [Product]…" 1–10 ask.
- Confirm `nps-survey-sender` already wires templates+milestones; if not, add a small TODO comment (function is owned by Claude side — UI side only ships templates + table).

### 8. `<EmptyDashboardState />` component
- Props: `productName`, `checklist: string[]`, `etaText`, `setupGuideHref`.
- Render in `MyTechAlert`, `MyMortgageRadar`, `MyContractorLeads`, field-service-dispatch when their primary list is empty. Friendly onboarding visual, not error.

### 9. "Forgot password?" links
- Add to `Auth.tsx` and to email-lookup forms in `MyMissedCall.tsx`, `MyMortgageRadar.tsx` → `Link to="/reset-password"`.

### 10. Competitor intercept toggle in MyMissedCall
- New section "Google Maps Coverage" with on/off Switch (UI state only, persisted to localStorage), explanatory copy, and "Contact us to provision" mailto button to `matt@detroitwebagency.com`.

### 11. `<StickyMobileCTA label onClick />`
- Fixed bottom on mobile (`md:hidden`), DWA brand styling.
- Add to `/hire-alert`, `/field-service`, `/missed-call-text`, `/mortgage-radar`, `/site-radar`, `/ai-phone-answering`, `/bundle-revenue-suite`. Wire to each page's existing primary CTA action.

### 12. Bundle Revenue Suite success URL fix
- In `supabase/functions/create-bundle-revenue-suite-checkout/index.ts`, change `success_url` to `${origin}/bundle-revenue-suite?status=success&session_id={CHECKOUT_SESSION_ID}`. Redeploy function.

## Tech notes

- Use existing `useAuth`, `lazyRetry`, supabase client (`@/integrations/supabase/client`).
- All routes registered with `lazyRetry` in `App.tsx`.
- All new tables get RLS + service_role bypass policy per project rules.
- Status column queries `created_at` / `last_activity_at` (or equivalent timestamp already present on each table in `SERVICE_TABLES`); for tables missing such a column, fall back to `created_at`.
- After all changes: redeploy `create-bundle-revenue-suite-checkout`.

## Out of scope (already shipped or owned by Claude side)
- `claim-session`, `create-customer-portal-session`, `create-site-radar-checkout`, `enrich-visitor`, `nps-survey-sender`, `missed-call-status` voicemail capture, `site-radar-health-check`. These exist; UI just wires to them.
