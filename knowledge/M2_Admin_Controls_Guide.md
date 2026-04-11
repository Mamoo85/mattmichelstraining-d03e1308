# M² Development — Admin Panel Controls Guide
## Complete Reference | Last Updated: April 2026

---

# Table of Contents

1. [Panel Architecture](#architecture)
2. [Quick Actions / Command Deck](#quick-actions)
3. [Training Domain](#training)
4. [People Domain](#people)
5. [Business Domain](#business)
6. [Marketing Domain](#marketing)
7. [Detroit Web Agency Domain](#dwa)
8. [Agency Domain](#agency)
9. [Universal AI Bar (Ask Oz)](#ai-bar)
10. [Enhancement Recommendations](#enhancements)

---

# 1. Panel Architecture {#architecture}

The Admin Panel lives at `/admin` and uses a **Mission Control** layout with 6 expandable domain cards. Each card contains tools organized by function.

**Navigation**: Click a domain card to expand it → click a tool to load it. The URL hash syncs (e.g., `/admin#agency-crm`) so the browser back button works through tool history.

**Global Features**:
- **Ask Oz (Cmd+K)**: Universal AI bar pinned at top — ask anything about business data
- **Agent Status Strip**: Shows real-time status of all 13 active autonomous agents
- **Search**: Type to filter across all 80+ tools instantly
- **Badge Counts**: Red badges show pending items needing attention

---

# 2. Quick Actions / Command Deck {#quick-actions}

**Component**: `AdminCommandDeck.tsx`
**Monitored by**: Agent Oz (always-on oversight)

## What It Does
Central control panel with one-click triggers for every automated system. Shows real-time KPIs (30d Revenue, AI Queue, Support Tickets, Coach Drafts) and provides instant-fire buttons for all edge functions.

## Controls

### KPI Dashboard (Top Row)
| Metric | Source | Updates |
|--------|--------|---------|
| 30d Revenue | Stripe API query | On load |
| AI Queue | `ai_action_queue` pending count | Real-time |
| Support | `support_tickets` open count | Real-time |
| Coach Drafts | `coach_ai_drafts` pending count | Real-time |

### One-Click Triggers
| Button | Edge Function Fired | What Happens |
|--------|-------------------|--------------|
| Stripe Sync | `sync-stripe-products` | Syncs all Stripe products/prices to local DB |
| Publish Today's Workout | `send-workout-email` | Sends daily workout to all subscribers |
| Post to GBP Now | `auto-gbp-posts` | Fires GBP posts for all active clients |
| Fire Social Posts Now | `social-media-poster` | Posts to all configured social platforms |
| Run Prospecting | `prospect-local-businesses` | Scrapes Google Maps for new leads |
| Send Newsletter Now | `send-newsletter` | Sends the weekly newsletter immediately |
| Run Lead Notify | `contractor-lead-notify` | Notifies contractors of new leads |
| Run Review Monitor | `review-monitor` | Checks Google reviews for all clients |
| Fire SMS Blast | `weekly-sms-sender` | Sends weekly SMS blasts |
| Slow Day Trigger | `slow-day-trigger` | Fires slow-day promotions |
| Run Estimate Drip | `estimate-drip-runner` | Processes estimate follow-up sequences |
| Run Invoice Chaser | `invoice-chaser-runner` | Processes invoice reminder sequences |
| Cart Recovery Blast | `abandoned-cart-sender` | Sends abandoned cart recovery emails |
| Churn Prevention | `shield-churn-guard` | Runs Shield's churn prevention scan |
| Flush Email Queue | `send-transactional-email` | Processes queued transactional emails |
| Multi-Service Drip | `web-design-drip` | Runs web design outreach drip |

### Bulk Actions
| Action | What It Does |
|--------|-------------|
| Bulk Approve AI Queue | Approves all pending AI-generated content at once |
| AI Triage All Support | Runs AI triage on all open support tickets |
| Mass Trial Extension | Extends trial period for all trial users |
| Export Client List | Downloads CSV of all clients |
| Global Announcement | Sets a banner message visible to all users |

### AI Model Selector
Lets you choose which AI model powers each task category:
- Content Generation, Workout Generation, Newsletter, Support Triage, Coach Replies, Outreach, Reports

### Step-by-Step: Fire a Manual Trigger
1. Navigate to `/admin` → click "⚡ Quick Actions" → "Command Deck"
2. Find the action button you need (e.g., "Fire Social Posts Now")
3. Click the button — a toast notification confirms the function was invoked
4. Check results in the relevant tool (e.g., "GBP Posts" for GBP, "Email Log" for emails)

### 🔧 Enhancement Recommendations
1. **Add execution history**: Show last 10 trigger executions with timestamps and success/fail status
2. **Add confirmation dialogs**: Destructive actions (Mass Trial Extension, Bulk Approve) should require confirmation
3. **Add scheduled triggers**: Let Matt schedule a trigger for a future time instead of only "now"
4. **Add agent health indicators**: Show green/yellow/red dots next to each trigger based on last heartbeat

---

# 3. Training Domain {#training}

## 3.1 Log Lifts (`AdminProgressLogger`)
**Monitored by**: None (manual tool)
- Log workout sets/reps for any user manually
- Select user → select exercise → enter weight/reps/sets → save
- **Enhancement**: Add bulk import from CSV for batch logging

## 3.2 Programs (`AdminPrograms`)
**Monitored by**: Agent Oz (auto-approves content)
- View, edit, activate/deactivate training programs
- Set pricing, levels, categories, sport tags
- Programs appear in the public store when active
- **Enhancement**: Add program analytics (views, purchases, completion rates)

## 3.3 Exercise Library (`AdminExerciseLibrary`)
**Monitored by**: None
- Browse/search all exercises with reference images and videos
- Add new exercises with form cues, muscle groups, difficulty
- **Enhancement**: Add AI-powered exercise recommendation engine

## 3.4 Workouts (`AdminWorkoutInventory`)
**Monitored by**: Agent Drill (content freshness)
- Manage daily/weekly workout templates
- Set target audience, sort order, active status
- **Enhancement**: Add "auto-rotate" to cycle workouts weekly

## 3.5 AI Workouts (`AdminBatchGenerator`)
**Monitored by**: Agent Oz
- Generate batches of workouts using AI
- Set parameters: count, difficulty, equipment, focus area
- Generated workouts go to AI Queue for approval
- **Enhancement**: Add workout performance tracking to feed back into generation

## 3.6 AI Queue (`AdminAiQueue`)
**Monitored by**: Agent Oz (auto-approves low-risk items)
- Review AI-generated content before publishing
- Approve, reject, or edit each item
- Badge shows pending count
- **Step-by-step**: Click item → review content → click Approve or Reject
- **Enhancement**: Add "approve with edit" — approve but apply your changes

## 3.7 Recovery Map (`AdminRecoveryHeatmap`)
**Monitored by**: None
- Visual heatmap of client recovery status
- Shows muscle groups trained recently and recovery windows
- **Enhancement**: Add AI recovery recommendations per client

## 3.8 Monthly Focus (`AdminMonthlyFocus`)
**Monitored by**: None
- Set and publish monthly training focus topic
- Triggers notification to all users when published
- **Enhancement**: Auto-generate focus content from trending exercises

## 3.9 Biomechanics (`AdminBiomechanics`)
**Monitored by**: None
- Review biomechanics analysis submissions
- AI-powered movement assessment from video
- **Enhancement**: Add comparison view (before/after improvements)

## 3.10 Coach AI Queue (`AdminCoachAiQueue`)
**Monitored by**: Agent Oz
- Review AI-drafted coaching responses
- Edit and send, or reject and write manually
- Badge shows pending drafts

## 3.11 Lift Videos (`AdminLiftVideoReview`)
**Monitored by**: None
- Review submitted form-check videos
- Provide feedback with timestamps
- Badge shows pending reviews

## 3.12 Prove It (`AdminProveItReview`)
**Monitored by**: None
- Review PR (personal record) submissions for verification
- Approve/reject with status tracking

---

# 4. People Domain {#people}

## 4.1 All Users (`AdminClientList`)
**Monitored by**: Agents Shield, Oz
- Master list of all registered users with search/filter
- View profile, subscription tier, activity status
- Click any user to see their full profile
- **Step-by-step**: Search by name/email → click user → view/edit profile
- **Enhancement**: Add bulk actions (mass email, tier change, export)

## 4.2 Activity Feed (`UserActivityFeed`)
**Monitored by**: Agent Oz
- Real-time feed of all user actions (logins, workouts, purchases)
- Filter by activity type
- Add notes to any activity item
- **Enhancement**: Add AI-powered activity anomaly detection

## 4.3 Support (`AdminSupportCopilot`)
**Monitored by**: Agent Oz (auto-triages when > 3 pending)
- View open support tickets with AI-suggested responses
- Accept AI suggestion or write custom reply
- Badge shows open ticket count
- **Enhancement**: Add satisfaction rating after resolution

## 4.4 Coach Review (`AdminCoachInbox` + `AdminCoachDashboard` + `AdminPostureRequests` + `AdminVideoReview`)
**Monitored by**: None
- Combined view: coach inbox, dashboard overview, posture requests, video reviews
- **Enhancement**: Add priority sorting based on wait time

## 4.5 Messages (`AdminDirectMessages`)
**Monitored by**: None
- Direct messaging with any user
- Coach role automatically assigned for admin messages
- **Enhancement**: Add canned responses for common questions

## 4.6 Families (`AdminFamilyManager`)
**Monitored by**: None
- Manage parent-child athlete relationships
- View family plans and linked accounts

## 4.7 Teams (`AdminTeamSandbox` + `AdminCoachManager` + `AdminTeamRosters`)
**Monitored by**: None
- Create/manage team rosters with invite codes
- Assign coaches, manage athlete memberships
- **Enhancement**: Add team analytics (aggregate performance stats)

## 4.8 Onboarding (`AdminClientOnboarding` + `AdminTrialSettings`)
**Monitored by**: Agents Nova, Launch (protocol only — no edge functions yet)
- View new user onboarding status
- Configure trial settings (duration, features)
- **Enhancement**: Add onboarding funnel visualization (signup → first workout → subscription)

## 4.9 Churn Radar (`AdminChurnRadar`)
**Monitored by**: Agent Shield
- Visual dashboard of churn risk across all users
- Shows at-risk users with risk scores
- **Enhancement**: Add one-click retention actions (send discount, extend trial, personal message)

## 4.10 Schedule (`AdminSchedule`)
**Monitored by**: None
- View/manage appointment calendar
- Integrated with Google Calendar API

## 4.11 VIP Access (`AdminVipAccess`)
**Monitored by**: None
- Grant/revoke VIP status for users
- VIP users get premium features without subscription

---

# 5. Business Domain {#business}

## 5.1 Overview (`AdminBusinessDashboard`)
**Monitored by**: Agents Cashier, Oz, Luna
- Revenue overview, subscriber counts, MRR tracking
- Charts: revenue trend, subscriber growth, product breakdown
- **Step-by-step**: Load dashboard → review KPIs → drill into any metric
- **Enhancement**: Add comparison view (this month vs last month)

## 5.2 Fulfillment (`AdminFulfillment`)
**Monitored by**: Agent Ops
- Track delivery status of all paid orders
- View pending deliveries, failed deliveries, completed orders
- Badge shows unfulfilled orders
- **Enhancement**: Add auto-retry button for failed deliveries

## 5.3 Orders (`AdminOrders`)
**Monitored by**: Agent Cashier
- Full order history with Stripe integration
- View order details, customer info, payment status
- **Enhancement**: Add refund processing directly from order view

## 5.4 Ops Center (`AdminOpsCenter`)
**Monitored by**: Agent Oz
- CRM roster covering all 17 product lines
- View active client counts, MRR per product
- **Enhancement**: Add drill-down into each product's client list

## 5.5 Client Health (`AdminClientHealth`)
**Monitored by**: Agent Shield
- Health scores for all B2B clients
- Shows delivery status, engagement, payment status per client
- **Enhancement**: Add automated health score alerts

## 5.6 Revenue & Ledger (`AdminFinancials`)
**Monitored by**: Agent Cashier
- Detailed financial tracking with Stripe data
- Revenue by product, payment failures, refunds
- **Enhancement**: Add P&L view with cost tracking

## 5.7 Promotions (`AdminPromotions`)
**Monitored by**: None
- Create/manage discount codes and promotions
- Set discount type, value, expiry, usage limits
- **Step-by-step**: Click "New Promotion" → set code, discount, rules → save
- **Enhancement**: Add promotion performance tracking (uses, revenue impact)

## 5.8 Stripe Products (`AdminStripeProducts`)
**Monitored by**: Agent Cashier (syncs drift)
- View all Stripe products/prices synced to local DB
- Manual sync button available
- **Enhancement**: Add price change history

## 5.9 B2B Pipeline (`AdminB2BPipeline`)
**Monitored by**: Agent Tom
- Visual pipeline of B2B prospects through stages
- Drag-and-drop between stages
- **Enhancement**: Add pipeline value forecasting

## 5.10 Sandbox (`AdminSandbox`)
**Monitored by**: None
- $0 test checkouts for all 40+ products
- Content Command Center for testing AI content
- Live preview and publish to LinkedIn/Facebook
- **Step-by-step**: Select product → customize metadata → run test checkout → verify webhook → check database
- **Enhancement**: Add automated regression testing for all checkout flows

## 5.11 Email Log (`AdminEmailLog`)
**Monitored by**: Agent Pulse
- View all sent emails with delivery status
- Filter by template, recipient, status
- **Enhancement**: Add email preview and resend capability

## 5.12 Trash (`AdminTrash`)
**Monitored by**: None
- Recover deleted items within 30-day window
- Shows original table, deletion date, deleted by
- **Enhancement**: Add bulk restore

## 5.13 Legal (`AdminLegalCompliance`)
**Monitored by**: Agents Mute, Comply (Mute now has edge function)
- TCPA compliance tracking for SMS
- CAN-SPAM compliance for email
- Opt-out lists and suppression management
- **Enhancement**: Add compliance audit log with timestamps

---

# 6. Marketing Domain {#marketing}

## 6.1 Growth Hub (`AdminM2GrowthHub`)
**Monitored by**: Agents Selma, Scarlett
- Unified marketing dashboard
- Campaign performance, growth metrics, opportunities
- **Enhancement**: Add competitor comparison dashboard

## 6.2 Ad Campaigns (`AdminAdCampaigns`)
**Monitored by**: Agents Selma, Scarlett
- Review daily campaign proposals from Selma and Scarlett
- One-tap approve/skip interface
- Shows projected CAC, LTV, ROAS for each campaign
- **Step-by-step**: Open Ad Campaigns → review today's proposal → check metrics → tap Approve or Skip → add notes
- **Enhancement**: Add campaign A/B testing with result tracking

## 6.3 Front Page (`AdminFrontPage`)
**Monitored by**: None
- Edit homepage banner text and stats
- Toggle announcement banner on/off
- **Enhancement**: Add A/B test different banners

## 6.4 Newsletter (`AdminNewsletterComposer`)
**Monitored by**: Agent Drill
- Compose and send newsletters
- AI content generation with affiliate link insertion
- Preview before sending
- **Step-by-step**: Click "Compose" → AI generates content → review/edit → preview → send
- **Enhancement**: Add subscriber segment targeting

## 6.5 Training Newsletter (`AdminTrainingNewsletter`)
**Monitored by**: Agent Drill
- Separate newsletter for training/fitness content
- Uses GPT-5 Mini for high-quality generation
- **Enhancement**: Add performance metrics per issue

## 6.6 SEO Engine (`AdminSeoGenerator`)
**Monitored by**: Agent Drill
- Generate SEO-optimized landing pages
- Target keywords, meta descriptions, content
- **Enhancement**: Add keyword rank tracking integration

## 6.7 Search Console (`AdminSearchConsole`)
**Monitored by**: None
- Google Search Console data integration
- View impressions, clicks, CTR, position by page/query
- **Enhancement**: Add automated SEO recommendations based on data

## 6.8 GBP Posts (`AdminGbpPosts`)
**Monitored by**: Agent Drill
- View/manage Google Business Profile posts
- Manual post creation and scheduling
- **Enhancement**: Add post engagement analytics

## 6.9 Content Generator (`AdminContentGenerator`)
**Monitored by**: Agent Drill, Trim
- Generate AI content across 5 categories
- 15+ industry presets and brand voice options
- Preview, edit, publish to LinkedIn/Facebook, or copy
- **Step-by-step**: Select content type → pick industry/voice → generate → edit → publish or copy
- **Enhancement**: Add content calendar with scheduling

## 6.10 Outreach (`AdminOutreach`)
**Monitored by**: Agent Tom
- View and manage outreach email campaigns
- Track open rates, reply rates per campaign
- **Enhancement**: Add email sequence builder with drag-and-drop

## 6.11 Media Vault (`AdminMediaVault`)
**Monitored by**: None
- Upload and organize media files (images, videos)
- Tag and search media assets
- **Enhancement**: Add AI auto-tagging for uploaded media

---

# 7. Detroit Web Agency Domain {#dwa}

**Tab label**: "Detroit Web Agency" | **Icon**: Wrench | **Color**: `#00d4ff`
**Purpose**: Single hub for all DWA products — FieldDesk, SiteRadar, TechAlert. All testing tools in one place.

## 7.1 DWA Overview (`AdminDWAOverview`)

Central command center for Detroit Web Agency products.

**Stats cards**: FieldDesk active clients, TechAlert active clients, total candidates in DB, hot alerts sent.

**Quick Links** (open in new tab):
- `/field-service` — FieldDesk landing page
- `/hire-alert` — TechAlert landing page
- `/field-service/dispatch` — Dispatcher board
- `/field-service/tech` — Tech mobile app
- `/dwa-admin` — DWA admin panel
- `/demo-djconley-v2` — DJ Conley demo site

**$0 Test Checkouts**: One-click buttons that invoke `create-test-checkout` for:
- FieldDesk (`field_service_subscription`) — seeds `field_crm_clients`
- TechAlert (`hire_alert_subscription`) — seeds `hire_alert_clients`

**Scanner Control**: Shows last run time + candidates found. "Invoke Scanner Now" button manually fires `hire-alert-scanner` edge function without waiting for 7am cron. Use this to test the full scanning pipeline immediately.

## 7.2 FieldDesk Clients (`AdminFieldCRMClients`)

Manages `field_crm_clients` table. Add/edit/delete clients, generate JavaScript tracking snippets for SiteRadar.

**Snippet Generator**: Each client gets a unique `visitor_script_key`. Click "Get Tracking Snippet" to copy the JS tag — paste before `</body>` on their website. Visitors start appearing in SiteRadar immediately.

**Stats**: Active count, monthly revenue (from `monthly_price` field), total visitors tracked.

## 7.3 TechAlert Clients (`AdminHireAlertClients`)

Manages `hire_alert_clients` table. Shows plan (bundle $49 vs standalone $99), target roles, notify flags.

**Role tags**: Shows which of 8 trades each client is monitoring (boiler_operator, hvac_tech, plumber, electrician, pipefitter, steam_engineer, refrigeration_tech, fire_suppression).

**Scanner Runs table**: Last 10 runs from `hire_alert_runs` — timestamp, source, candidates found, alerts sent, error status.

**Recent Candidates table**: Last 20 rows from `hire_alert_candidates` — name, license type, city, source (miosha/apollo/firecrawl), status (new/alerted/hired/inactive).

## 7.4 SiteRadar / Visitor Intel (`VisitorIntelFeed`)

Live feed of business visitors across all FieldDesk clients. Company name, page visited, time. Use to demonstrate value to prospects ("someone from Ford Motor visited your site 3 times this week").

## 7.5 Dispatch Map (`TechDispatchMap`)

Google Maps view of live tech GPS locations from `tech_locations` table. Pins show tech name + current job.

## 7.6 Review Engine (`ReviewLeaderboard`)

Review monitoring leaderboard. Shows client review scores, recent reviews, response queue.

## 7.7 Web Design CRM (`AdminWebDesignCRM`)

Pipeline for website clients — new leads, in-progress builds, live sites.

## 7.8 Prospector (`AdminProspector`)

Find field service companies in Metro Detroit to pitch. Queries `prospect_pipeline` table.

## 7.9 Demo Links (`AdminDemoLinkGenerator`)

Generate shareable demo links for prospects (DJ Conley, etc.).

## 7.10 Scouting Dashboard (`AdminScoutingDashboard`)

Lead scoring and qualification dashboard for DWA prospects.

---

# 8. Agency Domain {#agency}

## 7.1 Agency CRM (`AdminAgencyCRM`)
**Monitored by**: Agent Ops, Tom
- Master CRM for all agency clients across all products
- View client details, subscription status, delivery history
- **Enhancement**: Add client communication timeline

## 7.2 Web Design CRM (`AdminWebDesignCRM`)
**Monitored by**: Agent Ops
- Pipeline view specific to web design projects
- Stages: Lead → Proposal → Paid → Building → Live
- **Step-by-step**: View pipeline → click lead → update status → add notes → track progress
- **Enhancement**: Add project time tracking and profitability analysis

## 7.3 Site Builder (`AdminSiteBuilder`)
**Monitored by**: Agent Ops (Builder agent)
- AI-powered website generation from templates
- Industry-specific templates (~30 second generation)
- **Step-by-step**: Select industry → enter business info → click Generate → review → customize → deliver
- **Enhancement**: Add template A/B testing (which industry templates convert best)

## 7.4 Prospector (`AdminProspector`)
**Monitored by**: Agent Tom
- Lead generation tool with Google Maps scraping
- Lead Roster with filter, search, manual email triggers
- **Step-by-step**: Set target industry/city → run prospecting → review leads → filter by status → click ⚡ to send individual outreach
- **Enhancement**: Add lead enrichment (auto-fetch website, social profiles, reviews)

## 7.5 Automation Hub (`AdminAutomationHub`)
**Monitored by**: Agent Oz
- View status of all automated systems
- Toggle automations on/off
- View last run times and success rates
- **Enhancement**: Add automation flow visualization (visual DAG of what triggers what)

## 7.6 Email Automations (`AdminWebDesignAutomations`)
**Monitored by**: Agent Tom
- Configure web design drip email sequences
- Set timing, content, triggers for each step
- **Enhancement**: Add per-step conversion tracking

## 7.7 Demo Links (`AdminDemoLinkGenerator`)
**Monitored by**: None
- Generate industry-specific demo website links
- Used in outreach emails to show prospects what their site could look like
- **Enhancement**: Add demo link click tracking and analytics

---

# 8. Universal AI Bar (Ask Oz) {#ai-bar}

**Component**: `AdminAiBar.tsx`
**Monitored by**: Agent Oz
**Shortcut**: Cmd+K (Mac) / Ctrl+K (Windows)

## What It Does
A pinned search/command interface available on every admin screen. Ask any question about business data and get instant AI-powered answers with live data context.

## Quick Query Chips
Pre-built queries for common tasks:
- "What's my MRR?"
- "Show churn risk"
- "Revenue by product"
- "Pending support tickets"
- "Active campaigns"

## Step-by-Step
1. Press Cmd+K or click the search bar
2. Type a question in plain English (e.g., "which products have the most active clients?")
3. Oz queries relevant tables and returns a formatted answer
4. Click any entity mentioned to navigate directly to it

## Enhancement Recommendations
1. **Add voice input**: Let Matt ask Oz questions by voice
2. **Add action execution**: "Send a newsletter" should actually trigger it, not just explain how
3. **Add scheduled queries**: "Tell me MRR every Monday morning" auto-emails results

---

# 9. Enhancement Recommendations Summary {#enhancements}

## 🔴 Critical (Build Now)

| # | Enhancement | Where | Impact |
|---|-------------|-------|--------|
| 1 | **Command Deck execution history** | `AdminCommandDeck.tsx` | Know what was triggered and when — prevents double-fires |
| 2 | **One-click retention actions on Churn Radar** | `AdminChurnRadar.tsx` | Matt can send discount/extend/message right from the churn view |
| 3 | **Confirmation dialogs on destructive actions** | `AdminCommandDeck.tsx` | Prevents accidental mass actions |
| 4 | **Agent health indicators on Command Deck** | `AdminCommandDeck.tsx` | Visual heartbeat status for all agents |
| 5 | **Refund processing from order view** | `AdminOrders.tsx` | Handle refunds without leaving the admin panel |

## 🟡 Important (Next Sprint)

| # | Enhancement | Where | Impact |
|---|-------------|-------|--------|
| 6 | **Onboarding funnel visualization** | `AdminClientOnboarding.tsx` | See where new users drop off |
| 7 | **Content calendar with scheduling** | `AdminContentGenerator.tsx` | Plan content ahead instead of real-time only |
| 8 | **Lead enrichment in Prospector** | `AdminProspector.tsx` | Auto-fetch prospect websites and reviews |
| 9 | **Promotion performance tracking** | `AdminPromotions.tsx` | See which promos drive revenue |
| 10 | **Pipeline value forecasting** | `AdminB2BPipeline.tsx` | Predict future revenue from pipeline |

## 🟢 Nice to Have (Backlog)

| # | Enhancement | Where |
|---|-------------|-------|
| 11 | AI auto-tagging for Media Vault | `AdminMediaVault.tsx` |
| 12 | Voice input for Ask Oz | `AdminAiBar.tsx` |
| 13 | Template A/B testing in Site Builder | `AdminSiteBuilder.tsx` |
| 14 | Automation flow DAG visualization | `AdminAutomationHub.tsx` |
| 15 | Bulk user actions (mass email, tier change) | `AdminClientList.tsx` |

---

*Document generated April 4, 2026 — M² Development internal use only*
