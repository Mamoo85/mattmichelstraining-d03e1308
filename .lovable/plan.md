# Fix 5 Outreach Console Issues

## 1. "Create failed: [object Object]" on New Campaign

**File:** `src/components/dwa-admin/Wave5OutreachConsole.tsx` (NewCampaignDialog, ~line 388)

**Root cause:** Two issues likely:
- Toast prints `${error.message}` but the supabase error object's `message` is empty when RLS rejects → `[object Object]`. The `outreach_campaigns` table only has a `service_role` policy, so admin inserts from the browser (anon/authenticated JWT) get blocked.
- No `created_by` set.

**Fix:**
- Add an RLS policy allowing admins to insert/select/update via `public.has_role(auth.uid(), 'admin')` (migration). Mirror pattern used by `command_center_tiles` ("admin all").
- In `create()`, stringify the full error (`error.message || JSON.stringify(error)`) and log it for visibility.
- Set `created_by` from the current session.

## 2. Command Center Tabs — replace paste-URL with searchable dropdown (Lovable Connectors style)

**Files:** `src/components/admin/AdminMarketingTools.tsx` (CommandCenterTabs, ~line 206) — and reuse the same widget in any customer-facing portal that exposes this.

**Plan:**
- Build a curated catalog `src/lib/commandCenterCatalog.ts` of ~60 common SaaS tools (Gmail, Stripe, QBO, FieldServio, eWay, MITN, Slack, HubSpot, Salesforce, Jobber, ServiceTitan, Housecall Pro, Calendly, Zoom, Notion, Linear, GitHub, Drive, Calendar, LinkedIn, Meta, Twilio, Supabase, Resend, Apollo, Hunter, Lob, Sinch, etc.) — each entry: `{ id, label, url, emoji, category }`.
- Replace the textarea + sync button with a shadcn `Command` (cmdk) combobox: type-ahead search, grouped by category, multi-select. Keep a "Custom URL…" option that opens a small modal for one-off pastes.
- On select → insert tile rows the same way `syncPaste` does (label/emoji come from catalog).
- Keep the inline edit / reorder / delete UI below unchanged.
- Apply the same component to the customer-facing equivalent (any place where tabs are exposed to clients — search confirms it currently lives only in admin; if a customer surface is added later it reuses this component).

## 3. Targeting Engine returns "0 new, 0 total"

**File:** `supabase/functions/targeting-prospect-scraper/index.ts`

**Root causes:**
- `fetchNursingHomes` filters CMS rows by `zipPrefixes` for the entered county. "Wayne" maps in `zipsForCounty`, but the CMS query is hardcoded `state=MI` and limited to 500 rows total — Wayne nursing-home ZIPs may not appear in the first 500 alphabetic rows. Result: 0 found.
- Same issue across other audiences: Sonar prompt phrasing ("supply house", "trades_staffing") often returns 0 from Perplexity.

**Plan:**
- For CMS sources, paginate (offset 0/500/1000) until `limit` collected matches OR query directly with `provider_state=MI` AND `provider_zip_code IN (...)` conditions instead of post-filtering.
- For NPI calls, raise `limit` per call and fall back to county-wide loop.
- For Sonar audiences, add structured trade keyword fallbacks (e.g. nursing_home → also query Google Places via existing `GOOGLE_MAPS_API_KEY` channel-prospector code path) and log a `debug.sources` array in the response so admins see which source returned what.
- Surface the debug info in `FindProspects.runScrape` — show "0 new (CMS: 12, after-zip-filter: 0)" so misnamed audiences/counties are obvious.

## 4. Email Campaign sends 0 / no toast detail

**Files:** `src/components/dwa-admin/OutreachCommandCenter.tsx` (`handleDispatchAction`, ~line 988) + `supabase/functions/send-email-campaign/index.ts`

**Root causes likely:**
- Campaign was created in "draft" with 0 prospects matched (audience/state filter mismatch). The function returns `{ sent: 0, failed: 0 }` and toast shows `"✅ 0 sent · 0 failed"` — looks like success.
- "Edge Function returned a non-2xx status code" toast on Mortgage Radar SMS suggests an unrelated 500.

**Plan:**
- In the edge function: when 0 prospects match, return `{ ok:false, reason:"no_matching_prospects", filter:{audience, states} }` with 200 + a clear message.
- In `handleDispatchAction`, surface `data.reason` in toast (warn) when sent=0.
- Add a "Diagnose" pre-flight that already exists — auto-run it before "Send" and refuse to dispatch if `ready === 0`.
- Investigate the mortgage digest 500 separately (`supabase--edge_function_logs mortgage-radar-am-digest` next session) — it is independent of Email Campaigns.

## 5. "Send via Gmail" button greyed out

**File:** `src/components/dwa-admin/AdminAgencyOutreach.tsx` (line 468)

**Root cause:** `disabled={!enrich?.contact_email || sending === agency.name}`. The button greys out when contact enrichment didn't return an email. Right now Acro Service Corp shows tags `employer` + `phone` but no `email` — Apollo found a phone but no verified email.

**Plan:**
- Keep the "needs email" gate but show a tooltip ("Enrich contact to fetch email — Apollo returned phone only") explaining *why* it is disabled.
- Add an inline "Add email manually" link → small input → stored on the enrichment record so Matt can override when he knows the address.
- Add a `gmail-send-outreach` health check button that posts a test request and surfaces credential errors (matches the pattern used elsewhere).

## Technical Details

- **Migration:** add admin RLS to `outreach_campaigns` (insert/select/update via `has_role(auth.uid(),'admin')`), matching `command_center_tiles`.
- **No new tables.** `commandCenterCatalog.ts` is a static TS file.
- **No edge-function changes** for #5 beyond a manual-email-override field (added to `agency_enrichments` if that table exists; otherwise stored in component state).
- Toast helper: a `formatSupabaseError(e)` util that handles Postgrest error shape so we never show `[object Object]` again — drop into `src/lib/`.

## Out of scope this round
- Mortgage Radar digest 500 (separate investigation).
- Customer-facing port of Command Center Tabs widget — codebase has no customer surface for it yet; the same component is ready to drop in when one is built.
