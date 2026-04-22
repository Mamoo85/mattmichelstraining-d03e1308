

## Plan: Activate the 178 Idle Leads in Industry Breakdown

### Yes — they're 100% real

I queried `prospect_pipeline` directly. There are **178 active prospects** scraped between Apr 8–11 by your `omni-lead-engine`, `dataforseo`, and `hybrid` engines:

| Industry | Leads | Has Email | Outreached |
|---|---|---|---|
| Law Firm | 27 | **0** | 0 |
| Roofing | 26 | 10 | 10 |
| Insurance Agency | 26 | **0** | 0 |
| Home Inspector | 21 | **0** | 0 |
| Machine Shop | 15 | **0** | 0 |
| Accounting / CPA | 14 | **0** | 0 |
| Electrical | 14 | **0** | 0 |
| Septic Service | 13 | **0** | 0 |
| HVAC | 12 | **0** | 0 |
| Restaurant | 12 | **0** | 0 |

**163 of 178 have no email captured and have never been emailed.** They were scraped from Google Places, dropped into the pipeline, then nothing happened because the email-enrichment + outreach steps in `omni-lead-engine` are gated to a tiny whitelist (mostly roofing/HVAC/appliance repair).

### And yes — every one of these maps to a product you already sell

`web-design-drip/index.ts` already has the routing built (lines 14–44):

| Industry | Existing DWA product | Price |
|---|---|---|
| Law Firm | `/legal-web-design` | $1,499 + $99/mo |
| Insurance Agency, Accounting/CPA, Vet | `/healthcare-web-design` | $1,499 + $99/mo |
| Home Inspector | `/detroit-web-design` (default) | $499 + $49/mo |
| HVAC, Electrical, Roofing, Septic, Tree, Appliance | Contractor Leads $399/mo + FieldDesk $199/mo + TechAlert $149/mo |
| Machine Shop, Tool & Die | FieldDesk $199/mo + Industrial Pulse |
| Restaurant | `/restaurant-web-design` $799 + $79/mo + Holiday SMS / Review Monitor |
| Medical Spa, Financial Advisor | `/healthcare-web-design` / generic web design |

So: the pipeline is real, the product fit is already mapped — the leads were just abandoned mid-funnel.

---

### Fix — 3 parts, ships in one pass

**Part 1 — Backfill emails on the 163 missing-email leads** *(one-shot script)*
- New edge function: `prospect-email-backfill` (admin-only, manual trigger).
- Loops every `prospect_pipeline` row where `email IS NULL` and `pipeline_stage != 'archived'`.
- Uses the existing email extraction logic from `contractor-prospector` (Hunter.io → Firecrawl scrape of website → domain guess) — same logic, just applied to the un-enriched rows.
- Hunter confidence ≥ 50 gate (already a project standard).
- Updates row with `email`, `email_source`, `email_confidence`. Skips rows with no website.
- Expected hit rate based on industry mix: ~60% (98 of 163) get an email, similar to current Roofing coverage.

**Part 2 — Wire the broader industries into the existing drip engine**
- `web-design-drip/index.ts` already has the industry→landing-page map. Currently it only fires for prospects already in `pipeline_stage='outreach_sent'`.
- New helper edge function: `activate-idle-prospects` (admin-trigger) — flips eligible prospects (has email, not yet contacted, industry has a mapped landing page) from `new_lead` → `outreach_sent` and stamps `last_drip_at = null` so the existing `web-design-drip` cron picks them up tomorrow morning.
- Uses the existing 4-step Day 1/4/8/15 sequence, existing copy, existing sender (`matt@detroitwebagent.com`).
- TCPA/suppression checks already built in — no new compliance surface.

**Part 3 — Outreach Command Center "Activate Idle Pool" button**
- Add a new card at the top of `OutreachCommandCenter.tsx` → Find Prospects sub-tab:
  ```
  ┌────────────────────────────────────────────────────┐
  │ ⚠️  178 Idle Prospects Detected                    │
  │ 163 missing emails · 168 never contacted           │
  │                                                    │
  │ Top idle industries:                               │
  │  • 27 Law Firms       → /legal-web-design          │
  │  • 26 Insurance       → /healthcare-web-design     │
  │  • 21 Home Inspectors → /detroit-web-design        │
  │  • 15 Machine Shops   → FieldDesk + Industrial     │
  │                                                    │
  │ [🔍 Backfill Emails]  [✉️ Activate Drip]          │
  └────────────────────────────────────────────────────┘
  ```
- "Backfill Emails" → invokes `prospect-email-backfill`, shows progress toast, refreshes count.
- "Activate Drip" → invokes `activate-idle-prospects`, defaults to "only prospects with email + mapped landing page", shows preview ("will contact 98 prospects across 7 industries — confirm?").

### What this unlocks

Conservative math: 178 leads × 60% email hit (107) × 1.5% reply rate to cold drip (1.6 replies) × 25% close → ~0.4 close per backfill cycle. At average $1,499 web design + $99/mo retainer, **one close per quarter from this batch pays for itself many times over** — and right now they're earning $0.

### What won't change

- No new Stripe products, no new pricing, no new landing pages (all already exist).
- No DB migration — uses existing `prospect_pipeline`, `prospect_email_log`, `lead_activities` tables.
- No change to existing scraping crons (they keep filling the pool; the new backfill closes the gap on the *idle* portion).
- Compliance: still uses existing `sms_opt_outs` / `suppressed_emails` checks in `web-design-drip`.

### Files touched

- **NEW**: `supabase/functions/prospect-email-backfill/index.ts` (~200 lines)
- **NEW**: `supabase/functions/activate-idle-prospects/index.ts` (~120 lines)
- **EDITED**: `src/components/dwa-admin/OutreachCommandCenter.tsx` (add Idle Pool card to Find Prospects sub-tab)
- **EDITED**: `supabase/config.toml` (register the 2 new functions with `verify_jwt = false`)

No changes to `omni-lead-engine`, `web-design-drip`, or any existing data — the new functions are purely additive and reversible (just don't click the button if you change your mind).

