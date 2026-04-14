

# Test & Verify TechAlert Scanner — LARA/MIOSHA Primary + Multi-State Analysis

## Key Finding: No Multi-State Needed

Michigan **does not reciprocate** with any other state for trade licensing. From LARA's own documentation: *"The State of Michigan does not reciprocate with any other state for licensing. Therefore, you are required to take and pass an examination to receive a license."*

This means scanning Ohio, Indiana, Illinois, or Wisconsin databases is **pointless** — those licensees can't legally work in Michigan without a separate Michigan license. The Michigan LARA database is the ONLY database that matters for Michigan-based clients. This is actually a competitive advantage — it makes the LARA moat even stronger.

**Exception**: For nursing (CNA/LPN/RN), the Nurse Licensure Compact (NLC) allows multi-state practice. Michigan joined the NLC, so nurses from compact states CAN work in Michigan. We already search the NPI registry for these, which covers this.

## What Needs to Happen

### 1. Deploy & Invoke Scanner to Confirm It Works
- Deploy both `hire-alert-scanner` and `miosha-license-scraper` (no logs found — they may not be deployed after recent edits)
- Invoke the scanner with curl to trigger a real run
- Check logs for the source hierarchy: BPL candidates → MIOSHA candidates → Job Board candidates
- Verify BPL and MIOSHA return real people with license numbers, not companies

### 2. Write & Run Deno Tests
Create `supabase/functions/hire-alert-scanner/index_test.ts`:
- Test `isCorporateName()` — confirm it blocks "Detroit Academy of Arts & Sciences", "MotorCity Casino", "Veolia", etc.
- Test that single-word names are rejected
- Test that normal 2-word names pass ("Robert Chen", "Angela Peters")
- Test scoring: BPL source gets +3, MIOSHA w/license gets +1, job board w/o license gets -2

### 3. Add "Job Seekers" as Separate Alert Category
Per your request, job board candidates should be a separate "bonus" alert — not mixed into the main LARA-sourced alerts. Update the client email to clearly separate:
- **Section 1**: "State-Licensed Candidates" (BPL + MIOSHA sources)
- **Section 2**: "Job Seekers" (job board sources — marked as supplementary)

### 4. Verify End-to-End
- Check that the scanner response JSON shows `source_bpl > 0` and `source_miosha > 0`
- Confirm the founder report email correctly labels sources
- Verify no corporate names slip through

## Files Changed
- `supabase/functions/hire-alert-scanner/index.ts` — separate job board alerts into distinct section, minor fixes
- `supabase/functions/hire-alert-scanner/index_test.ts` — new test file
- Both functions deployed and invoked for live verification

