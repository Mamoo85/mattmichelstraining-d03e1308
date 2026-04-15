

# Pre-Launch QA Audit — DWA Top 4 Product Pages

## Findings

### CRITICAL — Branding Leaks

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `ContractorLeads.tsx` | Uses M2 orange `#e8621a` as accent throughout (DWAStickyNav, WallOfLove, EnterpriseFooterBlock, hero bg `#1e293b`). DWA pages must use teal `#00d4ff` on `#0a1628`. | Change all `#e8621a` → `#00d4ff`, hero bg `#1e293b` → `#0a1628` |
| 2 | `FieldServiceManagement.tsx` line 363 | Says **"Power it up with M² add-ons"** — M² is the training brand, not DWA | Change to **"Power it up with add-ons"** |

### CRITICAL — "AI" Mentions on Client-Facing Pages

| # | File | Line | Text | Fix |
|---|------|------|------|-----|
| 3 | `HireAlert.tsx` line 227 | "AI Availability Score" | → **"Availability Score"** |
| 4 | `HireAlert.tsx` line 227 | "Each candidate rated 1–10 on immediate hire likelihood with reason" — fine, but the label says AI | Remove "AI" from label only |
| 5 | `HireAlert.tsx` line 268 | "AI availability scoring" in pricing checklist | → **"Availability scoring"** |

### IMPORTANT — "Sources" Mention in Client Dashboard

| # | File | Line | Text | Fix |
|---|------|------|------|-----|
| 6 | `MyTechAlert.tsx` line 503 | Tooltip: "Verify signals using provided sources before outreach." | → **"Verify signals independently before outreach."** |

### IMPORTANT — "Call Matt" Should Be "Text or Email Matt"

| # | File | Line | Issue | Fix |
|---|------|------|-------|-----|
| 7 | `FieldServiceManagement.tsx` line 155 | Button says "Call Matt" with `tel:` link | → **"Text Matt"** with `sms:+13139921219` |
| 8 | `FieldServiceManagement.tsx` line 403 | "Call Matt. We'll have you live in 48 hours." | → **"Text Matt. We'll have you live in 48 hours."** |
| 9 | `FieldServiceManagement.tsx` line 406-409 | CTA bottom links to `tel:` | → `sms:+13139921219` with label "Text (313) 992-1219" |
| 10 | `EnterpriseFooterBlock.tsx` line 20 | `tel:` link as primary action | → Change to `sms:+13139921219` and update label to "Text (313) 992-1219" |

### MINOR — CTA Improvements

| # | File | Issue | Fix |
|---|------|-------|-----|
| 11 | `ContractorLeads.tsx` | Hero CTA "Claim My Territory — $399/mo" is good. Success page has no secondary CTA to contact Matt. | Add "Text Matt at (313) 992-1219 with questions" under the success message |
| 12 | `HireAlert.tsx` | Success page "Back to Home" button links to `/` (M2 homepage). Should link to DWA. | Change href to `https://detroitwebagent.com` |
| 13 | `MissedCallSaaS.tsx` | Success page has no contact info for next steps | Add "Text Matt at (313) 992-1219 with any questions" |

### NO ISSUES FOUND (Confirmed Clean)

- `MyTechAlert.tsx` — No AI mentions in client-facing text. No source/method disclosure. Professional layout.
- `DeadLeadIntake.tsx` — Correctly says "Text Matt" not "Call Matt". Uses DWA branding.
- `ClaimLead.tsx` — No AI mentions, no wrong numbers, no M2 branding.
- `DWAStickyNav.tsx` — Clean, no branding issues.
- Phone numbers across all DWA pages use `(313) 992-1219` (work number) — correct.
- No `313-806-4952` (personal number) found on any client-facing DWA page.

## Implementation — 13 Patches

All changes are copy/branding fixes. No database migrations. No edge function changes.

**Files to edit:**
1. `src/pages/ContractorLeads.tsx` — 4 lines: swap `#e8621a` → `#00d4ff`, bg `#1e293b` → `#0a1628`
2. `src/pages/FieldServiceManagement.tsx` — 4 lines: "M²" → remove, "Call Matt" → "Text Matt", `tel:` → `sms:`
3. `src/pages/HireAlert.tsx` — 3 lines: remove "AI" from labels, fix success page home link
4. `src/pages/MyTechAlert.tsx` — 1 line: remove "sources" from tooltip
5. `src/components/shared/EnterpriseFooterBlock.tsx` — 2 lines: `tel:` → `sms:`, update label
6. `src/pages/MissedCallSaaS.tsx` — 1 line: add contact info to success page

