# Lawyer Search Engine — Honest Audit + Path to Monetization

## TL;DR

The search engine **works** but it is **not good enough to sell to lawyers as-is**. Roughly 30–40% of what it returns is real value; 60% is either a thin Perplexity wrapper a lawyer can replicate for $20/mo, or fragile consumer-site scrapes that compete with free tools. There is no paywall, no auth gate, no trial counter, no tests, and the brand name ("Tenant Intel") actively contradicts the legal disclaimer underneath it.

That said — there **is** a real, narrow opportunity: a **Michigan litigation-discovery search tool** priced at $49–$79/mo with a 7-search trial. Not a TLO/Accurint replacement. A focused, defensible niche product. Details below.

---

## What we actually have today

**Frontend:** `src/pages/TenantIntel.tsx` at `/tenant-intel`. Categorized result UI (severity badges, expandable sections, share-by-URL). Anonymous, no auth, no quota.

**Backend:** `supabase/functions/tenant-intel-search/index.ts` (815 lines). 28 sources fired in parallel via `Promise.allSettled`, fail-graceful, ~10–20s response time.

**DB:** `tenant_intel_searches` table just logs queries.

**Source breakdown — what's real vs what isn't:**


| Tier                        | Sources                                                                                                                           | Honest assessment                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Strong (keep)**           | CourtListener (federal bankruptcy/civil/criminal/tax), NSOPW, FBI Most Wanted, SAM.gov exclusions, OSHA, EPA ECHO, OpenCorporates | Real public APIs, real value. But all are also free directly to anyone.                                                                                           |
| **Strong, MI-only**         | Wayne / Oakland / Detroit assessor parcels, Detroit Blight, Detroit Vacant Property Registry, Michigan LARA                       | This is our actual moat — high-quality MI county/city data wired in one place. Useless outside MI.                                                                |
| **Fragile (rip out)**       | FastPeopleSearch, TruePeopleSearch, Whitepages, USPhoneBook, MI OTIS, MI LARA scrape                                              | Firecrawl scrapes of consumer data-broker sites. Heavy bot protection, regex-parsing markdown, no tests, breaks silently. Lawyers recognize these as "free junk." |
| **High legal/quality risk** | 7 Perplexity Sonar calls (evictions, criminal, news, social, business, liens, probate)                                            | Half our perceived breadth. But Sonar can hallucinate, we don't verify citations, and a lawyer with Perplexity Pro ($20/mo) gets the same answer. No moat.        |


**Wiring status:**

