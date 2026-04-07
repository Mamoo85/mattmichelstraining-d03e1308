# M² Development — Autonomous Agent Roster
## Confidential Internal Reference | Last Updated: April 2026

---

# Table of Contents

1. [Active Agents Overview](#active-agents)
2. [Agent Deep Dives](#agent-deep-dives)
3. [Improvement Recommendations](#improvements)
4. [Planned Future Agents](#future-agents)

---

# 1. Active Agents Overview {#active-agents}

| # | Agent | Role | Schedule | Edge Function | Status |
|---|-------|------|----------|---------------|--------|
| 1 | **Oz** | Admin Overseer | Every 15 min | `oz-autonomous` | ✅ Active |
| 2 | **Tom** | Lead Hunter | Daily 8am ET | `tom-autonomous` | ✅ Active |
| 3 | **Ops** | Project Delivery | Daily 9am ET | `ops-autonomous` | ✅ Active |
| 4 | **Oracle** | Account Watchdog | Daily | `agent-smith-report` | ✅ Active |
| 5 | **Shield** | Churn Prevention | Daily 7am ET | `shield-churn-guard` | ✅ Active |
| 6 | **Cashier** | Revenue Protection | Daily 6am ET | `cashier-revenue-guard` | ✅ Active |
| 7 | **Scout** | Competitive Intel | Weekly Mon 10am | `scout-competitor-watch` | ✅ Active |
| 8 | **Hype** | Social Proof | Weekly Wed 10am | `hype-social-proof` | ✅ Active |
| 9 | **Drill** | Content Monitor | Daily 11am ET | `drill-content-monitor` | ✅ Active |
| 10 | **Pulse** | SMS Health | Every 4 hours | `pulse-sms-monitor` | ✅ Active |
| 11 | **Ref** | Referral Optimizer | Weekly Fri 9am | `ref-referral-optimizer` | ✅ Active |
| 12 | **Selma** | Head Marketer | Daily 9am ET | `selma-autonomous` | ✅ Active |
| 13 | **Scarlett** | Creative Strategy | Daily 2pm ET | `scarlett-autonomous` | ✅ Active |
| 14 | **Mute** | Opt-Out Compliance | Daily | (needs edge fn) | ⚠️ Protocol Only |
| 15 | **Comply** | Legal Compliance | Daily | (needs edge fn) | ⚠️ Protocol Only |
| 16 | **Guard** | Brand Reputation | Daily | (needs edge fn) | ⚠️ Protocol Only |
| 17 | **Critic** | Negative Feedback | Daily | (needs edge fn) | ⚠️ Protocol Only |
| 18 | **Luna** | Wins Tracker | Daily | (needs edge fn) | ⚠️ Protocol Only |
| 19 | **Mirror** | Retention Strategy | Daily | (needs edge fn) | ⚠️ Protocol Only |
| 20 | **Red** | Security Auditor | Weekly | (needs edge fn) | ⚠️ Protocol Only |
| 21 | **Rev** | QA Auditor | Per project | (needs edge fn) | ⚠️ Protocol Only |
| 22 | **Nova** | Onboarding | Per signup | (needs edge fn) | ⚠️ Protocol Only |
| 23 | **Launch** | Client Activation | Per signup | (needs edge fn) | ⚠️ Protocol Only |
| 24 | **Solo** | Direct Acquisition | Daily | (needs edge fn) | ⚠️ Protocol Only |
| 25 | **Invest** | Growth Capital | Weekly | (needs edge fn) | ⚠️ Protocol Only |
| 26 | **Trim** | Content Quality | Daily | (needs edge fn) | ⚠️ Protocol Only |
| 27 | **Aff** | Affiliate Tracker | Daily | (needs edge fn) | ⚠️ Protocol Only |
| 28 | **Upsell** | Revenue Expansion | Daily | (needs edge fn) | ⚠️ Protocol Only |
| 29 | **Vera** | Data Validator | Daily | (needs edge fn) | ⚠️ Protocol Only |
| 30 | **Zero** | Cost Optimizer | Weekly | (needs edge fn) | ⚠️ Protocol Only |

---

# 2. Agent Deep Dives {#agent-deep-dives}

---

## Agent 1: Oz — The Admin Overseer

### What Makes Oz Autonomous
- Runs every 15 minutes without any human trigger
- Auto-retries failed deliveries from `delivery_failures` table
- Auto-approves low-risk AI queue items (content drafts, workout suggestions)
- Auto-triages support tickets when backlog exceeds 3
- Syncs Stripe subscription drift automatically
- Only emails Matt when human intervention is actually needed

### Duties
1. Query `delivery_failures` → auto-retry or flag
2. Query `support_tickets` → auto-triage if > 3 pending
3. Query `ai_action_queue` → auto-approve low-risk items
4. Check `email_send_log` for errors
5. Monitor all 10 SMS product tables for health
6. Daily: Calculate 30-day MRR, identify top/at-risk users
7. Weekly (Mondays): Full system health + AI action items

### 🔧 Improvements Recommended
1. **Add dead letter queue**: When auto-retry fails 3x, move to a `dead_letter_queue` table instead of silently dropping
2. **Add Oz's own health check**: If Oz itself fails, no one knows — add a heartbeat ping that alerts if Oz hasn't run in 30 min
3. **Smarter auto-approve**: Currently approves all "low-risk" items — should check content for profanity, competitor mentions, or off-brand language before approving
4. **MRR tracking history**: Store daily MRR snapshots in a `mrr_snapshots` table for trend analysis

---

## Agent 2: Tom — Lead Hunter

### What Makes Tom Autonomous
- Daily pipeline scan at 8am ET
- Auto-detects replies from prospects via `ai-reply-detector`
- Auto-updates lead status when replies detected
- Enforces 80/20 web design vs automation email ratio
- Tracks landing page conversion rates

### Duties
1. Scan `outreach_leads` for replies → flag as HOT
2. Identify stale leads (14+ days no activity)
3. Calculate pipeline summary by status
4. Check `suppressed_emails` for wrongly suppressed leads
5. Track conversion rates by landing page/vertical
6. Monitor Reddit/Facebook for Michigan web design inquiries
7. Email Matt daily pipeline briefing

### 🔧 Improvements Recommended
1. **Auto-categorize reply intent**: Use AI to classify replies as "interested", "not interested", "wrong person", "out of office" instead of manual review
2. **Smart send-time optimization**: Track which send times get the highest open/reply rates per industry and auto-adjust
3. **Lead scoring model**: Assign numerical scores based on industry, company size, website quality, and engagement history — prioritize high-score leads
4. **Auto-generate follow-up sequences**: When a lead goes cold after initial interest, auto-draft a re-engagement email series

---

## Agent 3: Ops — Project Delivery

### What Makes Ops Autonomous
- Daily project health check at 9am ET
- Auto-detects stalled intakes (5+ days since payment, no form)
- Auto-detects ghost previews (7+ days since preview sent, no response)
- Drafts nudge emails automatically
- Celebrates launches without prompting

### Duties
1. Scan for paid clients missing intake forms
2. Scan for preview-sent with no response
3. Count active projects by stage
4. Celebrate recent launches
5. Email Matt project status briefing

### 🔧 Improvements Recommended
1. **Auto-send intake reminders**: Instead of just drafting nudges, actually send the first reminder automatically after 5 days
2. **Project timeline tracking**: Add expected completion dates and flag projects exceeding SLA
3. **Client satisfaction pulse**: Auto-send a 1-question survey after launch ("How was your experience? 1-5 stars")
4. **Portfolio auto-update**: When a project moves to "Live", auto-add it to the portfolio page

---

## Agent 4: Oracle — Account Watchdog

### What Makes Oracle Autonomous
- Queries all 10+ SMS product tables for health issues
- Identifies stuck sequences, unconfigured accounts, delivery failures
- Surfaces problems before clients notice

### Duties
1. Check all SMS product client tables for active clients with stale `last_sent_at`
2. Check sequence tables for stuck items past `next_send_at`
3. Identify unconfigured accounts (active but missing required fields)
4. Report delivery failure patterns

### 🔧 Improvements Recommended
1. **Auto-fix common issues**: If a client is active but missing phone number, auto-flag and pause rather than let it fail silently
2. **Trend detection**: Track failure rates over time — a sudden spike means a systemic issue, not individual account problems
3. **Self-healing sequences**: If a sequence is stuck at step 2 of 3, auto-retry instead of just reporting

---

## Agent 5: Shield — Churn Prevention

### What Makes Shield Autonomous
- Daily scan at 7am ET
- Cross-references payment status with delivery status across 12 products
- Calculates MRR at risk
- Monitors trial-to-paid conversion rates

### Duties
1. Find active clients with NULL last delivery date AND created 7+ days ago
2. Find active clients with last delivery 14+ days ago
3. Scan `delivery_failures` for last 24h
4. Monitor trial-to-paid conversion per product — alert if < 30%
5. Calculate total MRR at risk

### 🔧 Improvements Recommended
1. **Proactive value emails**: Auto-send a "here's what we did for you this month" email to at-risk clients
2. **Churn prediction model**: Use engagement data to predict churn 30 days before it happens
3. **Win-back automation**: When a client cancels, auto-trigger a win-back email sequence with a discount offer
4. **Engagement scoring**: Track client engagement (logins, opens, clicks) and flag declining engagement before churn

---

## Agent 6: Cashier — Revenue Protection

### What Makes Cashier Autonomous
- Daily scan at 6am ET
- Queries Stripe for failed charges, cancellations, past-due subscriptions
- Calculates lost/at-risk MRR
- Tracks ROAS for approved campaigns and feeds data to Selma

### Duties
1. Detect failed charges in last 7 days → calculate lost revenue
2. Detect recent cancellations → calculate MRR loss
3. Detect past-due subscriptions → calculate at-risk MRR
4. Snapshot active subscription count and estimated MRR
5. Track ROAS for campaigns → feed to Selma

### 🔧 Improvements Recommended
1. **Dunning automation**: Auto-send payment failure emails with retry links (Day 1, Day 3, Day 7)
2. **Revenue forecasting**: Project next month's MRR based on current trends, trial conversions, and churn rate
3. **Automatic Stripe retry**: Configure Stripe Smart Retries and track recovery rate
4. **Payment method update prompts**: Auto-email clients with expiring cards 30 days before expiry

---

## Agent 7: Scout — Competitive Intelligence

### What Makes Scout Autonomous
- Weekly sweep on Mondays at 10am ET
- Scrapes competitor ads via Google Ads Transparency Center
- Tracks competitor pricing changes via Firecrawl

### Duties
1. Check overdue competitor watch reports
2. Check overdue battlecard reports
3. Identify upsell opportunities
4. Scrape competitor ads
5. Track pricing page changes

### 🔧 Improvements Recommended
1. **AI competitor analysis**: Use AI to summarize what competitors changed and why it matters
2. **Competitive alert triggers**: If a competitor drops prices below M2, alert immediately (not weekly)
3. **Market share tracking**: Estimate M2's position relative to competitors in key verticals

---

## Agent 8: Hype — Social Proof Engine

### What Makes Hype Autonomous
- Weekly harvest on Wednesdays at 10am ET
- Identifies clients who should be asked for reviews
- Counts and tracks portfolio sites
- Auto-generates before/after case study drafts when projects go live

### 🔧 Improvements Recommended
1. **Auto-draft review request emails**: Generate and send review request emails automatically, not just flag
2. **Testimonial page auto-builder**: Auto-collect and display testimonials on the website
3. **Social proof widgets**: Generate embeddable widgets showing review counts for client websites

---

## Agent 9: Drill — Content Monitor

### What Makes Drill Autonomous
- Daily check at 11am ET
- Monitors all content channels (GBP, blog, social, newsletter)
- Flags channels that have fallen behind schedule
- Audits landing pages for missing CTAs and broken links

### 🔧 Improvements Recommended
1. **Auto-trigger content generation**: If a channel is behind, automatically trigger the relevant poster/writer
2. **Content performance tracking**: Track which content types drive the most engagement and adjust AI prompts
3. **A/B testing**: Auto-generate two versions of content, track which performs better, learn

---

## Agent 10: Pulse — SMS Health Monitor

### What Makes Pulse Autonomous
- Every 4 hours
- Checks all 7 SMS products for active clients who haven't sent in expected window
- Identifies stuck sequences
- Silent when healthy (no spam alerts)

### 🔧 Improvements Recommended
1. **Auto-unstick sequences**: If a sequence is stuck, auto-retry the failed step before alerting
2. **SMS deliverability tracking**: Monitor Twilio delivery rates and flag degradation
3. **Cost per SMS tracking**: Calculate and report actual Twilio costs per product per month

---

## Agents 11-13: Selma, Scarlett, Ref

### Selma (Head Marketer)
- Uses DataForSEO for real keyword data (190+ terms)
- Only proposes campaigns with LTV > 3x CAC
- **Improve**: Add automatic A/B test tracking for approved campaigns

### Scarlett (Creative Strategist)
- Generates visual ad concepts and emotional hooks
- Cross-references Selma's proposals
- **Improve**: Generate actual ad images using AI image generation, not just prompts

### Ref (Referral Optimizer)
- Weekly partner health check
- Tracks conversion rates per partner
- **Improve**: Auto-send partner performance reports and bonus notifications

---

## Agents 14-30: Protocol-Only Agents (No Edge Functions Yet)

These agents have detailed protocol files in `.claude/agents/` but **no deployed edge functions**. They exist as plans and can be activated by building their edge functions.

| Agent | Gap It Fills | Priority |
|-------|-------------|----------|
| **Mute** | TCPA/CAN-SPAM compliance enforcement | 🔴 HIGH — legal risk |
| **Comply** | Regulatory monitoring across all laws | 🔴 HIGH — legal risk |
| **Nova** | New client welcome/onboarding automation | 🟡 MEDIUM — improves retention |
| **Launch** | First-7-day value delivery | 🟡 MEDIUM — reduces early churn |
| **Guard** | Brand reputation monitoring | 🟡 MEDIUM — protects brand |
| **Mirror** | Retention campaign design | 🟡 MEDIUM — reduces churn |
| **Trim** | Content quality auditing | 🟡 MEDIUM — prevents embarrassment |
| **Critic** | Negative feedback aggregation | 🟢 LOW — nice to have |
| **Luna** | Win tracking and celebration | 🟢 LOW — morale boost |
| **Red** | Security auditing | 🟡 MEDIUM — prevents breaches |
| **Rev** | QA before project launch | 🟡 MEDIUM — quality assurance |
| **Solo** | Direct acquisition optimization | 🟢 LOW — Tom covers most |
| **Invest** | Revenue reinvestment advice | 🟢 LOW — premature |
| **Aff** | Affiliate revenue tracking | 🟢 LOW — small revenue stream |
| **Upsell** | Cross-sell/upsell automation | 🟡 MEDIUM — revenue growth |
| **Vera** | Data validation across tables | 🟡 MEDIUM — data quality |
| **Zero** | Cost optimization | 🟢 LOW — costs already minimal |

---

# 3. Improvement Recommendations Summary {#improvements}

## 🔴 Critical (Implement Now)

1. **Oz Heartbeat Monitor**: Add a `heartbeat` table — if Oz hasn't written in 30 min, send alert via separate lightweight function
2. **Mute Edge Function**: Build `mute-compliance-monitor` to actually enforce opt-outs across all SMS products before sends
3. **Dunning Automation (Cashier)**: Auto-send payment failure emails instead of just reporting
4. **Tom Reply Intent Classification**: Use AI to auto-classify reply intent so Matt only reviews genuinely interested leads
5. **Shield Win-Back Sequences**: Auto-trigger email sequences when clients cancel

## 🟡 Important (Next Sprint)

6. **Ops Auto-Send Intake Reminders**: Actually send the first reminder automatically
7. **Oracle Self-Healing Sequences**: Auto-retry stuck sequences before reporting
8. **Pulse Auto-Unstick**: Same as Oracle — retry before alert
9. **Nova Onboarding Edge Function**: Build welcome email automation per product type
10. **Drill Auto-Trigger**: If content is behind schedule, auto-trigger the relevant generator
11. **Scarlett AI Image Generation**: Generate actual ad images, not just text prompts
12. **Guard Brand Monitor**: Build edge function to check Google reviews, GBP Q&A weekly

## 🟢 Nice to Have (Backlog)

13. **MRR History Table**: Store daily snapshots for trend graphs
14. **Lead Scoring Model**: Numerical scores for outreach prioritization
15. **Content A/B Testing**: Two versions per content piece, track performance
16. **Affiliate Dashboard**: Track clicks, conversions, revenue per affiliate program
17. **Luna Win Alerts**: Celebrate milestones automatically (first $1k MRR, etc.)

---

# 4. Planned Future Agents {#future-agents}

| Agent | Purpose | When |
|-------|---------|------|
| **Forge** | Auto-generate entire micro-SaaS products based on market gaps | After $10k MRR |
| **Atlas** | Geographic expansion planner — identify new cities/states for services | After $5k MRR |
| **Sage** | Client education bot — auto-send tips and how-to content per product | Q3 2026 |
| **Anchor** | Long-term contract negotiator — offer annual pricing at discounts | After 50+ clients |
| **Echo** | Customer voice aggregator — collect and analyze all client communications | Q4 2026 |
| **Flux** | Dynamic pricing engine — adjust prices based on demand and competition | After $15k MRR |

---

*Document generated April 4, 2026 — M² Development internal use only*
