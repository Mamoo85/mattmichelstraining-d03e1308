## Part 1 — DEAD PIPE alert upgrade (`cron-sentinel/index.ts`)

Current message: `🚨 TechAlert DEAD PIPE: Last 3 scanner runs (source=all) returned 0 candidates within 6h. N active client(s). Investigate.`

Upgrade the dead-pipe block (lines 296–351) so the SMS + the `error_logs` row both include:
- **Failing step**: pull `last_step` / `error_step` from the most recent `hire_alert_runs` row (fall back to `"unknown_step"` if not set). Also surface the `source` value of the most recent run.
- **Error code**: pull the latest matching row from `error_logs` (function_name=`hire-alert-scanner`, severity in `error|critical`, last 6h) and include its `error_code` (or first 80 chars of `error_message` if no code field).
- **Timestamp**: ISO timestamp of the most recent `hire_alert_runs.run_at` AND the alert generation time, formatted as ET (`America/Detroit`) for readability.

New SMS shape (≤ 320 chars, fits 2 segments):
```
🚨 TechAlert DEAD PIPE @ {alertTimeET}
Step: {step} | Code: {errCode}
Last run: {lastRunET} (source={source}, age {ageHr}h)
3× zero-candidate runs · {N} active client(s)
View: /dwa-admin → Cron Sentinel
```

`error_logs` insert gets the same fields in structured form (`error_code`, `last_step`, `last_run_at`, `last_run_age_hours`, `metadata` JSON) so the fixer watchdog can route on `error_code` directly.

If `hire_alert_runs` has no `last_step` / `error_step` columns yet, add a tiny migration to add them (`text`, nullable) and patch `hire-alert-scanner` to write them at each major stage (`fetch_sonar`, `enrich_apollo`, `score`, `dispatch`). I'll only add the migration if the columns are missing — I'll check first before writing it.

---

## Part 2 — 50 new sources for Counsel Search

The current scanner has ~22 sources (federal courts, NSOPW, FBI, SAM, OSHA, Wayne/Oakland/Macomb/Detroit property, OpenCorporates, plus 6 Sonar prompts). Below are 50 net-new sources organized by tier. Each entry notes **cost / setup**: 🟢 free no-key · 🟡 free key (Matt signs up, no card) · 🔴 paid or PACER-style credentials (Matt helps set up).

### A. Federal courts & corrections (8)
1. 🟢 **CourtListener Opinions** endpoint (`/api/rest/v3/opinions/`) — written rulings naming the party, separate from dockets
2. 🟢 **CourtListener RECAP archive** (`/api/rest/v3/recap/`) — millions of free PACER-cached docs
3. 🟢 **U.S. Tax Court DAWSON** docket search (HTTP, no key)
4. 🟢 **BOP Inmate Locator** (free public site)
5. 🟢 **U.S. Marshals 15 Most Wanted**
6. 🟢 **DEA Major Fugitives** list
7. 🟢 **ICE Most Wanted**
8. 🔴 **PACER Case Locator** (full federal cross-court) — requires PACER account + PSC credentials. Setup needed from Matt.

### B. Federal regulatory / enforcement (10)
9. 🟢 **SEC EDGAR Litigation Releases** (`/litigation/litreleases/`)
10. 🟢 **CFTC Enforcement Actions** index
11. 🟢 **FTC Cases & Proceedings** search
12. 🟢 **CFPB Consumer Complaint DB** (Socrata API)
13. 🟢 **DOJ Press Release search** (`justice.gov/news/press-release-feed`)
14. 🟢 **HHS-OIG LEIE** (Excluded Individuals — bulk CSV, free)
15. 🟢 **Treasury OFAC SDN** consolidated list (XML)
16. 🟢 **NTSB CAROL accident DB**
17. 🟡 **FINRA BrokerCheck** — official "free use" but rate-limited; needs minor User-Agent + key request from FINRA
18. 🟡 **NMLS Consumer Access** (mortgage originator licenses) — bulk feed, requires free registration

