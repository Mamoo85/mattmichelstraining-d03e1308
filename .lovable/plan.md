

## Plan: Fix False Alerts + AI-Suggested Replies + Onboard First Contractor

### Part 1 — Kill the false "DEAD PIPE" + "Enrichment RED" alerts

**Root cause #1 — Wrong column in cron-sentinel dead-pipe check (`cron-sentinel/index.ts` line 267):**
The query orders by `started_at` but the `hire_alert_runs` table uses `run_at`. Because `started_at` doesn't exist (or is always NULL), the query may return rows in random order, which is why you got "DEAD PIPE" while the scanner actually found 35 candidates at 04:36 UTC today.

Fix: change `.order('started_at', ...)` → `.order('run_at', ...)`. Also add a sanity guard: only fire if the most recent run is < 6 hours old (otherwise the scanner is just paused, not dead) and require all 3 runs to be from the same `source` (the table mixes `source='miosha'` and `source='all'` rows — currently the check averages across both, which is why you see false zeros).

**Root cause #2 — Stale heartbeat threshold too aggressive (`enrichment-health-check/index.ts` line 107):**
Right now ANY heartbeat older than 360 min (6 hrs) = RED + SMS. The `candidate-deep-enrich` agent only runs when there's something in the queue — if the queue is empty, the heartbeat goes stale even though everything is healthy.

Fix:
- Bump threshold from 360 min → 1440 min (24h)
- Only fire if there are ALSO `stuck_pending` candidates (i.e., real backlog, not just an idle agent)
- Add the same 24-hour cooldown we just added to `llm-cache-monitor` (currently only 4-hour cooldown, which is why you got it twice today)

### Part 2 — AI-suggested replies in the SMS Inbox (you stay in control)

Build a **two-track approval system** so you can either review on the website OR by text:

**Track A — Inline in `/dwa-admin` SMS Inbox (`AdminSMSInbox.tsx`):**
- Add a **"🤖 Draft reply"** button next to the message input on every inbound thread
- Click → calls a new edge function `draft-sms-reply` that:
  - Pulls the full thread context (last 10 msgs)
  - Pulls product context (contractor lead pricing, FAQ, your tone)
  - Returns a 1–2 sentence draft via Lovable AI Gateway (`google/gemini-2.5-flash`)
- Draft auto-fills the textarea — you can **edit freely** before hitting Send
- Three quick-action buttons under the draft: **✏️ Edit** (default — already in textarea), **✅ Send as-is**, **🔄 Regenerate**

**Track B — Text-to-approve flow (when you're driving / not at desk):**
- New edge function `auto-draft-on-inbound` runs whenever a new inbound SMS hits `system_comms_log`
- It generates a draft AND texts you a preview from the work line:
  > `📩 [contractor name]: "their message..."\n\n💡 Suggested reply:\n[draft]\n\nReply A to send, E to edit, or just type your own reply`
- New routing in `inbound-sms-relay`:
  - You text **"A"** → sends the suggested draft as-is to the contractor, marks resolved
  - You text **"E [your version]"** → sends your edit
  - Anything else → treated as your custom reply (existing behavior, unchanged)
- One safety rule: **never auto-send without your explicit "A"** — TCPA + brand control

### Part 3 — Onboarding playbook for the +17346207178 contractor

This contractor is asking real qualifying questions ("how does it work? how much?"). Here's a clean reply you can send right now from the SMS Inbox (already prefilled by the new AI feature once shipped):

> Here's the short version:
>
> 1. You pick your trade + city. I lock that territory to you (one contractor per trade per city — no shared leads).
> 2. When a homeowner in your area requests a quote on detroitwebagent.com, you get an instant SMS with their name, number, and job details.
> 3. $399/mo flat — no per-lead fees, no contracts. Cancel anytime.
> 4. You can claim multiple cities — each city is a separate territory at $399/mo.
>
> Want me to send the signup link for your trade + city? Or jump on a 5-min call: (313) 992-1219.

I'll also add a **📋 Onboarding Cheatsheet** panel inside the SMS Inbox (collapsible header, only shows when an unidentified phone is selected) with:
- Pre-written answers to the top 8 questions ("How are leads generated?", "What if a lead is bad?", "Cancellation?", "Multiple territories?", "Exclusivity proof?", "Average leads/month?", "Refund policy?", "How do I get notified?")
- Each answer has a **📋 Copy** button → drops it into the reply box, ready for you to personalize and send

### Files to change

| File | Change |
|---|---|
| `supabase/functions/cron-sentinel/index.ts` | Fix dead-pipe column + 6h freshness guard + same-source check |
| `supabase/functions/enrichment-health-check/index.ts` | Heartbeat threshold 360→1440 min, require stuck_pending > 0, cooldown 4h→24h |
| `supabase/functions/draft-sms-reply/index.ts` | NEW — generates AI draft from thread + product context |
| `supabase/functions/auto-draft-on-inbound/index.ts` | NEW — DB trigger or cron polling new inbound rows, texts you the preview |
| `supabase/functions/inbound-sms-relay/index.ts` | Route "A" / "E ..." commands to send the cached draft |
| `src/components/dwa-admin/AdminSMSInbox.tsx` | Add 🤖 Draft button, regenerate flow, onboarding cheatsheet panel |
| Migration | New table `sms_reply_drafts` (phone, draft_body, created_at, status) for the text-to-approve cache |

### Risk
Low. AI drafts never auto-send. False-alert fixes are pure threshold/column changes — the underlying scanners keep running.

### What you'll see after the fix
- No more "Enrichment RED 706min stale" or "TechAlert DEAD PIPE" texts unless something is actually broken
- Cap of 1 LLM cache + 1 enrichment alert per 24 hours
- Every inbound SMS triggers a draft preview text within 60 seconds — you reply "A" to fire it, or "E [your edit]" to send a tweaked version
- In `/dwa-admin` → SMS Inbox: a 🤖 Draft Reply button + an Onboarding FAQ panel with 8 copy-paste answers ready for the +17346207178 contractor

