

# Live Test: Clear & Re-Run TechAlert Scanner

## What We Have Now
- 33 candidates in `hire_alert_candidates` (from Apr 13-14)
- 93 entries in `hire_alert_client_candidates` (alert history)
- 0 entries in `hire_alert_runs` and `industry_pulse_signals`
- 8 active clients configured

## The Plan

### Step 1: Clear Old Data (Migration)
Run a migration to truncate test data from the three tables:
```sql
TRUNCATE hire_alert_candidates CASCADE;
TRUNCATE hire_alert_client_candidates CASCADE;
```
This gives us a clean slate — as if the product just launched.

### Step 2: Deploy & Invoke the Scanner
- Deploy `hire-alert-scanner` and `miosha-license-scraper` fresh
- Invoke the scanner via curl to trigger a full run
- This will execute the real 3-tier scan: **BPL (LARA) → MIOSHA → Job Boards**

### Step 3: Review Results
- Check logs to confirm each source ran and what it found
- Query the database for newly inserted candidates
- Verify candidates have real license numbers (BPL/MIOSHA sources)
- Confirm the scoring and source tagging is correct
- Check if the founder report email fires with the segmented sections (State-Licensed vs Job Seekers)

### Step 4: Report Back
- Show you exactly what the scanner found: how many from each source, sample candidates, confidence scores
- Identify any issues (corporate names slipping through, missing license data, API failures)

## Files Changed
- One migration to truncate old data
- No code changes — this is a live test of existing code

## What You'll See
A real-world test showing exactly what TechAlert delivers to a paying client on Day 1: which licensed tradespeople it found, from which state databases, with what confidence level.

