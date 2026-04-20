---
name: One-Click Ad Launcher
description: Auto-drafts Meta + Google ads on contractor_lead_subscription Stripe payment; admin reviews and one-click launches
type: feature
---
**Trigger**: `contractor_lead_subscription` Stripe webhook (line ~3258) calls `draft-ad-campaign` edge fn after payment.

**Flow**: payment → draft-ad-campaign uses `google/gemini-2.5-flash` to generate Meta headline/primary/description/image_prompt/targeting + Google headlines/descriptions/keywords → inserts to `ad_launch_drafts` table (status=pending_review) → SMSes Matt → Matt reviews at `/dwa-admin → 🚀 Ad Launcher` → clicks Launch → `launch-meta-ad` edge fn.

**Two modes for launch**:
- **Manual (Phase 1, current)**: META secrets missing → returns paste-ready creative copy
- **Auto (Phase 2)**: Add `META_AD_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID` → creates PAUSED Meta campaign via Marketing API v21.0 (objective=OUTCOME_LEADS, optimization=LEAD_GENERATION, geo=city+15mi radius)

**Safety**: Meta campaigns always launch in PAUSED state — Matt activates manually first time. Google Ads is always paste-ready (Google API requires developer token approval 1-3 days).

**Default budget**: $20/day. Targeting: 28-65 age, 15mi radius around contractor city, "Home improvement" interest.

**Tables**: `ad_launch_drafts` (RLS: service_role + admins).
