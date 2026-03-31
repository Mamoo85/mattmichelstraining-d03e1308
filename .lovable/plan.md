

# Build: 3-Agent Autonomous Acquisition Engine + Fix Build Error

## Build Error Fix (First)

The `process-email-queue/deno.json` import map is broken — the `npm:@lovable.dev/email-js` specifier doesn't resolve correctly with the current esm.sh mapping. Fix: change the import map entry to use the bare `npm:` specifier that Deno's `nodeModulesDir: auto` already handles, removing the broken esm.sh redirect.

## The 3-Agent Architecture

This refactors the existing prospecting pipeline into three distinct, autonomous agents that chain together automatically. No new tables needed — everything runs through the existing `outreach_leads` table with status field transitions.

```text
┌──────────────────────────────────────────────────────────┐
│                    AGENT PIPELINE                        │
│                                                          │
│  Agent 1: THE SCOUT (Recon & Qualification)              │
│  ├── Trigger: New lead added to outreach_leads           │
│  ├── Analyzes: Google reviews, website, lead capture     │
│  ├── Scores: lead_score (1-10)                          │
│  ├── Outputs: target_service, custom_flaw, score         │
│  └── If score >= 7 → triggers Agent 2                    │
│                                                          │
│  Agent 2: THE SNIPER (Outbound Copywriter)               │
│  ├── Trigger: Agent 1 scores lead >= 7                   │
│  ├── Writes: 4-sentence cold email (no fluff)            │
│  ├── CTA: "Can I send you a 3-min Loom breakdown?"       │
│  ├── Auto-sends via Resend                               │
│  └── Updates lead status to "Emailed"                    │
│                                                          │
│  Agent 3: THE NEGOTIATOR (Inbox Manager)                 │
│  ├── Trigger: Reply detected by ai-reply-detector        │
│  ├── Classifies: Interested / Objection / Hard No        │
│  ├── Drafts auto-reply based on category                 │
│  ├── Handles objections autonomously                     │
│  └── Sends reply + notifies Matt if hot lead             │
│                                                          │
│  Volume Cap: Max 40 cold emails/day (domain safety)      │
└──────────────────────────────────────────────────────────┘
```

## Implementation Steps

### 1. Fix `process-email-queue/deno.json` Build Error
Remove the broken esm.sh import mapping. The `npm:` prefix with `nodeModulesDir: auto` handles resolution natively.

### 2. Refactor `prospect-local-businesses` → Agent 1 + Agent 2 Pipeline
Currently the prospector does everything in one pass: discover, score, write email, send. Refactor so it:
- **Agent 1 (Scout)**: After Google Maps discovery, runs AI qualification against 3 triggers (reviews < 20, no lead capture form, no chat widget). Outputs structured JSON: `target_service_to_pitch`, `custom_flaw_observation`, `lead_score`. Stores results in `outreach_leads.notes` and a new `lead_score` column.
- **Agent 2 (Sniper)**: For leads scoring 7+, generates the 4-sentence cold email using the Scout's `custom_flaw_observation` as Sentence 1. Strict rules: no corporate fluff, max 4 sentences, CTA = Loom video offer. Auto-sends via Resend.

This stays as one edge function (`prospect-local-businesses`) but with the two AI calls chained: Scout prompt → score check → Sniper prompt → send.

### 3. Upgrade `ai-reply-detector` → Agent 3 (The Negotiator)
Currently it only classifies replies and notifies Matt. Upgrade to:
- Classify into: Positive/Interested, Objection/Skeptical, Hard No
- **If Positive**: Auto-draft warm reply with calendar link + Loom demo link, auto-send via Resend
- **If Objection**: Identify specific objection (too busy, already use someone, price) and auto-send the matching neutralization response
- **If Hard No**: Auto-send graceful close, mark lead as "closed"
- All auto-replies sent from `matt@mattmichelstraining.com`, BCC'd to `matthewmichels4@gmail.com`
- Still notifies Matt immediately for Interested leads

### 4. Add `lead_score` Column to `outreach_leads`
New integer column (1-10) to store Agent 1's qualification score. Filter Agent 2 on `lead_score >= 7`.

### 5. Add Daily Volume Cap
Track daily cold email count in `email_send_log`. If 40+ emails sent today with `template_name = 'cold_outreach'`, stop sending and log "daily cap reached." This protects the domain from blacklisting.

### 6. Update Existing Cron Jobs
No new cron jobs needed — the existing `prospect-local-businesses` daily cron already triggers the pipeline. The `ai-reply-detector` is already triggered on incoming replies. Just wire the agents into the existing flow.

## Technical Details

- Agent 1 system prompt uses structured JSON output via the Lovable AI Gateway (`gemini-2.5-flash-lite`)
- Agent 2 system prompt enforces 4-sentence limit, no corporate language, Loom CTA
- Agent 3 system prompt handles 3 categories with pre-built objection rebuttals
- All AI calls go through `https://ai.gateway.lovable.dev/v1/chat/completions`
- Volume cap: 40 emails/day per domain (safe for Resend + Google deliverability)
- Existing global city expansion plan integrates naturally — Agent 1 scores leads regardless of geography