### C. State of Michigan (12)
19. 🟢 **MDOC OTIS** (Offender Tracking Info System) — direct scraper (currently only via Sonar)
20. 🟢 **Michigan PSOR** (Public Sex Offender Registry direct, separate from federal NSOPW)
21. 🟢 **LARA Professional License Verification** (occupational license + disciplinary status)
22. 🟢 **LARA Corporations Online Filing** direct entity search
23. 🟢 **Michigan SOS UCC filings** lookup
24. 🟢 **Michigan Court of Appeals opinions** RSS
25. 🟢 **Michigan Supreme Court opinions** feed
26. 🟢 **Michigan AG press releases** + consumer enforcement
27. 🟢 **Michigan Dept of Insurance** producer disciplinary actions
28. 🟢 **MIOSHA citations** (state OSHA)
29. 🟢 **State Bar of Michigan** member directory + discipline (ADB)
30. 🟢 **Michigan Treasury tax lien** index (where exposed)

### D. County courts & local Michigan (10)
31. 🟢 **36th District Court Detroit** civil/eviction case search (direct, replaces Sonar prompt)
32. 🟢 **Wayne 3rd Circuit Court** docket lookup
33. 🟢 **Oakland 6th Circuit** docket lookup
34. 🟢 **Macomb 16th Circuit** docket lookup
35. 🟢 **Washtenaw 22nd Circuit / 14B / 15th District** case search
36. 🟢 **Kent County 17th Circuit** (Grand Rapids) case lookup
37. 🟢 **Genesee 7th Circuit** case lookup
38. 🟢 **Wayne County Register of Deeds** (mortgages, liens, lis pendens)
39. 🟢 **Oakland Register of Deeds** ("Super Index")
40. 🟢 **Macomb Register of Deeds**

### E. Property / land / parcel (extending coverage) (4)
41. 🟢 **Genesee County parcel viewer** (Flint metro)
42. 🟢 **Washtenaw County parcel** (Ann Arbor)
43. 🟢 **Kent County parcel** (Grand Rapids)
44. 🟢 **Detroit Land Bank Authority** dispositions

### F. Professional / asset registries (3)
45. 🟢 **NPI Registry** (medical providers — useful for malpractice suits)
46. 🟢 **FAA Airmen Registry + Aircraft owner**
47. 🟢 **USPTO TESS / Trademark Assignment** (party as assignor / owner)

### G. Open-source intelligence aggregates (3)
48. 🟢 **OpenSanctions consolidated** (PEPs + sanctions, unified)
49. 🟢 **ICIJ Offshore Leaks DB** (Panama / Pandora / Paradise Papers)
50. 🟡 **GDELT Global News** v2 (research API, free key)

### Setup-needed summary for Matt
- 🟡 light setup (free, just register): FINRA BrokerCheck terms, NMLS Consumer Access, GDELT API key
- 🔴 needs help: PACER account (one-time $10 hold, then per-page fees) — biggest unlock for Jess (federal civil/criminal/bankruptcy across all 94 districts, not just MIED/MIWD)

### Implementation approach
- Each source becomes a `scanXxx(name, state)` function returning `IntelHit[]`, fail-soft via try/catch (matches existing pattern).
- Add to `runScansForName()` `Promise.allSettled` array — they all run in parallel so latency stays flat.
- Group output into existing categories (`Court Records`, `Criminal Records`, `Property Records`, `Business Records`, `Government Records`, `Financial Records`, `News & Public Notices`) — no UI changes required.
- New secrets to add (after Matt registers):
  - `FINRA_API_KEY` (optional)
  - `NMLS_API_KEY` (optional)
  - `GDELT_API_KEY` (optional)
  - `PACER_USERNAME` + `PACER_PASSWORD` (high value)
- Sources behind keys gracefully no-op until the key exists, so the scanner gets richer over time as Matt finishes setup.

### Code structure
To keep `counsel-search/index.ts` from becoming unmanageable (~600 → ~2000 lines), split scanners into shared modules:
- `_shared/counsel-sources/federal.ts`
- `_shared/counsel-sources/regulatory.ts`
- `_shared/counsel-sources/michigan.ts`
- `_shared/counsel-sources/county.ts`
- `_shared/counsel-sources/professional.ts`
- `_shared/counsel-sources/osint.ts`

Each exports `scanXxx` functions; `counsel-search/index.ts` imports and composes.

### What I'll deliver in build mode
1. Edit `cron-sentinel/index.ts` (DEAD PIPE block) + optional scanner step-tracking patch.
2. Create the 6 `_shared/counsel-sources/*.ts` modules with all 50 scanners.
3. Wire into `runScansForName()`.
4. Deploy `cron-sentinel` and `counsel-search`.
5. Provide a short Matt action list for the 5 optional API keys (with signup links).