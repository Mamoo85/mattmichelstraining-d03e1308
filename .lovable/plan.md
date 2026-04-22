

## Plan: Admin Command Bar v3 — Mobile-First, DWA-Only, Bulk Outreach Generator

### Locked-in from v2 (no changes)
- 3-layer agent: Planner (Gemini 2.5 Pro) → Tool executor → Draft generator
- 14 whitelisted tools, 16 whitelisted tables, no raw SQL, no auto-send
- Reuses `openrouter-research` (Sonar) + `_shared/scraper.ts` (Firecrawl)
- All safety guardrails (admin-only, cost cap, audit log, TCPA Manual-Only)

### What's new in v3 (your 4 push-backs)

---

### 1. Mobile-first UI (396px viewport — your actual screen)

**Layout rules baked in from `mem://ux/mobile-conversion-and-design-standards`:**
- Single column under 768px (`grid-cols-1`)
- Sticky command bar pinned to top of `/dwa-admin` — collapses to icon `🧠` after scroll, tap to re-expand
- Result card uses **stacked accordion sections**, not side-by-side tabs:
  ```
  ┌──────────────────────────────┐
  │ 🧠 Reasoning      ▾ (closed) │
  │ 📊 Data (10 rows) ▾ (closed) │
  │ 📧 Email Draft    ▾ (open)   │
  │   ┌────────────────────────┐ │
  │   │ Subject: ...           │ │
  │   │ Body: ...              │ │
  │   │ [Edit] [Copy] [Queue]  │ │
  │   └────────────────────────┘ │
  │ 📱 SMS Draft      ▾ (closed) │
  └──────────────────────────────┘
  ```
- Recipient table → **card stack** under 768px (one card per recipient, not a horizontal table)
- Progress stream uses one-line status pills (`🔍 Pulling 10 plumbing leads…`), no walls of text
- Big tap targets: 44px minimum (Apple HIG), full-width buttons on mobile
- Quick-prompt chips wrap to 2 lines max, horizontal-scroll if needed
- All copy is short — labels, not sentences

---

### 2. Don't break anything (full pre-flight audit)

**Read-only — verified before any code ships:**

| Check | How I verify | Status |
|---|---|---|
| All 16 whitelisted tables read-only | Grep tool resolvers for `.insert/.update/.delete/.upsert` — must be ZERO | Will run pre-merge |
| No new RLS policies needed | Service role already has read on all 16 tables (per `mem://security/backend-access-policy`) | Confirmed in memory |
| Existing 6 background scanners untouched | New function is a separate edge function — does not modify any scanner code | By design |
| Existing crons untouched | New function is invoked on-demand only — no cron entries | By design |
| `openrouter-research` still works | Read its current signature, call it with same shape | Will verify before merge |
| `_shared/scraper.ts` interface stable | Read its current export, use existing `scrape(url)` signature | Will verify before merge |
| `email_reply_drafts` accepts our queue insert | Read its schema + existing inserter function for shape | Will verify before merge |
| TCPA Manual-Only mandate intact | Zero send tools. Only `draft_outreach`. Queueing routes through existing approval gate. | By design |
| Stripe / webhooks / payments | Untouched — this function never reads/writes any Stripe/billing tables | By design |
| Mobile preview at 396px | Will test via browser tool at the user's actual viewport before declaring done | Post-build QA |

**One additional safeguard**: if the executor errors on any step, the function returns a partial result + error (never crashes the UI). User sees "Step 3 failed: contact lookup timed out — here's what I found in steps 1-2."

---

### 3. NEW: Bulk outreach generator (the "10 emails at once" feature)

**Two new tools added to the executor:**

| Tool | What it does |
|---|---|
| `generate_bulk_outreach` | Takes a list of N recipients + a single product/angle + tone → generates **N personalized emails** in one Gemini call (Flash, structured JSON output, ~$0.003 for 10 emails). Each email references that recipient's specific data fields (city, trade, signal, employer, etc). |
| `generate_bulk_sms` | Same but for SMS — 160-char limit, no greeting/signature waste, TCPA disclaimer footer. |

**UX flow when you say "email 10 companies that could hire the 10 plumbers we found":**

1. Planner produces 3 steps:
   - `list_records(contractor_leads, trade=plumbing, claimed_at=null, limit=10)`
   - `find_buyers_in_area(trade=plumbing, city=<from step 1>, limit=10)`
   - `generate_bulk_outreach(recipients=<step 2>, product=contractor_leads, tone=urgent, hook=<step 1 leads>)`

2. Result card renders a **bulk drafts table**:
   ```
   ┌────────────────────────────────────────────────┐
   │ ✅ 10 emails ready                  [Queue All]│
   ├────────────────────────────────────────────────┤
   │ ☐ ABC Plumbing     [Edit] [Preview] [Skip]   │
   │ ☐ Joe's Drain      [Edit] [Preview] [Skip]   │
   │ ☐ Detroit Pipe Co  [Edit] [Preview] [Skip]   │
   │ … 7 more                                      │
   ├────────────────────────────────────────────────┤
   │ [Queue Selected (10)] [Copy All to Clipboard] │
   └────────────────────────────────────────────────┘
   ```

