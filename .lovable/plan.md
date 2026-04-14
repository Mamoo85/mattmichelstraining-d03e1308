

# TechAlert Scanner Fix — Real Data Sources

## Problem
Both scanners return 0 candidates due to three confirmed failures:
1. **LARA Accela portal** — session-based, returns 401 server-to-server. Dead end.
2. **Schema mismatch** — `miosha-license-scraper` already fixed (`name: c.full_name` is present on line 456). This was fixed in the last session.
3. **Sonar prompts** — asking Sonar to search LARA (not indexed). Prompts need to target public profiles instead.

## Changes

### File 1: `supabase/functions/miosha-license-scraper/index.ts`

**Delete** the entire LARA Accela section (lines 57–263): `getLaraSession()`, `searchLaraPortal()`, `extractCandidatesViaGemini()`, `LARA_TRADE_SEARCHES`, `LaraSession` interface, all constants.

**Add** Apollo.io People Search function:
```
searchViaApollo(tradeTitle: string) → LicenseCandidate[]
  POST https://api.apollo.io/api/v1/mixed_people/search
  Headers: X-Api-Key: APOLLO_API_KEY
  Body: person_titles: [tradeTitle], person_locations: ["Michigan"], per_page: 25
  Map: person.name → full_name + name, person.title → license_type, person.city → city
```
Read `APOLLO_API_KEY` at module scope.

**Update** `serve()` Phase 1 (lines 513–529): Replace LARA session/portal search loop with Apollo search loop over the same 4 trade types + CNA + RN/LPN.

**Update** Sonar prompts (lines 270–295): Change from "Find licensed X in Michigan who are seeking work" to "Find LinkedIn profiles, personal websites, or trade union member pages for individual licensed [TRADE] workers in Metro Detroit Michigan who are actively job seeking or open to work."

### File 2: `supabase/functions/hire-alert-scanner/index.ts`

**Update** Sonar prompts in `scanJobBoardsViaOpenRouter()` (lines 249–251): Same prompt fix — target public profiles, not LARA database or job postings.

System prompt (line 270): Add instruction to search LinkedIn "open to work" profiles, Indeed public resumes, and trade association directories. Remove any reference to LARA or license databases.

## What Does NOT Change
- Scoring, alerting, deduplication, SMS logic — all confirmed working
- `upsertCandidate()` — already has `name: c.full_name` (line 456)
- NPI Registry integration in hire-alert-scanner — already works for healthcare
- Gemini prose-extraction fallback — keep as-is

## Verification
1. Deploy both functions
2. Invoke `miosha-license-scraper` → logs show Apollo returning real people
3. Check `hire_alert_candidates` table for new rows with `name` populated
4. Invoke `hire-alert-scanner` → picks up candidates, scores them, alerts fire

