

# The Autonomous CMO — Analytics & Strategy Engine

## What We're Building

A weekly automated marketing intelligence system that aggregates site analytics, feeds them through an AI strategy processor, and delivers actionable CMO-grade reports to the admin dashboard.

**Important adaptation**: Rather than integrating PostHog (which adds a third-party dependency and requires an API key), we'll leverage the **Lovable Analytics API** that's already collecting pageviews, referral sources, device data, and geo data for this project. This gives us the same data without any new SDK or account setup.

---

## Plan

### 1. Database: `ai_marketing_reports` Table

Create a new table to store weekly CMO reports with structured JSON output.

```
- id (uuid, PK)
- report_week (date) — Monday of the report week
- raw_analytics (jsonb) — the aggregated analytics snapshot
- ai_analysis (jsonb) — structured: funnel_bottlenecks, seo_opportunities, ad_campaign_ideas
- summary_text (text) — readable markdown summary
- status (text, default 'new') — new / reviewed / actioned
- created_at (timestamptz)
```

RLS: admin-only read/update via `has_role()`.

### 2. Edge Function: `weekly-cmo-report`

A function that:
1. Calls the **Lovable Analytics API** (`analytics--read_project_analytics` equivalent via HTTP) to pull the last 7 days of traffic data — pageviews, top pages, referral sources, devices, countries, bounce rates, session durations
2. Queries internal Supabase tables for business context: subscriber counts by tier, recent signups, churn indicators (inactive users)
3. Sends the combined data payload to the **Lovable AI Gateway** with a CMO system prompt requesting structured JSON output (funnel_bottlenecks, seo_opportunities, ad_campaign_ideas)
4. Saves the full report to `ai_marketing_reports`

The system prompt will position the AI as M2's CMO analyzing real traffic data, with instructions to return actionable strategies — not generic advice.

### 3. Scheduled Execution via `pg_cron`

Set up a weekly cron job (every Monday at 6 AM EST) that calls the edge function automatically, so reports appear without admin action.

### 4. Admin UI: CMO Dashboard

Add a **"CMO Reports"** tool to the existing Business Intelligence section in `AdminAiBusinessTools.tsx`:

- **Report List**: Shows weekly reports with date, status badge (New/Reviewed/Actioned), and key metrics summary
- **Report Detail View**: Displays three sections as cards:
  - **Funnel Bottlenecks** — where users drop off, with suggested fixes
  - **SEO Opportunities** — content ideas based on traffic patterns
  - **Ad Campaign Ideas** — copy, targeting, and demographics
- **Action Bar**: Mark as Reviewed, Save insights to Marketing Drafts, Generate follow-up content
- **Manual Trigger**: "Run Report Now" button for on-demand analysis
- **Analytics Snapshot**: Show the raw traffic data (top pages, sources, devices) alongside the AI interpretation

### 5. Wire Into Admin Navigation

Add "CMO Reports" as a new sub-tab under **Site Content → Marketing & AI**, alongside the existing Marketing Drafts and AI Business Tools.

---

## Technical Notes

- **No PostHog needed** — Lovable Analytics already captures pageviews, sources, devices, countries, bounce rates, and session duration for the published site
- The edge function will use Lovable's project analytics endpoint to pull data server-side
- AI model: `google/gemini-3-flash-preview` via Lovable AI Gateway with structured tool calling for reliable JSON extraction
- The `ai-business-intelligence` edge function will get a new `cmo_report` tool case to handle this
- All reports go through the existing drafts workflow for human oversight