3. Tap **Edit** → inline editor for that specific email (subject + body, mobile-friendly textareas)
4. Tap **Preview** → see the rendered email
5. Tap **Skip** → removes from batch
6. **Queue All** / **Queue Selected** → inserts each into `email_reply_drafts` with `approval_required=true` → routes through your existing 10-min ghost delay + admin approval gate
7. **Copy All** → clipboard gets a formatted block of all 10 emails for manual paste if you'd rather

**Bulk SMS flow** identical but lands in your existing SMS approval queue (no auto-send, ever).

**Cost cap on bulk:** max 25 emails or 25 SMS per single command. If you ask for more, you get a "split into 2 commands" prompt. Per-email cost ~$0.0003 → 25 emails ≈ $0.008.

---

### 4. DWA-only isolation (zero connection to M2 Training)

**Hard rules baked into the system prompt + code:**

- Sender identity: ALWAYS `matt@detroitwebagent.com` (never `matt@mattmichelstraining.com`)
- Phone: ALWAYS `(313) 992-1219` (never personal cell)
- Email wrapper: ALWAYS `dwaEmail()` (never `m2Email()`) — enforced in queue insert
- Brand voice: "Digital Engines / Bare Metal" industrial tone (per `mem://brand/dual-brand-strategy`)
- Strict copy bans (per memory): no "AI" jargon, no 5-min call offers, no fitness/training references
- Whitelisted product set is the **5 DWA flagship products only**:
  1. Demand Radar (formerly Industry Pulse) — $149/mo
  2. Talent Radar (formerly TechAlert / HireAlert) — $149/mo
  3. Contractor Leads (PPL) — $399/mo
  4. FieldDesk — $199/mo
  5. Missed Call Catch — $99/mo
- Tool resolvers will **refuse** to query M2 tables (`training_programs`, `purchased_programs`, `team_rosters`, `coach_profiles`, `b2b_subscribers`, etc.) — not in the whitelist
- All output rendered in DWA dark teal theme (`#00d4ff` on `#0a1628`)
- Audit log records `brand="DWA"` on every command — if the planner ever drifts to M2 territory, function aborts

**End-to-end verification per product (will run before declaring done):**

| Product | Tool path tested | Recipient table | Draft template | Approval queue |
|---|---|---|---|---|
| Demand Radar | `find_high_confidence_signals` → `find_company_contact` → `generate_bulk_outreach` | `industry_pulse_signals` | demand_radar pitch | `email_reply_drafts` |
| Talent Radar | `find_hot_candidates_for_client` → `find_company_contact` → `generate_bulk_outreach` | `hire_alert_candidates` + `hire_alert_clients` | talent_radar pitch | `email_reply_drafts` |
| Contractor Leads | `find_unclaimed_leads` → `find_buyers_in_area` → `generate_bulk_outreach` | `contractor_leads` + `contractor_clients` | contractor_leads pitch | `email_reply_drafts` |
| FieldDesk | `find_company_contact` (HVAC/plumbing 3-15 techs) → `web_research` → `draft_outreach` | `field_crm_clients` + `business_listings_public` | fielddesk pitch | `email_reply_drafts` |
| Missed Call Catch | `find_stale_prospects` (no website / small biz) → `draft_outreach` | `business_listings_public` + `prospect_contacts` | missed_call pitch | `email_reply_drafts` |

Each one gets a dedicated "test prompt" in the function's QA suite that I'll run via the test endpoint before merging:
- *"Show me 5 demand radar signals and draft outreach to one buyer for each"*
- *"Find 5 nursing homes with low staffing and draft talent radar pitches"*
- *"Match 5 plumbing leads to 10 buyers and draft bulk emails"*
- *"Find 5 HVAC shops 3-15 techs and draft fielddesk pitches"*
- *"Find 10 small Detroit businesses with no missed-call system, draft pitches"*

---

### Files (unchanged from v2 + 2 small additions)

**NEW edge function**: `supabase/functions/admin-command/index.ts` (~700 LOC, was 600)
- Adds `generate_bulk_outreach` + `generate_bulk_sms` tool resolvers
- DWA-only system prompt + table whitelist + product whitelist
- Strict M2 table refusal logic
- Partial-result error handling

**NEW migration**: `<ts>_admin_command_log.sql` — same as v2

**NEW component**: `src/components/dwa-admin/AdminCommandBar.tsx` (~450 LOC, was 350)
- Mobile-first accordion result card
- Bulk drafts table with per-row edit/preview/skip + Queue All
- Recipient cards (not tables) under 768px
- Sticky-collapsing command bar

**EDITED**: `src/pages/DWAAdmin.tsx` — mount `<AdminCommandBar />` above tab strip (~5 LOC)

### What stays the same (verified non-breaking)
- All 6 background scanners
- All cron jobs
- All client-facing pages
- All existing admin tabs
- TCPA Manual-Only mandate
- Approval gate flow
- Stripe / webhooks / payments
- M2 Training site (zero touch — separate domain logic via `domainConfig.ts` already isolates them)
- All existing edge functions (only ADDS one new one)

### Cost ceiling (with bulk)
- Single command (no bulk): ~$0.01
- Bulk command (10 emails): ~$0.013
- Bulk command (25 emails): ~$0.018
- Daily cap: 100 commands → max ~$2/day
- Hard cutoff: refuse if >$5 spent in 24h

