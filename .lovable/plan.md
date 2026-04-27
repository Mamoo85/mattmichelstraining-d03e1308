## The Problem

When you click **"📧 Email Contractors"** on a real unclaimed lead, the blast function looks up `contractor_outreach_prospects` matching that lead's **trade + city** with a non-null email. If you haven't scraped that exact trade+city *and* enriched the results, the database is empty for that combination → you get `"No {trade} prospects in {city} with email. Scrape + enrich first."`

That's why every click failed: the lead's trade/city didn't have any enriched contractor emails on file.

## The Fix — One-Press Auto-Blast Button

Make the green "Email Contractors" button do the entire pipeline automatically:

```text
1. Read the lead's trade + city
2. Check existing prospects → if <N with email, scrape Google Maps for that trade+city
3. Enrich every unenriched prospect in parallel (waterfall: Snov → Apollo → Hunter → pattern → site-scrape)
4. Re-query prospects with email
5. Send the blast
6. Show progress toast at each step
```

### New Edge Function: `contractor-outreach-auto-blast`

Single endpoint that orchestrates the whole flow server-side (faster, no client round-trips, no race conditions):

- **Input**: `{ lead_id, price, max_contractors, target_email_count }`
- **Steps**:
  1. Load lead → derive `trade`, `city`, `state`
  2. Query existing prospects matching trade+city with email → count
  3. If count < target (default 10): invoke `contractor-outreach-scrape` internally with `{ trade, city, state, limit: 20 }`
  4. Query all matching prospects WITHOUT email (cap at 15 to stay under provider rate limits)
  5. Loop and call `contractor-outreach-enrich` per prospect with `Promise.all` in batches of 5
  6. Re-query prospects with email
  7. Run the existing email-blast logic inline (suppression check, daily cap, send via Resend)
  8. Return rich response: `{ ok, scraped, enriched, attempted, sent, skipped_suppressed, failures }`

### Frontend Changes — `ContractorOutreachPanel.tsx`

Replace the existing `blastLead()` to call the new auto-blast function and show step-by-step progress:

```text
Toast 1: "🔍 Scraping HVAC contractors in Detroit…"
Toast 2: "✨ Enriching 12 contractors (finding emails)…"
Toast 3: "📧 Emailing 8 contractors about James Rivera's water heater…"
Toast 4: "✅ Sent 7/8 · 1 suppressed"
```

Use `sonner`'s `toast.loading()` + `toast.success()` to update a single toast as the steps progress. Status comes from the edge function's response (single round trip — toast updates are timed by `setTimeout` to feel live).

Keep the price + count prompts but make defaults sticky (localStorage) so you don't re-type `59` and `10` every click.

### Bonus Quality-of-Life Fixes

1. **Smart price default**: pre-fill from last successful blast (localStorage `last_blast_price`).
2. **Smart count default**: same idea (`last_blast_count`).
3. **Empty-state copy**: if auto-blast scrapes 0 results (rare metro), show actionable error: *"Google Maps returned 0 {trade} contractors in {city}. Try a nearby metro or different trade."*
4. **Failure trace**: if 0 emails get found after enrichment, surface the exact reason from `meta.enrichment_trace` (e.g., *"All 12 contractors failed enrichment — Apollo returned 0 matches, Hunter has no domain coverage. Add APOLLO_API_KEY credits or try a denser metro."*).
5. **"Email Contractors" button label updates dynamically**: shows `Auto-blast (scrape+enrich+email)` on hover so you know it's the full pipeline now.

## Technical Details

**Files created**:
- `supabase/functions/contractor-outreach-auto-blast/index.ts` — orchestrator edge function

**Files edited**:
- `src/components/admin/ContractorOutreachPanel.tsx` — `blastLead()` now calls auto-blast + shows progress toasts; localStorage for defaults
- `supabase/config.toml` — add `verify_jwt = false` for the new function

**No DB migrations needed** — uses existing `contractor_outreach_prospects`, `contractor_outreach_audit_log`, `contractor_outreach_suppression`.

**Risk control**: auto-blast caps total work per click at: 1 scrape (20 rows) + 15 enrichments + 10 emails. Daily cap (100/day emails) still enforced. All sends still go through suppression + audit log.

**Why server-side orchestration**: doing this client-side would mean 3 round trips (scrape → wait → enrich loop → wait → blast) with the user staring at a blank screen. Server-side, it's one invoke that returns a complete summary.

## What stays the same

- Trade/city filters, suppression manager, audit drawer, consent flow, daily cap meters — all unchanged.
- The existing `contractor-outreach-email-blast` function stays available for anyone who wants to skip the auto-scrape step and blast existing prospects only.
- Provenance disclosures (verified vs guess) unchanged.

**Approve and I'll build it.**