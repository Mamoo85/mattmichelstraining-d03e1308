

# Production Readiness Audit — Top 3 Products

User wants a deep diagnostic audit, not new features. This is a read-only investigation that produces a brutal honest report. I'll need to query DB, hit logs, curl edge functions.

## What I'll investigate (5 sections)

### 1. Cron & Edge Function Health
- Query `cron.job` + `cron.job_run_details` for last 24h: which scheduled jobs are actually firing, success/fail counts
- Query `net._http_response` for HTTP 402/404/405/500 in last 24h grouped by URL (identify which APIs are broken)
- Check `hire_alert_scanner_checkpoints` table — are checkpoints advancing or stuck?
- Pull edge function logs for: `hire-alert-scanner`, `industry-pulse-scanner`, `lead-enrichment-waterfall`, `candidate-deep-enrich`, `scarlett-autonomous`, `selma-autonomous`, `dead-lead-drip`

### 2. Silent Killers — Data Quality
- `hire_alert_candidates`: count by source, last 7d insertions, % with `is_company_name=true` (should be filtered out), % with score=0/null, % with name length <4 or matching company tokens that slipped through
- `industry_pulse_signals` (canonical): count by signal_type, freshness (signals where created_at > 30d), null/empty critical fields
- Junk-name detection: regex against names like "Mr Pipey", "Inc", "LLC", phone-number-as-name patterns
- Source freshness: per-source max(created_at) — any source dead >7d?

### 3. Enrichment Waterfall Match Rates
- Query `enrichment_stage_state` + per-candidate enriched fields: success rate per stage (NPI, PDL, Hunter, Snov, Lusha, Sonar, Crustdata)
- True contactability: % of last-30d candidates with verified email OR mobile phone
- Check `enrichment_source_budgets` — which providers are paused/cap-reached?
- Check `ai_call_log` for per-provider error rates

### 4. AI Scoring Accuracy
- `hire_alert_candidates.score` distribution: how many 0/null vs 1-10
- Check `candidate-quality-scorer` logs for failures
- Sample 20 high-score candidates — do they have corroborating fields?

### 5. Billing & Fulfillment
- Inspect `stripe-webhook/index.ts` handlers for: `hire_alert_subscription`, `field_service_subscription`, `contractor_lead_subscription`, `industry_pulse_subscription` ($149 Demand Radar)
- Look for `undefined` variables in welcome email flows (the prior `dashboardToken` bug class)
- Check last 7d `stripe_webhook_log` for failed deliveries
- Verify auto-onboard TEMPLATES dict covers all 4 product types

## Deliverable

A single audit report with:
- **Section-by-section findings** (what's broken, what's working, with specific row counts / log excerpts as proof)
- **Silent killers list** (ranked by severity)
- **Per-product Production Readiness %** with justification:
  - Demand Radar (Industry Pulse / Growth Radar)
  - Talent Radar (TechAlert / HireAlert)
  - FieldDesk + Contractor Leads
- **Top 5 must-fix bottlenecks** before sales outreach scales

## Method
- Read-only. No code changes in this turn.
- Heavy use of `supabase--read_query`, `supabase--analytics_query` (for cron + edge logs), `supabase--edge_function_logs`
- I will NOT mark anything "working" without log/DB proof
- Findings I can't verify will be labeled `UNVERIFIED — needs runtime check` rather than guessed

After you approve, I switch to default mode, run all queries in parallel where safe, and post the full report. Estimated 15–25 tool calls. No file edits unless you then ask for fixes.

