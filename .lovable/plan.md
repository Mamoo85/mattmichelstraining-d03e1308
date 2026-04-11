

# Bug Fix Roundup — 9 Issues from Screenshots

## Issues Identified

1. **Prospector delete confirmation uses browser `confirm()` dialog** — Replace with silent delete (no confirmation prompt) per your request.

2. **Bottom navbar (HOME/PORTAL/SHOP/SCHEDULE) showing on `/dwa-admin`** — The `HIDDEN_PATHS` array in `BottomTabBar.tsx` includes `/admin` but NOT `/dwa-admin` or `/field-service`. Need to add both.

3. **"Could not find table 'public.field_service_clients'"** — The table doesn't exist. The actual table is `field_crm_clients`. `DWAClientRoster.tsx` and `DWAStats.tsx` reference `field_service_clients` — need to change all references to `field_crm_clients` and map the column names (e.g., `company_name` → `business_name`).

4. **Live Map says "Map requires Google Maps API key"** — The `TechMap.tsx` component reads `VITE_GOOGLE_MAPS_API_KEY` but you already have `GOOGLE_MAPS_API_KEY` as a secret (server-side only). Need to either: (a) add `VITE_GOOGLE_MAPS_API_KEY` as a client-side env var, or (b) use an edge function proxy. Since Google Maps JS API keys are public, we can add it as a VITE_ var directly. However, the `.env` file is auto-managed. The simpler fix: hardcode the API key reference or fetch it via an edge function. Will use an edge function to proxy the key.

5. **Google shows "M² Training | Real Strength Coaching" for detroitwebagent.com** — This is a Google indexing/SEO issue with the custom domain. The site likely needs its own `<title>` and meta tags when served on the DWA domain. Need to check if AgencyHome or the field-service pages set proper SEO meta for the DWA domain. This is partially outside our control (Google re-crawl timing), but we should ensure the correct meta tags are in place.

6. **Visitor-identify script test** — Already tested, it works. The script you shared is functional. No code fix needed.

7. **"Failed to log review blast"** — The `review_blast_log` table has RLS enabled but only has a SELECT policy for admin. No INSERT policy exists. Need to add an INSERT policy for admin users.

8. **"Failed to send a request to the Edge Function" (Regulatory Change Monitor)** — The edge function exists but may have deployment issues. Will check logs and redeploy.

9. **"Failed to add tech"** — Same RLS issue as #7. The `tech_locations` table only has a SELECT policy for admin, no INSERT policy. Need to add INSERT/UPDATE/DELETE policies for admin.

## Implementation Plan

### Migration (1 SQL file)
Add missing RLS policies to fix issues #7 and #9:
- `review_blast_log`: INSERT, UPDATE, DELETE for admin
- `tech_locations`: INSERT, UPDATE, DELETE for admin
- Also audit `field_crm_clients` for same missing policies (DWAClientRoster inserts there)

### Code Changes

**`src/components/layout/BottomTabBar.tsx`** — Add `/dwa-admin` and `/field-service` to `HIDDEN_PATHS`

**`src/components/dwa-admin/DWAClientRoster.tsx`** — Change `field_service_clients` → `field_crm_clients`, map `company_name` → `business_name`

**`src/components/dwa-admin/DWAStats.tsx`** — Same table name fix

**`src/components/dwa-admin/DWARecentJobs.tsx`** — Fix `field_service_clients` reference

**`src/components/dwa-admin/DWADataImport.tsx`** — Fix table reference

**`src/components/admin/AdminProspector.tsx`** — Remove `confirm()` calls on delete, just delete immediately

**`src/components/field-service/TechMap.tsx`** — Fix Google Maps API key loading (use edge function or fetch from secrets)

**`src/pages/AgencyHome.tsx`** (or relevant DWA pages) — Ensure correct SEO title/description for detroitwebagent.com domain

### Edge Function
- Redeploy `regulatory-monitor-scan` to fix the failed request

### Order
1. Run migration (RLS policies)
2. Fix all `field_service_clients` → `field_crm_clients` references
3. Fix BottomTabBar hidden paths
4. Remove confirm() dialogs from Prospector
5. Fix remaining issues (Maps, SEO, redeploy)