- Route registered ✅
- Edge function deployed ✅
- DB table created ✅ (two duplicate migrations actually — `20260508100000` and `20260509001150`, you'll want to drop one)
- **Tests:** none. No Deno tests, no Playwright spec, no QA harness for the scrapers.
- **Auth/paywall:** none. Anonymous, anyone can hammer it.
- **Trial counter:** none.
- **Stripe checkout:** none.
- **PDF export:** none.
- **Case/matter audit log:** none.

**Bug worth flagging now:** the page is branded "Tenant Intel" but the disclaimer correctly says "Not for commercial tenant screening without FCRA-compliant process." Tenant screening is the one use case the disclaimer excludes. If a customer uses this for screening and gets sued, the brand name is exhibit A. Rename before any sale.

---

## Competitor reality check

This is what lawyers and PIs actually use today (verified pricing, May 2026):


| Tool                              | Audience                        | Pricing                                                       | What we can't match                                                  |
| --------------------------------- | ------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| **LexisNexis Accurint for Legal** | Mid/large firms                 | $5.37 / person search, $7.05 advanced, ~$99–500/mo + per-pull | Credit headers, SSN trace, DPPA DMV data, 50-state eviction database |
| **TLOxp (TransUnion)**            | PIs, attorneys                  | ~$0.25–$1.00/pull, $50+/mo, requires credentialing            | Same as above + utility connections, real-time address updates       |
| **IRBsearch**                     | PIs, debt collectors, attorneys | Transactional or $99–200/mo                                   | GLBA-credentialed data                                               |
| **Tracers**                       | PIs, skip-tracers               | $50–150/mo + per-pull                                         | Same                                                                 |
| **BeenVerified**                  | Consumer (not legal)            | $36.89/mo unlimited                                           | Nothing we don't have, but not lawyer-grade either                   |
| **Perplexity Pro**                | Anyone                          | $20/mo                                                        | This is our actual competitor for the Sonar layer of our product     |


**The unbridgeable gap:** TLO/Accurint/IRB/Tracers all have **GLBA/DPPA-credentialed access** to credit headers, DMV, and SSN-linked data. That requires the company to be vetted, audited, and bonded as a "consumer reporting agency" or equivalent. We can't self-onboard into that. Any lawyer who needs SSN-trace or DMV records will buy TLO regardless of our price.

**Where competitors are weak — our actual opening:**

- TLO/Accurint are **expensive** and have **per-pull fees** that scare solo/small-firm lawyers
- Their UIs are **clunky** (1990s-feeling), no permalink sharing, no modern UX
- They have **shallow MI county/city coverage** — they don't pull Detroit blight tickets, Wayne/Oakland parcels with sale history, or LARA business filings in one view
- They don't combine **federal court records + MI public records + AI web research** in a single result
- Solo lawyers don't want to commit to $200/mo + per-pull fees for the 4 searches they run a month

---

## Should we even try? My honest answer

**Don't try to sell this product as-is.** It loses to Perplexity Pro on AI research and loses to TLO/Accurint on data depth. Selling it would be embarrassing on the second search.

**Do consider rebuilding it narrow** as a **Michigan Litigation Records Search** for solo and small-firm MI attorneys, priced low enough that the per-pull crowd can't justify staying with TLO. Concretely:

- **$49/mo** flat (or $79/mo for unlimited + monitoring)
- **7-search free trial** (your idea — yes, do this)
- **Positioning:** "Everything a Michigan attorney needs to vet a defendant, debtor, or witness — in one click. Federal court + MI county + state corrections + business filings + AI corroboration."
- **Audience:** ~9,000 active MI attorneys, target the 60% in solo/small firms who don't carry a TLO subscription
- **Distribution:** your existing client(s) → bar association referrals → State Bar of Michigan vendor listings

This is monetizable. But it requires the rebuild below.

---

## Proposed rebuild plan (if you want to ship)

### Phase 1 — Strip and rebrand (small, ~1 day)

- Rename product to **"Counsel Records Search"** (or "MI Litigation Intel"). Drop "Tenant" from page, edge function, table.
- New route `/counsel-search`, keep `/tenant-intel` as a 301 for any in-flight links.
- Remove the FCRA-risky tenant-screening framing. Keep the §1681b(a)(4) litigation-use disclaimer. Add a **permissible-purpose attestation checkbox** ("I will use this only for litigation, fraud investigation, or bona-fide legal proceedings") gated before search.
- Rip out the 4 fragile consumer scrapers: FastPeopleSearch, TruePeopleSearch, Whitepages, USPhoneBook. They're more risk than value.
- Drop one of the duplicate migrations.

### Phase 2 — Auth + 7-search trial + Stripe ($49/mo)

- Require auth before search (use existing `useAuth`).
- New table `counsel_search_quota(user_id, free_searches_used, plan, period_start)`.
- Edge function reads quota, denies after 7 free searches if not subscribed.
- New `create-counsel-search-checkout` edge function (subscription, $49/mo, inline `price_data`).
- `stripe-webhook` handler for `counsel_search_subscription` type → upserts `counsel_clients` row.
- New `MyCounselSearch.tsx` portal showing search history + plan status + cancel via existing `customer-portal` function.

### Phase 3 — Strengthen MI moat (the actual product value)

- Add **MI state court docket scrape** via `mi-courts.gov` / MiCOA — this is the biggest gap competitors don't fill cheaply. Start with 3rd Circuit (Wayne County) and 6th Circuit (Oakland) civil + criminal indexes.
- Add **36th District Court Detroit** docket lookup (eviction-heavy court, perfect for MI landlord-side attorneys).
- Add **Macomb County** parcels + civil docket.
- Replace consumer-site scrapes with **a single Sonar query that has explicit "cite a public-record URL or return nothing" rule** — and validate every returned URL with a HEAD check before showing it. Cuts hallucinations to near-zero.
- Add 20 more sources

### Phase 4 — The workflow features lawyers actually pay for

- **Case-matter tagging:** every search tied to a case # / matter name (audit log).
- **PDF export** of the result set (use existing Browserless setup from marketplace) → "save to client file."
- **Saved subjects / monitoring:** weekly recheck on saved names, email if new hits land. This is the upsell from $49 to $79.
- **AKA / alias support:** accept comma-separated aliases, run all variants in one shot.

### Phase 5 — Quality gate before any sale

- Deno test for each MI ArcGIS source (assert response shape, smoke-test with a known-positive name).
- Playwright spec for the search → result → PDF-export flow.
- Manual QA pass with 10 real MI names (mix: known-clean, known-defendant, known-business-owner). Document false positives, fix or filter them.

### Phase 6 — Soft launch with Jess / your one client

- Hand the trial to your existing lawyer client. Have them run 20 real searches over 2 weeks. Capture every "this is wrong" or "I wish it did X."
- Iterate. Then ask them for one referral to another MI lawyer.
- Only after that → State Bar of Michigan vendor listing + paid ads.

---

## Technical notes (for the implementer)

- Per-search cost today: 7× Sonar calls @ ~$0.005 each + Firecrawl scrapes @ ~$0.002 each + free APIs = ~$0.05–0.10/search. After Phase 3 (drop 4 scrapes, consolidate Sonar to 2 calls), drops to ~$0.03/search. At $49/mo with avg 30 searches/user = $1/user/mo cost → ~98% gross margin.
- Trial-counter check must be **server-side in the edge function**, not client-side (otherwise trivially bypassed).
- The duplicate migration (`20260508100000` and `20260509001150`) won't break anything — the second uses `IF NOT EXISTS` — but should be cleaned up.
- Existing `tenant_intel_searches` table can be renamed via migration, no data loss.

---

## Decision points for you

1. **Kill it, or rebuild narrow as MI Counsel Records Search?** I recommend rebuild — your MI ArcGIS coverage is genuinely a moat in this niche. Rebuild it. 
2. **$49/mo flat, or $49/$79 two-tier (unlimited + monitoring)?** I recommend two-tier; monitoring is the sticky upsell. Perfect
3. **Soft-launch with Jess first, or build out fully then launch?** I strongly recommend soft-launch with Jess after Phase 4. She'll find the gaps no audit can. 

If you give me a green light on the rebuild path and the pricing, I'll execute Phase 1 + 2 first (rebrand, auth, paywall, 7-search trial) — that gets you something demo-able to Jess in one build cycle. Phases 3–5 follow once you've validated demand.