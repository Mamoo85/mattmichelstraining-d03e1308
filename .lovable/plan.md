

# TechAlert Client Dashboard — Dynamic Industry UI + Source Masking + ROI Capture

## What We're Building

A self-serve client dashboard at `/my-techalert?token=XYZ` where TechAlert/HireAlert clients can browse all candidates ever alerted to them, click to expand contact details, mark candidates as contacted/hired, and see KPI stats — all without a login. The UI dynamically adapts between Trades and Healthcare based on the client's `target_roles`.

---

## Architecture

```text
Client Email/SMS → "View Dashboard" CTA → /my-techalert?token=abc123
                                               │
                                               ▼
                                    get-my-techalert (GET)
                                    ├─ Validates token against hire_alert_clients
                                    ├─ Returns client info + candidates (joined)
                                    └─ Never returns source field
                                               │
                                               ▼
                                    MyTechAlert.tsx
                                    ├─ Detects industry from target_roles
                                    ├─ Trades UI (hardhats, teal/navy)
                                    └─ Healthcare UI (medical icons, clean clinical)
```

---

## Implementation Steps

### Step 1: Migration — Add `dashboard_token` to `hire_alert_clients`
- `hire_alert_clients` has no token column (unlike `contractor_clients` which has `roi_token`)
- Add `dashboard_token text DEFAULT encode(gen_random_bytes(16), 'hex')`
- Backfill existing rows

### Step 2: Source Masking — `hire-alert-scanner/index.ts`
- **Client email** (line 463): Remove the `sourceIcon` + `sourceLabel` line entirely from candidate cards
- **Founder report** (line 910): Keep raw `c.source` — Matt-only email
- **Client email footer**: Add "View All Candidates in Your Dashboard" CTA button linking to `/my-techalert?token={client.dashboard_token}`
- Need to SELECT `dashboard_token` in the client query (around line 820)

### Step 3: Edge Function — `get-my-techalert/index.ts`
- GET endpoint, token-secured (same pattern as `contractor-roi-report`)
- Looks up client by `dashboard_token`, returns:
  - Client info: `company_name`, `target_roles`, `target_zip_codes`
  - Candidates from `hire_alert_client_candidates` joined with `hire_alert_candidates`
  - **Excludes `source` field** — never sent to client
  - Includes: `full_name`, `phone`, `email`, `license_type`, `license_number`, `city`, `availability_score`, `score_reason`, `qualifications_summary`, `hiring_recommendation`, `linkedin_url`, `alerted_at`, `client_action`
- KPI aggregates: total candidates, hot count (7+), contacted count, hired count

### Step 4: Edge Function — `update-candidate-action/index.ts`
- POST endpoint, token-secured
- Body: `{ token, candidate_id, action: "viewed" | "contacted" | "hired" }`
- Updates `hire_alert_client_candidates.client_action`
- On "hired" action: returns a success flag so frontend can show the ROI toast

### Step 5: Dynamic Dashboard Page — `src/pages/MyTechAlert.tsx`

**Industry Detection Logic:**
```
HEALTHCARE_ROLES = ["cna", "rn", "lpn", "director_of_nursing", "home_health_aide"]
isHealthcare = client.target_roles.some(r => HEALTHCARE_ROLES.includes(r))
```

**Dynamic UI Differences:**

| Element | Trades | Healthcare |
|---------|--------|------------|
| Header title | "TechAlert" | "HireAlert" |
| Subtitle | "Licensed Techs in Your Area" | "Licensed Healthcare Professionals" |
| Badge label | "Trade" → license_type | "License Type" → license_type |
| Icons | 🔧 ⚡ 🏗️ | 🏥 👩‍⚕️ 💊 |
| Accent color | Teal `#00d4ff` | Medical blue `#3b82f6` |
| Empty state | "No techs found yet" | "No candidates found yet" |

**Dashboard Sections:**
1. **KPI Strip** — 4 cards: Total Candidates, Hot (7+), Contacted, Hired
2. **Candidate List** — Cards with expand/collapse
   - Collapsed: name, score badge, license type badge, city badge
   - Expanded: phone (clickable), email (clickable), LinkedIn, qualifications, recommendation
   - Action buttons: "Mark as Contacted" / "Mark as Hired"
3. **Filters** — By score range, date range
4. **Upsell Card** — Sidebar/footer card
   - Trades: "Need Exclusive Inbound Leads? → detroitwebagent.com/contractor-leads"
   - Healthcare: "Refer a Partner Facility — Get 1 Month Free → mailto:matt@detroitwebagent.com"

**ROI Capture Toast:**
When "Mark as Hired" is clicked → Shadcn toast: "Congratulations on the hire! This data helps us find even better candidates for you."

### Step 6: Route + Email Integration
- `App.tsx`: Add `/my-techalert` route (public, no auth)
- Scanner email: Add dashboard CTA button in footer
- Hot candidate SMS: Append dashboard link

---

## Files Changed/Created

| File | Action |
|------|--------|
| `supabase/migrations/new` | Add `dashboard_token` to `hire_alert_clients` |
| `supabase/functions/get-my-techalert/index.ts` | **New** — GET endpoint |
| `supabase/functions/update-candidate-action/index.ts` | **New** — POST endpoint |
| `src/pages/MyTechAlert.tsx` | **New** — Dynamic dashboard page |
| `src/App.tsx` | Add `/my-techalert` route |
| `supabase/functions/hire-alert-scanner/index.ts` | Remove source labels from client email, add dashboard CTA |

No new secrets needed. No new tables needed (`hire_alert_client_candidates` already exists with `client_action` column).

