

## Goal

Make sure +17346207178 / our new Livonia electrician gets removed from all cold outreach, and add a 90-day grace period rule so we never double-pitch the same business across any of our outreach engines.

## What's broken today

1. **No "is this already a paying client" check** in `contractor-prospector`, `dead-lead-outreach-drip`, `tom-autonomous`, or any cold outreach. A signup in `contractor_clients` / `field_crm_clients` / `hire_alert_clients` does NOT auto-suppress that business or phone from future cold pitches.
2. **Dedupe is weak** — `contractor-prospector` only checks `outreach_leads` by `business_name + city`. If the same business appears under a slightly different name, or via a different engine (Tom, dead-lead drip), it gets pitched again.
3. **No 90-day cooldown** — `outreach_cooldowns` exists but is only used by `dwa-closer`. It has no `expires_at` and isn't checked by any other prospector.
4. **The new electrician is not yet protected.** He hasn't paid (no `contractor_clients` row yet), so even after he pays, today's code would still cold-email him next week if his business shows up in a Google Places scan.

## The fix — 3 parts

### Part 1: Suppress the new electrician immediately

- Add his phone (`+17346207178`) to `sms_opt_outs` with `source = 'manual_client_protection'`.
- If/when we learn his email + business name, add to `suppressed_emails` + insert into a new `outreach_blocklist` table (below).
- Texts already sent stay; he just won't get any future cold/drip outreach.

### Part 2: Build a unified `outreach_blocklist` table (90-day grace)

New table — one row per business/phone/email/domain we should not cold-contact:

```text
outreach_blocklist
├── id uuid pk
├── business_name text (lowercase, trimmed)
├── phone text (E.164)
├── email text (lowercase)
├── domain text (lowercase, no www)
├── reason text  -- 'paying_client' | 'manual_client_protection' | 'replied' | 'opted_out' | 'recent_outreach'
├── source_table text  -- e.g. 'contractor_clients', 'hire_alert_clients'
├── blocked_until timestamptz  -- NULL = forever, else 90 days from now
└── created_at timestamptz default now()
```

Indexes on `phone`, `email`, `domain`, `lower(business_name)`.

**Auto-population via DB triggers** — on insert into any of these tables, write a `forever`-block row (no expiry, reason `paying_client`):
- `contractor_clients`
- `field_crm_clients`
- `hire_alert_clients`
- `missed_call_clients`
- All `*_clients` tables for paying products (one trigger function reused).

**Auto-population from outreach itself** — every time `contractor-prospector`, `tom-autonomous`, `dead-lead-outreach-drip`, `dwa-closer`, `pipeline-batch-drip` sends a cold message, also upsert into `outreach_blocklist` with `reason='recent_outreach'` and `blocked_until = now() + 90 days`. This is the 90-day grace period.

### Part 3: Add a shared `isBlocked()` helper and call it everywhere

New file: `supabase/functions/_shared/outreach-blocklist.ts`

```text
isBlocked(sb, { phone?, email?, business_name?, domain? }): Promise<{blocked: boolean, reason?: string}>
recordOutreach(sb, { ...identifiers, agent }): write 90-day block
```

Wire `isBlocked()` into the front of every outreach loop:
- `contractor-prospector` — before sending each pitch
- `tom-autonomous` — before queueing a draft
- `dead-lead-outreach-drip` — before D4/D8 follow-ups (so paying clients don't get follow-ups to the original cold pitch)
- `dwa-closer` — replace its current 7-day `outreach_cooldowns` check with the unified 90-day one
- `pipeline-batch-drip` — before each batch send

Also keep the existing `sms_opt_outs` and `suppressed_emails` checks — `_shared/twilio.ts` and email senders already honor those.

### Part 4: Backfill

One-time migration step:
- Insert a `forever` block row for every existing record in `contractor_clients`, `field_crm_clients`, `hire_alert_clients`, `missed_call_clients`, etc.
- Insert a 90-day block row for every email in `prospect_email_log` / `system_comms_log` sent in the last 90 days.

This guarantees no current client or recently-contacted prospect gets re-pitched.

## What the user will see

- Dashboard: a new "🛡️ Outreach Blocklist" card in DWA Admin showing total blocked, expiring soon, and reasons breakdown.
- Daily prospector logs will show a `blocked_by_grace_period` count alongside the existing `skipped` count.
- Zero risk of cold-pitching the new Livonia electrician — both his phone (immediate) and his business+domain (the moment Stripe webhook fires `contractor_lead_subscription`) will be permanently blocked.

## Files touched

- `supabase/migrations/<new>.sql` — `outreach_blocklist` table + indexes + triggers on 5–8 client tables + backfill
- `supabase/functions/_shared/outreach-blocklist.ts` — new helper
- `supabase/functions/contractor-prospector/index.ts` — add `isBlocked()` + `recordOutreach()`
- `supabase/functions/tom-autonomous/index.ts` — same
- `supabase/functions/dead-lead-outreach-drip/index.ts` — same
- `supabase/functions/dwa-closer/index.ts` — replace old cooldown logic
- `supabase/functions/pipeline-batch-drip/index.ts` — same
- `src/components/dwa-admin/AdminOutreachBlocklist.tsx` — new admin tab
- `src/pages/DWAAdmin.tsx` — register tab

## Immediate action (independent of full build)

Even before approving the full plan, I'll insert the electrician's phone into `sms_opt_outs` so today's drips can't touch him.

