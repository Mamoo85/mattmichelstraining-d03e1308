

# Audit & Fix: 9 Issues Across DWA Admin, Dead Leads, TechAlert, Automation Hub

## Issue 1: DJ Conley Demo Button → 404
**Root cause**: AdminDWAOverview links to `/demo-djconley-v2` but App.tsx only has route `/demo-djconley-2` (no "v").
**Fix**: Change the href in `AdminDWAOverview.tsx` from `/demo-djconley-v2` to `/demo-djconley-2`. Also fix `AdminDemoLinkGenerator.tsx` paths similarly.

## Issue 2: Edge Function Errors (Simulation Suite page)
The execution log shows 5 ERROR functions. These functions exist in the codebase but are not deployed:
- `contractor-aged-lead-downsell` — Daily cron, blasts $15 cold leads to contractors after 48h unclaimed
- `license-expiry-checker` — Scans `license_monitor_items` for upcoming expirations, emails clients
- `release-pending-replies` — Releases ghost-delayed email drafts from `email_reply_drafts` after delay expires
- `hire-alert-phantom-alert` — Daily FOMO: sends "X candidates found near you" to trial/expired TechAlert users
- `hire-alert-trial-convert` — Checks 72h trial expiry, sends conversion email with checkout link

**Fix**: Deploy all 5 functions. Add CORS headers + OPTIONS handlers to each so they work from the browser Simulation Suite.

## Issue 3: Dead Lead Campaigns — "Could not find table" error
**Root cause**: The `dead_lead_campaigns` table does not exist in the database. It was referenced in code but the migration was never applied.
**Fix**: Create migration for `dead_lead_campaigns`, `dead_lead_contacts`, and related columns (`stripe_payment_method_id`, `dead_lead_billing_active` on `contractor_clients`). Also create `dead_lead_charges` table.

## Issue 4: Field CRM Clients — Can't click on clients + snippet link error
**Root cause**: The `AdminFieldCRMClients.tsx` client cards have no clickable detail view. The "Get Tracking Snippet" button works (copies to clipboard) but clicking on a client card does nothing — no detail panel, no drill-down. Also the snippet URL uses the wrong Supabase URL (hardcoded fallback to secondary project `zmyczlfuufhngzovkjdh`).
**Fix**:
- Add a clickable detail panel for each client showing: visitor events feed, tracking snippet, edit form, website link
- Fix the `SUPABASE_URL` fallback to use the primary project URL

## Issue 5: TechAlert — Scanner runs monitoring seems pointless
**Root cause**: The `hire_alert_runs` table is empty (scanner hasn't been run successfully yet). The "Recent Scanner Runs" section only shows when data exists. Without data, the page looks bare.
**Fix**: Add a "Run Scanner Now" button directly on the TechAlert Clients page (not just in Simulation Suite). Show last run time prominently. Add a "No scanner runs yet — click to run first scan" prompt.

## Issue 6: Automation Hub — No clickable links
**Root cause**: The Automation Hub page (image 82) has "Run Scan Now" / "Send Now" buttons that invoke edge functions, but no links to the actual product pages, admin CRM panels, or client management. It's a wall of cards with no navigation.
**RULE**: Never have an admin page without navigation links to related pages.
**Fix**: Add links on every automation card:
- Link to the product's public page (e.g., `/dark-web-monitor`, `/trademark-watch`)
- Link to the product's admin CRM section (where applicable)
- "View Clients" link for each product

## Issue 7: Simulation Suite — Many edge functions are dead/killed products
**Root cause**: The Simulation Suite references functions for killed products. Based on the CLAUDE.md "Products Killed" list: AI Blog Post Writing, AI Press Release Engine, AI Social Caption Pack, AI Proposal Generator, AI Sales Script Generator, AI Review Response, AI Bedtime Stories, AI Children's Stories, AI Sermon Prep, AI Obituary Service. The Automation Hub still shows cards for some of these.
**Fix**: Audit both AdminSimulationSuite and AdminAutomationHub. Remove cards/buttons for killed products. Cross-reference with the killed products list.

## Issue 8: OpsCenter — Don't count fake test accounts
**Root cause**: `AdminOpsCenter.tsx` counts ALL rows in each client table, including test entries (like "Test", "Field Test Co", "Test Co" seen in the Field CRM clients screenshot). This inflates MRR and client counts.
**Fix**: Filter out test accounts by excluding rows where `business_name` or `email` contains "test" (case-insensitive), or where `status = 'pending'` and name contains test patterns. Add a visible "Excluding X test accounts" note.

## Issue 9: Automation Hub — Audit for killed products
Same as Issue 7. The AutomationHub.tsx still shows cards for products that were killed. Remove them.

---

## Files to Change

| File | Change |
|------|--------|
| `src/components/admin/AdminDWAOverview.tsx` | Fix DJ Conley demo link path |
| `src/components/admin/AdminDemoLinkGenerator.tsx` | Fix demo link paths |
| `supabase/functions/contractor-aged-lead-downsell/index.ts` | Add CORS headers |
| `supabase/functions/license-expiry-checker/index.ts` | Add CORS headers |
| `supabase/functions/release-pending-replies/index.ts` | Add CORS headers |
| `supabase/functions/hire-alert-phantom-alert/index.ts` | Add CORS headers |
| `supabase/functions/hire-alert-trial-convert/index.ts` | Add CORS headers |
| New migration | Create `dead_lead_campaigns`, `dead_lead_contacts`, `dead_lead_charges` tables + contractor_clients columns |
| `src/components/admin/AdminFieldCRMClients.tsx` | Add clickable client detail panel + fix Supabase URL |
| `src/components/admin/AdminHireAlertClients.tsx` | Add "Run Scanner" button + empty state prompt |
| `src/components/admin/AdminAutomationHub.tsx` | Remove killed product cards + add navigation links |
| `src/components/admin/AdminSimulationSuite.tsx` | Remove killed product buttons |
| `src/components/admin/AdminOpsCenter.tsx` | Filter out test accounts from counts |
| Deploy 5 edge functions | `contractor-aged-lead-downsell`, `license-expiry-checker`, `release-pending-replies`, `hire-alert-phantom-alert`, `hire-alert-trial-convert` |

