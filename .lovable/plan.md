## What's actually broken (truth, blunt)

**Inventory & data quality:**

- 165 candidates total. Top-scored "candidates" are garbage: `Mr Pipey`, `Rocket Pros`, `Comfort Zone and`, `Marvin and Son`, even a phone number as a full_name. The `isPersonName()` filter in `miosha-license-scraper` is letting business names through because Yelp + PHCC + building-permits are pumping company names into `hire_alert_candidates`.
- 6.9% contactable, 1 LinkedIn URL across 165 rows. PDL and Sonar are wired but barely producing.
- `hire_alert_runs` shows last 2 runs returning `candidates_found: 0` — the wrapper `hire-alert-scanner` looks back only 25 hours from MIOSHA but the underlying `miosha-license-scraper` hasn't logged a real success in days (no logs returned at all).

**Wired but underused paid APIs:**

- **HUNTER_API_KEY, SNOV_API_KEY, LUSHA_API_KEY, CLAY_API_KEY** — all paid, all in secrets, **zero enrichment functions use them.** `lead-enrichment-waterfall` uses them for *lead/prospect* enrichment (B2B prospecting), not candidate enrichment.
- **APOLLO_API_KEY** — only in `lead-enrichment-waterfall`, free-plan blocked.
- **NURSYS_USERNAME/PASSWORD** — `test-nursys` exists as a connectivity test only. The real `scanNursys()` inside `miosha-license-scraper` scrapes an HTML page (`https://www.nursys.com/LQC/LQCSearch.aspx?state=MI`), NOT the authenticated JSON API at `api.nursys.com/api/enotify`. We're paying for the API and using a screen-scrape that almost certainly returns nothing.
- **DOL_API_KEY** — wired in secrets, never used.
- **HIBP** — used by 9 unrelated functions, never offered as a Talent Radar value-add.

**Architecture problems:**

- `hire-alert-scanner` only runs 2 sources (`scanMIOSHA` + `scanJobBoards`). It delegates MIOSHA to `miosha-license-scraper` (which runs 14 sources). So the "16+ source planetary scanner" only fires if `miosha-license-scraper` is invoked. Last 2 runs of `hire-alert-scanner` show `candidates_found: 0` — meaning `miosha-license-scraper` is failing or finding nothing new.
- Edge-function timeout hard cap is ~150s. `miosha-license-scraper` runs 14 sources sequentially via `Promise.allSettled` then upserts in a `for` loop with `await`. Heavy sources (Yelp×6 zips, PHCC×10 zips, Building Permits, NPI×5×15 cities = 75 calls) blow past timeout. There's no resumption — if it dies at S10 of 14, it just dies.
- No checkpointing. No "where it left off" state.

---

## The plan — execute in this order, no asking between steps

### Phase 1 — Stop the bleeding (data quality)

1. **Harden `isPersonName()**` in `miosha-license-scraper`: reject any name that's purely a phone number, contains only ALL-CAPS company tokens (`PRO`, `PROS`, `ZONE`, `BARGAIN`, `HANDYMAN`, etc.), ends in trade words, or has fewer than 2 alpha-words ≥ 2 chars. Add an `is_company_name = true` flag instead of inserting bad rows.
2. **Migration**: backfill `is_company_name = true` on the 30+ obvious garbage rows (`Mr Pipey`, `Rocket Pros`, `Comfort Zone and`, `Marvin and Son`, phone-numbers-as-names, `A1 Bargain`, `Drewski Handyman`, `Plumb Pros`, etc.) and **exclude `is_company_name = true` from all client-facing alerts and dashboards**.
3. **Yelp + PHCC + Building Permits** — these are *contractor business* sources, not *individual licensee* sources. Either repurpose them as B2B prospect feeders (TechAlert *clients*, not candidates) or aggressively strip business words and require a human first+last extracted from "Owner: X" patterns. Default: stop inserting them as candidates, route to a new `techalert_business_prospects` table (already partly exists as `techalert_prospect_targets`).

### Phase 2 — Fix Nursys properly (the user explicitly asked)

4. **Replace the HTML scrape `scanNursys()` with the real authenticated JSON API.** Mirror the working `test-nursys` pattern:
  - POST `/notificationlookup` daily with a 7-day window → get TransactionId → poll GET → parse new MI license changes.
  - For each notification, POST `/nurselookup` with the license number to get full details (name, license type, status, expiration, multi-state privilege).
  - Insert as candidates with `source = 'nursys_api'`, license number populated, full name populated.
5. Add **all nursing license types** to the scan: RN, LPN, APRN, CRNA, NP. Currently only RN/LPN.

### Phase 3 — Resumable checkpointed scanner (fix timeouts the right way)

