

# Production Deployment: NPI + PDL + Upgraded Sonar into hire-alert-scanner

## What Changes

One file modified: `supabase/functions/hire-alert-scanner/index.ts`

### 1. Add `PDL_API_KEY` env var at top
Read `PDL_API_KEY` from environment alongside existing secrets.

### 2. Port `enrichViaNPI()` from test-data-pipeline
- Free federal API, no auth needed
- Query: `https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=X&last_name=Y&state=MI&enumeration_type=NPI-1`
- Extracts: business phone, taxonomy code, taxonomy description, practice address
- 10s timeout via `AbortSignal.timeout(10_000)`
- Only called for healthcare-type candidates (RN, LPN, CNA, DON roles detected via ROLE_KEYWORDS)

### 3. Port `enrichWithPDL()` from test-data-pipeline
- Calls `https://api.peopledatalabs.com/v5/person/enrich` with name + location + linkedin_url
- Extracts: mobile phone, personal email, work email, job title, company
- 10s timeout, graceful no-op if `PDL_API_KEY` not set
- PDL_API_KEY is already in your secrets

### 4. Upgrade `enrichViaSonar()` prompt
Replace current generic prompt with boolean search operators:
```
site:linkedin.com/in/ "[Name]" "[City]"
AND site:indeed.com/r/ "[Name]"
AND site:facebook.com "[Name]" "[City]"
```
This bypasses Indeed paywalls via Google's cached index.

### 5. Update `extractJSON()` to strip markdown wrappers
Add the `\`\`\`json` regex stripping from test-data-pipeline before JSON.parse.

### 6. Modify inline enrichment loop (lines 728-754)
For each of the top 5 candidates, the new waterfall is:
1. **NPI API** (if healthcare role detected) — ~1-2s
2. **Sonar Deep Dork** (upgraded prompt) — ~5-8s  
3. **PDL** (if Sonar found LinkedIn URL) — ~2-3s
4. **AI Synthesis** (existing, unchanged) — ~3-5s

Total per candidate: ~12-18s. Top 5 cap = 90s worst case. Well within 150s edge function limit.

### 7. Merge NPI + PDL data into candidate record
- NPI business phone stored as separate field, also used as fallback phone
- PDL mobile_phone becomes primary phone if no phone exists
- PDL personal_email becomes email if no email exists
- NPI taxonomy badge added to candidate card

### 8. Update `buildActionButtons()` to show NPI business phone
Add a separate "📞 Business Line" button (teal) when NPI business phone exists, distinct from the orange personal phone button.

### 9. Update `ScoredCandidate` interface
Add: `npi_number`, `npi_business_phone`, `npi_taxonomy`, `npi_practice_address`, `pdl_mobile_phone`, `pdl_personal_email`

### 10. Update DB insert to include new fields
Store NPI and PDL data in `raw_data` JSON field (no migration needed — these are enrichment metadata).

### 11. Update founder report
Add NPI and PDL columns to the source health section so Matt can see which APIs returned data.

## What Does NOT Change
- Nursys is **bypassed** (no API key yet)
- MIOSHA scanner, job board scanner — unchanged
- Scoring logic — unchanged
- No Ghost Lead rule — unchanged (now catches MORE candidates since NPI+PDL add more contact info)
- Email template structure — unchanged (action buttons already exist)
- Medicare/Industrial intel — untouched

## Timing Safety
- NPI: free, fast (~1s), no auth
- PDL: ~2s, only fires when LinkedIn found (saves credits)
- Sonar: same ~5-8s (prompt slightly longer)
- Total worst case for 5 candidates: ~90s (well under 150s limit)

## Deploy
After code update, deploy `hire-alert-scanner` via edge function deployment. Can invoke manually or wait for 7am ET cron.

