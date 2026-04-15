

# Harden TechAlert: LARA Resilience + API Health Monitor + Compliance Safeguards

## Context

After reviewing the codebase, key findings:
- **S10 (VAL License Enumeration)** is listed in comments but NOT implemented in `miosha-license-scraper` — so direct LARA scraping is not actually running. The scanner relies on 13 indirect sources (NPI, Sonar, PDL, Yelp, Craigslist, etc.) + Sonar web search.
- **S3 (Michigan Open Data/Socrata)** and **S4 (Detroit Building Permits/ArcGIS)** are the closest to government data — both are public APIs, not web scraping.
- The `lara-business-scraper` (postcard engine) uses Sonar to find LARA-registered businesses — it doesn't scrape LARA directly either.
- **dwa-operator** currently only monitors dead-lead campaign health — no API pipeline monitoring exists.

## What We're Building

### 1. Pipeline Health Monitor (upgrade dwa-operator)
Add a **synthetic pipeline test** that runs twice daily through `dwa-operator`:
- Fire a test record through each critical API in the TechAlert chain: NPI Registry, Sonar/OpenRouter, PDL, Yelp, Firecrawl, Resend, Twilio
- Each test is a lightweight ping with a 10s timeout — not a full scan
- Log results to a new `api_health_checks` table
- If any API fails or times out: **instant SMS to Matt** + email with diagnostics
- Track historical uptime per source for the admin panel

**New edge function**: `pipeline-health-monitor` (cron: twice daily, 6am + 6pm ET)

**Database migration**: `api_health_checks` table (api_name, status, response_ms, error_message, checked_at)

### 2. LARA/MiPLUS Resilience Layer
Since direct LARA scraping isn't live yet, build the resilience layer proactively:
- Add a **MiPLUS adapter function** in `miosha-license-scraper` that can query the Accela-powered `aca-prod.accela.com/LARA` portal
- Implement retry logic with exponential backoff (3 retries, 2s/4s/8s)
- Add User-Agent rotation (5 realistic browser UA strings)
- If LARA returns 403/429/captcha → gracefully degrade: log the failure, SMS Matt, continue with remaining 13 sources
- Add `lara_status` field to `hire_alert_runs` to track whether LARA was reachable each run

### 3. Client TOS Compliance Gate
Protect DWA from client misuse of TechAlert data:
- Add `tos_accepted_at` column to `hire_alert_clients`
- Block candidate alerts until TOS is accepted (check in `hire-alert-scanner` before sending)
- Add TOS acceptance checkbox to the `/hire-alert` checkout flow
- TOS language includes: "Data is for market intelligence only. Automated bulk contact/spam of candidates is prohibited. Violation results in immediate service termination."
- Store TOS version number for audit trail

### 4. Source Degradation Dashboard (Admin)
Add a **"Pipeline Health"** card to `AdminDWAOverview`:
- Shows last 24h status for each of the 14 data sources
- Green/yellow/red indicators based on `api_health_checks`
- Quick-glance: "13/14 sources operational"

## Database Changes

```sql
-- API health monitoring
CREATE TABLE public.api_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name text NOT NULL,
  status text NOT NULL DEFAULT 'unknown', -- ok, degraded, down
  response_ms integer,
  error_message text,
  checked_at timestamptz DEFAULT now()
);
ALTER TABLE public.api_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.api_health_checks FOR ALL TO service_role USING (true);

-- TOS compliance on hire_alert_clients
ALTER TABLE public.hire_alert_clients
  ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS tos_version text DEFAULT '1.0';

-- LARA status tracking on runs
ALTER TABLE public.hire_alert_runs
  ADD COLUMN IF NOT EXISTS lara_status text DEFAULT 'not_attempted';

-- Cron for pipeline health
SELECT cron.schedule('pipeline-health-monitor-morning', '0 10 * * *', ...);
SELECT cron.schedule('pipeline-health-monitor-evening', '0 22 * * *', ...);
```

## Files Modified/Created
- **New**: `supabase/functions/pipeline-health-monitor/index.ts` — synthetic API health checks
- **Modified**: `supabase/functions/miosha-license-scraper/index.ts` — add MiPLUS adapter with graceful degradation
- **Modified**: `supabase/functions/hire-alert-scanner/index.ts` — TOS gate before sending alerts, log `lara_status`
- **Modified**: `src/pages/HireAlert.tsx` — TOS checkbox in checkout flow
- **Modified**: `src/components/admin/AdminDWAOverview.tsx` — Pipeline Health card

## No New Secrets Needed
All required API keys are already configured.

