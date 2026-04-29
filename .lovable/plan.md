## Goal

Five additions, each built on what's already shipped — no duplicate infra, no new paid services. Cost-conscious throughout.

## Cost-saving audit (what we're NOT spending money on)


| Need                    | Free path we'll use                                                                                                 | What we'd be paying for if we got lazy      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Checkout event tracking | Existing `processed_stripe_events` table (`fulfillment_status`, `fulfillment_error`) — already populated by webhook | Stripe Sigma ($), Segment ($), Mixpanel ($) |
| CSV export              | Browser-side `Blob` + `URL.createObjectURL` — no edge function, no S3                                               | Server-rendered exports (CPU + egress)      |
| Audit log               | Postgres trigger on `prospector_targets` → `prospector_targets_audit` table                                         | Datadog audit logging, third-party SaaS     |
| Realtime updates        | Supabase Realtime (already free with Cloud)                                                                         | Pusher, Ably                                |
| Beta toggle             | Pure client-side filter on `usMetros.ts` data                                                                       | Feature-flag SaaS (LaunchDarkly $$)         |
| Upsell banner           | Static link to `/site-radar` checkout                                                                               | Ad/upsell platforms                         |


No new secrets, no new vendors, no edge functions added unless required.

## Changes

### 1. Checkout events admin dashboard (no new tables)

- New page `src/pages/admin/AdminCheckoutEvents.tsx` reads from existing `processed_stripe_events`:
  - Filters: event_type (chip filter), fulfillment_status (pending/completed/failed), date range.
  - Surfaces `event_type`, `fulfillment_status`, `fulfillment_error`, `processed_at`.
  - Realtime subscription so failures appear instantly.
  - "SiteRadar only" quick filter (`event_type ilike '%site_radar%'` plus checkout.session.completed rows where stored metadata.type matches).
- Webhook tweak (`supabase/functions/stripe-webhook/index.ts`): when `meta.type === "site_radar_subscription"`, also write `event_type` value `site_radar_subscription` into `processed_stripe_events` (today it just records the raw Stripe event type) so the filter is meaningful. One-line update at the existing `markFulfilled` call site — no new table, no new column.
- Route: `/dwa-admin/checkout-events` behind `AgencyAdminRoute`. Add nav tile in admin hub.
- **No edge function added.** All client-side reads via existing service-role-bypassed RLS already in place for admins.

### 2. TechAlert metro picker beta toggle

- `src/pages/HireAlert.tsx`:
  - Replace the inline `?all=1` URL check with a small toggle component placed next to the metro `<select>`:
    - Pill toggle: `**Beta markets only` ↔ `All markets (admin preview)**`
    - Visible only when `useIsAdmin().isAdmin === true` OR when `?all=1` is present (preserves existing manual override).
    - Active state colors: teal `#00d4ff` for "Beta only" (default), amber `#fbbf24` for "All markets" with a warning banner: *"Showing coming-soon markets — these aren't bookable yet."*
  - Counter line: *"Showing N of M markets"* always rendered so the filter status is unambiguous.
  - The `<option>` label keeps the existing `(coming soon)` suffix for non-beta entries.

### 3. prospector_targets audit log

- New migration `supabase/migrations/<ts>_prospector_targets_audit.sql`:
  - Table `public.prospector_targets_audit` (id uuid pk, target_id uuid, city, state, trade, old_active bool, new_active bool, changed_by uuid, changed_at timestamptz default now()).
  - RLS: `ENABLE ROW LEVEL SECURITY`, service_role bypass, SELECT for `has_role(auth.uid(),'admin')`.
  - Trigger `prospector_targets_audit_trg` AFTER UPDATE on `prospector_targets` WHEN `OLD.active IS DISTINCT FROM NEW.active`:
    - Inserts row with `changed_by = auth.uid()`. (Toggles via the admin UI go through the user JWT, so `auth.uid()` is populated.)
- New page `src/pages/admin/AdminProspectorTargetsAudit.tsx`:
  - Table view with city/state/trade chips, old → new badge (red→green or vice versa), changed_by (joined to `auth.users.email` via existing helper view if present, else display UUID with copy button), changed_at relative time.
  - Date range filter, CSV export of audit rows.
  - Route `/dwa-admin/market-targeting/audit` (AgencyAdminRoute). Link from `AdminMarketTargeting` header: "View audit log →".

### 4. /my-site-radar — Export Events CSV

- Add controls above the events table in `src/pages/MySiteRadar.tsx`:
  - Two date inputs (`from`, `to`, defaulting to last 30 days).
  - Export button (teal). On click:
    - Re-queries `crm_visitor_events` for `client_id = c.id` filtered by date range (no LIMIT 100 cap for export).
    - Builds CSV client-side: `created_at,company_name,city,page_visited,referrer,utm_source,utm_medium,utm_campaign` (only columns we already store; verify columns and gracefully omit nulls).
    - Triggers download via `Blob` + temporary `<a download="siteradar-events-YYYYMMDD.csv">` — no server roundtrip, no cost.
  - Disable button + show spinner while query runs. Toast on success ("Exported N events") / failure.
  - Date inputs also filter the on-screen list (keeps UI consistent with what gets exported).

### 5. /my-site-radar upsell banner

- Above the events table, render a sticky-on-scroll banner:
  - **If client has no `visitor_script_key` or status≠active:** copy is "Start tracking visitors today — $49/mo" → CTA "Start SiteRadar" → links to `/site-radar`.
  - **If active:** copy is "Bundle SiteRadar with Lead Capture for $99/mo (save $49/mo)" → CTA "Upgrade" → links to `/site-radar?bundle=1` (we'll have the landing page read `?bundle=1` and preselect the bundle plan; if bundle plan not implemented yet, falls back to standard checkout — graceful no-op).
  - DWA brand: teal accent, dark `#0a1628` background, dismissible via localStorage flag `siteradar_upsell_dismissed_v1` (resets after 14 days so we don't permanently lose the upsell surface).

## Files to add

- `src/pages/admin/AdminCheckoutEvents.tsx`
- `src/pages/admin/AdminProspectorTargetsAudit.tsx`
- `supabase/migrations/<ts>_prospector_targets_audit.sql`

## Files to edit

- `src/pages/MySiteRadar.tsx` — date filters, Export CSV, upsell banner
- `src/pages/HireAlert.tsx` — beta/all toggle UI + counter
- `src/pages/admin/AdminMarketTargeting.tsx` — link to audit log
- `src/App.tsx` — register `/dwa-admin/checkout-events` and `/dwa-admin/market-targeting/audit`
- `supabase/functions/stripe-webhook/index.ts` — record `meta.type` alongside Stripe event type for SiteRadar branch (and any other branches we touch in passing) in `processed_stripe_events`

## Notes / open question

- For #1, today `processed_stripe_events.event_type` stores the **Stripe** event name (e.g. `checkout.session.completed`). To filter by *product* we need the metadata type. Lowest-cost option: add a nullable `product_type` column via a tiny migration and write `meta.type` into it from the webhook (one column, indexed). Alternative: filter purely on Stripe event types and date range, which is fuzzier. **I recommend the one-column migration** — costs nothing at runtime and makes the dashboard genuinely useful. Confirm or veto in your approval. Confirm. 
- Audit log `changed_by` will be NULL for any toggle done via service-role (e.g. seeded data). That's expected — we'll display `system` in the UI when null.
- No new edge functions = no new cold-start cost, no new monthly egress.

Approve and I'll execute end-to-end and report back in one message.