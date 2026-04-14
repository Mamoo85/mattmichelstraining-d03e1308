
# TechAlert Enhancement + Industry Pulse — DEPLOYED

## What Was Built (April 14, 2026)

### Wave A: Candidate Exclusivity + Outreach (LIVE)

**1. 48-Hour Candidate Claim System**
- Added `client_action`, `claimed_at`, `claim_expires_at` to `hire_alert_client_candidates`
- `claim-candidate` edge function with atomic race condition fix (`WHERE claimed_at IS NULL OR claim_expires_at < now()`)
- Auto-claim via URL: `/my-techalert?token=X&claim=Y&auto=1`

**2. AI Outreach Draft Generator**
- `generate-outreach-draft` edge function using Lovable AI Gateway (Gemini flash-lite)
- Generates 3-sentence cold text + 5-sentence email per candidate
- TCPA disclaimer included in every response
- Hardcoded fallbacks if AI unavailable

**3. MyTechAlert Dashboard Upgrade**
- ⚡ "Claim This Candidate" button with 48hr countdown
- 🔒 "Claimed by you" / "Claimed by another" badges
- ✍️ "Draft Outreach" button → modal with generated text/email + copy buttons + TCPA notice
- 🔄 "License Lapsed" badge for expiry-sourced candidates with warning context
- Fixed: `client_action` column was MISSING — "Mark Contacted" / "Mark Hired" were silently failing

### Wave C: Industry Pulse Predictive Engine (LIVE)

**4. Industry Pulse Scanner**
- `industry-pulse-scanner` edge function
- Sonar harvests hiring signals across 6 Metro Detroit trade categories
- Lovable AI Gateway predicts equipment/service needs from hiring patterns
- Cross-references with existing expansion news for highest-confidence signals
- Hardcoded fallback mappings (CNC → tooling, Boiler → parts, etc.)
- Matt email notification for high-confidence signals

**5. Growth Signals Admin Tab**
- `AdminGrowthSignals.tsx` — unified dashboard in DWA Admin
- Confidence badges (High/Medium/Low + Cross-Referenced gold)
- Industry filters (HVAC, CNC, Welding, Electrical, Boiler, Plumbing)
- "Run Pulse Scanner" button for on-demand scans
- Replaces separate Industrial Intel concept (merged per review feedback)

### Database Changes
- `hire_alert_client_candidates`: added `client_action`, `claimed_at`, `claim_expires_at`
- `industry_pulse_signals`: new table (company, hiring, predictions, confidence, cross_referenced)

### Edge Functions Deployed
- `claim-candidate` — 48hr exclusivity lock
- `generate-outreach-draft` — AI cold outreach drafts
- `industry-pulse-scanner` — predictive demand engine
- `get-my-techalert` — updated to return claim status + license lapse badge

### No New Secrets Required
All existing keys (LOVABLE_API_KEY, OPENROUTER_API_KEY, RESEND_API_KEY) used.

## Still Pending (Wave B)
- `scanLicenseExpiries()` in hire-alert-scanner (needs MIOSHA lapsed license data integration)
- License expiry candidates scored one tier lower per review feedback
- Claim button in hire-alert-scanner email templates
