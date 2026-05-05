# Plan: Bump Ramp Cap + Drain Enrichment Pipeline

Two parallel actions to push today's send count toward 150 and refill tomorrow's pipeline.

## 1. Bump cold-email ramp cap (50 → 100)

Direct UPDATE against `cold_email_ramp_state` is blocked by RLS. Ship a one-shot SQL migration:

```sql
-- supabase/migrations/<ts>_bump_cold_email_ramp_cap.sql
UPDATE public.cold_email_ramp_state
SET current_cap = 100,
    base_cap = GREATEST(base_cap, 100),
    updated_at = now()
WHERE id = 1;
```

Effect: `cold-email-rebalancer` and `techalert-outreach` immediately see headroom up to 100/day and stop throttling at 50.

## 2. Aggressive enrichment drain

Trigger `outreach-leads-enrich` with `{ drain: true, limit: 200 }` to pull every un-enriched `outreach_leads` row through the upgraded 5-tier waterfall (Apollo → Hunter → pattern-verify → PDL → Snov/crt.sh/RDAP).

Then re-kick downstream consumers so newly-enriched rows get drafted/queued today:
- `cold-email-rebalancer` (refill outbox from approved queue)
- `techalert-outreach` (D0 cold sends against newly-enriched prospects)
- `channel-prospector` (top up `outreach_leads` pipeline so tomorrow's drain has fuel)

## 3. Verify enrichment health after drain

After the drain finishes, query for proof of life:
- Count of `outreach_leads` rows with `enriched_at >= today` and a non-null `owner_email`
- Per-tier hit-rate from `meta.enrichment_trace` (which provider closed each lead)
- Any 5xx/credit-exhausted errors in `system_comms_log` for `apollo`, `hunter`, `pdl`, `snov`, `firecrawl`

If any provider is hard-down, surface it with a one-line summary so we can decide whether to add another source (e.g. ZoomInfo Lite, Clearbit Discovery, or Skrapp.io) before tomorrow's run.

## Technical details

- Migration only changes data in a single config row; safe to re-run conceptually but written as a one-shot.
- Drain is bounded by `limit: 200` to avoid blowing through Apollo/Hunter credits in one shot.
- All enrichment calls go through the existing waterfall in `outreach-leads-enrich/index.ts` (already hardened this session with the `HUNTER_API_KEY` fix and the `runEmailWaterfall` 5th tier).
- No schema changes, no new tables, no RLS edits.

## Out of scope

- Forcing 150 sends today by bypassing approval queue or mailing un-validated addresses (deliberately rejected earlier — domain-reputation risk).
- Onboarding new enrichment vendors today; only flag gaps for a follow-up if the audit finds a dead provider.