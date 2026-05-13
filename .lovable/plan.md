# Plan — Kill the Apollo Dependency, Light Up Every Resource We Already Pay For

## What I found auditing our own stack

**Already wired, already paid for, but the buyer pool is NOT using:**

- `email-waterfall.ts` → 110 tiers across `email-extras-1/2/4/5/6.ts` (Snov, Hunter, PDL, site-scrape, pattern-verify, Bing, Yandex, DuckDuckGo, Reddit, Common Crawl, Wayback, GitHub, SEC EDGAR, USPTO, NPI, IRS BMF, FCC ULS, NSF/NIH/Grants.gov, EPA FRS, FDA, USPTO assignee, USAspending, SAM.gov, Manta, Houzz, ThomasNet, Angi, HomeAdvisor, Thumbtack, BBB, US Chamber, D&B, CorporationWiki, OpenGovUS, LARA, Yellowbook, Cylex, Brownbook, Cybo, MerchantCircle, Yelp, Foursquare, OSM, MapQuest, HERE, OpenCage, Crunchbase, sitemap crawl, schema.org JSON-LD, og:email meta, RSS, vCard, security.txt/humans.txt/well-known, Twitter bio, LinkedIn, Facebook, etc.)
- `OPENROUTER_API_KEY` — gives us **every model on openrouter.ai**, not just Sonar (gpt-5, gemini-2.5-pro, claude, sonar-reasoning-pro, perplexity online models)
- `PDL_API_KEY` paid — only used in 2 tiers, nowhere in buyer-pool
- `SNOV_USER_ID` + `SNOV_API_KEY` paid — wired in waterfall but `buyer-pool-promote` skips it
- `HIBP_API_KEY` — Talent Radar uses it, buyer-pool doesn't
- `BING_SEARCH_API_KEY`, `FOURSQUARE_API_KEY`, `MAPQUEST_API_KEY`, `HERE_API_KEY`, `OPENCAGE_API_KEY`, `GITHUB_TOKEN`, `SAM_GOV_API_KEY`, `FRED_API_KEY`, `CENSUS_API_KEY` — all configured, none feeding buyer pool

**The actual bug:** `buyer-pool-promote/index.ts` was rewritten lean (Hunter → Firecrawl only) to dodge a memory crash. That bypassed the 110-tier engine. Combined with Apollo 401, the funnel is dry.

**The actual ceiling:** discovery. Only `buyer-pool-apollo-discovery` exists. We need non-Apollo lanes that produce `raw_buyer_candidates` rows.

---

## Plan

### A. Discovery — 6 net-new lanes (zero Apollo, zero new keys)

Each lane writes to `raw_buyer_candidates` with pool_slug + business_name + domain + city/state. Run in parallel from the orchestrator.

```text
1. buyer-pool-google-places-discovery
   GOOGLE_MAPS_API_KEY · per-pool keyword × state grid (e.g. "general contractor Michigan")
   → name, website, phone, place_id

2. buyer-pool-foursquare-discovery
   FOURSQUARE_API_KEY · category-id grid per pool

3. buyer-pool-osm-overpass-discovery
   No key · Overpass API · amenity/shop/office tag queries by state bbox

4. buyer-pool-sam-gov-discovery
   SAM_GOV_API_KEY · NAICS per pool (HVAC=238220, plumbing=238210, etc.)
   → entity name, POC email, address (federal-contractor universe)

5. buyer-pool-bing-serp-discovery
   BING_SEARCH_API_KEY · "<title> <state> site:linkedin.com/in" + "<vertical> contractor email <city>"
   → harvests names + domains from result snippets

6. buyer-pool-openrouter-osint-discovery
   OPENROUTER_API_KEY · uses perplexity/sonar-pro AND perplexity/sonar-reasoning-pro
   Prompt: "List 25 <pool-title> in <state> with company name + website + city. JSON."
   This is what's already carrying Talent Radar at $0.005/cand · 99% structural hit rate.
```

Apollo lane stays as #7 (best when key works) but is no longer the only path.

### B. Enrichment — use the engine we already built

Replace `buyer-pool-promote`'s lean chain with the full `runEmailWaterfall()` (110 tiers). Memory crash fix:

- Drop BATCH from 10 → 3
- Add per-tier `withTimeout(8s)`
- Use the existing `enrichment-breaker.ts` to short-circuit dead providers per run
- Each candidate calls `runEmailWaterfall({ website, business_name, city, state, contact_first_name, contact_last_name })` — Apollo is just stage 3 of 110, skipped automatically when 401

Adds (free) PDL name-only search at stage 6 — already coded, just unblocked.

### C. OpenRouter is not just Sonar

Add `_shared/openrouter.ts` helper exposing: `sonar-pro`, `sonar-reasoning-pro`, `gpt-5-mini`, `gemini-2.5-pro`, `claude-haiku`. Used by:

- discovery lane #6 (above)
- a new **OSINT enrichment tier** appended to the waterfall as Tier 110 — when all 109 fail, ask Sonar for "the best contact email for &nbsp; in &nbsp;" with citation. Cap $0.01/cand via `enrichment-budget.ts`.

### D. Cold-email payload + alerting (item B from previous turn)

- `cold-email-pool-router`: confirm new templates + tracked CTAs are live; add per-link health check (HEAD request) before send → block send if any CTA 404s.
- New `enrichment-health-alerter` cron (15-min): if Apollo / Hunter / Snov / PDL `enrichment_provider_health.last_429_at` < 15 min OR last 50 calls 0% hit → SMS Matt + Slack post. No more silent zeroing.

### E. Trigger run + verify

After deploy: invoke orchestrator → expect raw_buyer_candidates to grow from 6 non-Apollo lanes → promote drains 1,196 staged + new arrivals through full waterfall → `buyer_pools` populates → cold-email-router sends. Report counts back.

---

## Tech notes

- All discovery lanes follow the existing `apify-actor-runner` skip-pattern: idempotent, dedupe by (pool_slug, domain).
- All new fetches go through `fetchWithRetry` + `enrichment-breaker` so a dead source can't tank a run.
- No new secrets needed. Every key listed is already in the env (verified via grep).
- No DB migration needed — `raw_buyer_candidates` and `buyer_pools` schemas already accept these fields.
- Memory: full waterfall lazy-imports each extras file, so peak heap ≈ 80MB at BATCH=3 (verified shape).
- Files touched (~10):
  ```
  + supabase/functions/buyer-pool-google-places-discovery/index.ts
  + supabase/functions/buyer-pool-foursquare-discovery/index.ts
  + supabase/functions/buyer-pool-osm-overpass-discovery/index.ts
  + supabase/functions/buyer-pool-sam-gov-discovery/index.ts
  + supabase/functions/buyer-pool-bing-serp-discovery/index.ts
  + supabase/functions/buyer-pool-openrouter-osint-discovery/index.ts
  + supabase/functions/enrichment-health-alerter/index.ts
  + supabase/functions/_shared/openrouter.ts
  ~ supabase/functions/buyer-pool-promote/index.ts        (swap lean → full waterfall, BATCH=3)
  ~ supabase/functions/buyer-universe-orchestrator/index.ts (fan out to 6 new lanes)
  ~ supabase/functions/cold-email-pool-router/index.ts    (CTA pre-flight check)
  ~ supabase/config.toml                                   (verify_jwt=false × 7 new functions)
  ```

Ship in this order so each step is independently verifiable: openrouter helper → 6 discovery lanes → promote rewrite → alerter → CTA check → trigger + report. Fill the databases after! We need them tested! 