

## Email Backfill Waterfall — Hunter Replacement Plan

**Problem**: `prospect-email-backfill` only uses Hunter.io → site scrape. Hunter credits almost gone. Other "filling" buttons (Run Scrape, Re-score, contractor-prospector) only call Hunter on the email lookup step. We already have Snov.io, Apollo.io, Lusha, and PDL keys configured but they're not wired into the backfill button.

### Best Hunter alternatives — ranked

| Rank | Service | Why | Status |
|---|---|---|---|
| 1 | **Snov.io** | Domain search + email finder + verifier. ~50% cheaper than Hunter. Already paid for. | ✅ Key already in env |
| 2 | **Apollo.io** | Free tier returns 1 verified email/match. Best for company → decision-maker name+email. | ✅ Key already in env |
| 3 | **PDL (People Data Labs)** | Pay-per-result. Strong on personal/mobile fields when others miss. | ✅ Key already in env |
| 4 | **Site scrape** (existing) | Free. Keep as final fallback. | ✅ Already working |
| 5 | **MX-pattern guess + Snov verify** | Free generation, cheap verification. `info@`, `contact@`, `firstname.lastname@`. | New — uses existing Snov key |

Hunter stays as **last paid step** so we drain it slowly instead of slamming it.

### New waterfall order (cheapest → most expensive)

```text
Site scrape (free)
   └─→ Snov.io domain search (cheap, owned)
         └─→ Apollo.io people/match (free tier)
               └─→ Pattern guess + Snov verify (cheap)
                     └─→ Hunter domain search (LAST RESORT)
                           └─→ PDL person enrich (premium, only if business_name + city)
```

Stop at first hit with confidence ≥ 50. Log which provider filled the field into `prospect_pipeline.meta.enrichment_trace` (the schema already supports this).

### Files to change

1. **`supabase/functions/prospect-email-backfill/index.ts`** — replace single Hunter call with 5-step waterfall. Add Snov + Apollo + pattern-verify functions (copy patterns from `lead-enrichment-waterfall/index.ts` which already has working Snov/Apollo code). Track per-source hit counts in response.

2. **`supabase/functions/_shared/email-waterfall.ts`** (NEW) — extract the waterfall into a shared module so:
   - `prospect-email-backfill`
   - `contractor-prospector` (currently Hunter-only on email step)
   - `targeting-prospect-scraper`
   - `enrich-prospect-pool`
   - `candidate-deep-enrich`
   
   ...all use the same provider order. Single place to reorder providers when Snov runs low.

3. **`src/components/dwa-admin/OutreachCommandCenter.tsx`** —
   - Update the toast to show all 5 sources: `"Snov: 12 · Apollo: 8 · Pattern: 4 · Hunter: 2 · PDL: 1 · Scrape: 6"`
   - Update the helper text under the panel: "Backfill walks Snov → Apollo → pattern-verify → Hunter → PDL → site scrape. Cheapest providers first."
   - Add a small **Provider Health** chip row showing remaining credits per service (read from a new `enrichment_provider_health` table, see #5).

4. **Other "filling" buttons audit** — extend the same waterfall into:
   - **Run Scrape** (`targeting-prospect-scraper`) — currently only scrapes Google Places, no email enrichment on the way in. Add waterfall as a final pass before insert.
   - **Re-score Pool** — score-only, no enrichment. Add an optional "enrich missing fields first" checkbox in the UI.
   - **Contractor Prospector** cron — already does Hunter; swap to shared waterfall.

5. **Migration** `enrichment_provider_health` table — `provider TEXT PRIMARY KEY, credits_remaining INT, last_429_at TIMESTAMPTZ, daily_calls INT, daily_hits INT, updated_at TIMESTAMPTZ`. Updated on every call; surfaces in the admin Provider Health chip and lets the waterfall **auto-skip** any provider that 429'd in the last hour.

### Behavior changes the user will see

- "Backfill Emails" button now hits ~3× more prospects per run because it has 5 fallback sources instead of 1
- Toast shows per-provider breakdown so you know which key to top up next
- Provider Health row above the buttons: 🟢 Snov 1,847 · 🟢 Apollo 230 · 🟡 Hunter 47 · 🟢 PDL 12 · 🟢 Scrape free
- When Hunter hits 0, the waterfall skips it silently — no broken runs

### Out of scope (call out if you want them)

- Adding **Dropcontact** or **Skrapp** as 6th/7th providers (would need new API keys + secrets — not free)
- Auto-purchasing top-ups via Stripe when a provider goes red
- Fax/postcard/phone field backfill (this plan is email-only — same waterfall pattern can be applied later for phone via Lusha + PDL + Apollo phone)

### Recommendation on which to top up next

When Hunter runs dry: **don't replace it — top up Snov.io instead.** Snov's $40/mo Starter = 1,000 credits = ~5× more email finds per dollar than Hunter at the same tier. Apollo's free tier (50 credits/mo) covers the gravy on top.