6. New table `hire_alert_scanner_checkpoints (source TEXT, last_completed_at TIMESTAMPTZ, last_cursor JSONB, status TEXT)`. Each source records where it stopped.
7. Refactor `miosha-license-scraper` into a **dispatch + worker** model:
  - `miosha-license-scraper` becomes a 5-second dispatcher: for each of 17 sources, check if checkpoint says `due`, fire-and-forget invoke a per-source worker function (or queue via `EdgeRuntime.waitUntil`).
  - Each per-source worker has its own 60s budget, writes its own checkpoint on completion or partial-completion.
  - "Resume where it left off" = next cron tick reads checkpoint, picks up at `last_cursor` (e.g. next batch of NPI cities, next 10 PHCC zips, next 100 LARA val IDs).
8. **Wrap the LARA/MIOSHA `scanMiPLUS` enumerator in checkpointed pagination** — the `val.apps` portal is sequential ID enumeration; record `last_id` and pick up from there.

### Phase 4 — Full enrichment fan-out (use every paid API)

9. Rebuild `candidate-deep-enrich` as a **6-stage waterfall** that processes any candidate without contact info:
  - **Stage 1 — License-source** (already-have data: name, license #, license type, city, expiry).
  - **Stage 2 — NPI Registry** (free, healthcare only) → business phone, taxonomy, practice address.
  - **Stage 3 — PDL** (`PDL_API_KEY`) → mobile phone, personal email, LinkedIn URL, current employer, job title, years of experience.
  - **Stage 4 — Hunter.io** (`HUNTER_API_KEY`) → if employer found, find their @work-email pattern + email-finder by name+domain.
  - **Stage 5 — Snov.io** (`SNOV_API_KEY`) → second pass for email finding + verification (validates Hunter results).
  - **Stage 6 — Lusha** (`LUSHA_API_KEY`) → mobile phone + direct dial fallback when PDL misses.
  - **Stage 7 — Sonar OSINT** (`OPENROUTER_API_KEY`) → final fallback: open-web search for LinkedIn/Facebook + employer history. Only fires if stages 2-6 left holes.
  - **Stage 8 — Clay** (`CLAY_API_KEY`) → optional final waterfall enrichment if everything else missed; cost-gated to `score >= 7` only.
10. Each stage logs to a new `candidate_enrichment_log (candidate_id, stage, source, hit_fields TEXT[], cost_estimate NUMERIC)` so we can see per-source ROI.
11. Recompute `data_completeness` after each stage. Mark `enrichment_status='complete'` only when at least 1 contact channel (email OR phone) is found, otherwise `enrichment_status='exhausted'`.

### Phase 5 — Sector expansion (every license, every database)

12. Add scanners for the rest of MI LARA professions beyond trades + nursing:
  - Cosmetology, barbers, real estate, insurance, accountants, security guards, polygraph examiners, residential builders/maintenance & alteration contractors (RBMAC), MML mortgage loan officers.
    - Add a `LARA_PROFESSIONS` config array; each gets a checkpointed val-ID enumerator.
13. Add **DOL (`DOL_API_KEY`)** for federal apprenticeship completion records (newly minted journeymen) — high-intent talent.
14. Add MIOSHA hot-work / boiler operator certification expiry feed as a separate source (re-cert events = mobility signal).

### Phase 6 — HIBP value-add (use what we pay for)

15. New optional enrichment stage `hibp-new-hire-screen`: for any candidate added to a TechAlert client's pipeline at **claim time**, run their email through HIBP and surface "appears in N data breaches — flag for security review" as a value-add bullet on the dossier. Marketed as **"Free background-data hygiene check on every candidate."**

### Phase 7 — Verify + ship

16. Run the new `miosha-license-scraper` end-to-end, confirm `hire_alert_runs` rows show non-zero `candidates_found`.
17. Force-enrich the existing top 30 candidates through the new 8-stage waterfall; expect contactability to jump from 6.9% to 35-50%.
18. Backfill `is_company_name=true` on the garbage rows so the dashboard stops showing "Mr Pipey" as a $99-tier deliverable.
19. Generate **v5 sample PDFs** with the new enriched data (only the 5 that ship). Validate no garbage rows leak in.
20. Status memo `/mnt/documents/talent-radar-enrichment-v5.md` — what each new source produced, contactability before/after, per-stage hit rates, per-stage cost.

### Out of scope this sprint

- No UI rewrites. No pricing changes. No new client portal features.
- No Apollo upgrade — confirmed dead, replaced by the Hunter/Snov/Lusha/PDL/Clay stack.
- No edge-function renames (still `hire-alert-*`).

### What the user gets at the end

- A scanner that actually completes and resumes where it stopped.
- Nursys hitting the real authenticated API instead of a useless HTML scrape.
- Every paid API (Hunter, Snov, Lusha, Clay, PDL, HIBP, DOL) doing real work in a documented, logged waterfall.
- LARA coverage broadened from 4 trades + 2 nursing types to ~12+ professions with checkpointed enumeration.
- A clean candidate table where the top 9 scored rows are real humans, not "Comfort Zone and".
- One status memo + 5 v5 PDFs proving it.
- Lets run a real test after and show me what an actual customer would get. Make sure there are specifics and tons and tons of information. 