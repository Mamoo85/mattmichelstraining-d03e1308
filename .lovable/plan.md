

## What I'm seeing across your 9 screenshots

1. **Email candidates (#1, #4, #7)** — Tamika Johnson, Darnell Porter, Kevin Ruiz. These are simulated/seeded demo data, not real LARA scrapes. The email even says "SIMULATED ALERT EMAIL" at the top. Need to confirm by checking `hire_alert_candidates` table.
2. **"Access Denied — No access token provided" (#2, #8)** — Email "View Dashboard" button links to `/my-techalert?token=DEMO_TOKEN` (visible in screenshot #8 status bar). The DEMO_TOKEN value isn't being honored by the dashboard auth check, so client gets locked out.
3. **Action buttons in emails (#3, #4, #7)** — "Business Line", "Verify NPI", "Draft Outreach", "Send Email", "LinkedIn", "Call", "Claim", "Verify License". Most are `mailto:`/`tel:` or anchor tags pointing to routes that may not exist or aren't wired.
4. **Founder report KPIs (#5)** — "47 scanned, 7 new, 5 enriched, 2 hot, 3 alerted, $397/mo MRR, 3 active clients (Premier HVAC, Sunrise Senior Care, Macomb Electric)" — almost certainly fabricated/seeded. Need DB check.
5. **Source column visible in founder report table (#6)** — "miosha", "sonar", "lara_newly_issued", "npi_registry", "lara_socrata", "nursys", "trade_school". **Memory rule violated**: `mem://ux/techalert-source-protection-rules` says vendor names NEVER leave the building. This was supposed to be sanitized to color labels.
6. **M2 Training splash screen on dashboard click (#8, #9)** — clicking "View Full Dossiers in Your Dashboard" from a TechAlert email lands on the M2 fitness home page. Routing/domain bug — DWA email links must NOT route through the M2 training app.

## Root causes (need to verify with code/DB read first)

| # | Symptom | Suspected cause | File to check |
|---|---|---|---|
| 1,4,5 | Fake-looking data | Seeded demo rows in `hire_alert_candidates` + hardcoded KPIs in `founder-report` function | `supabase/functions/hire-alert-founder-report/index.ts`, DB query |
| 2,8 | "Access Denied" on dashboard | `MyTechAlert.tsx` rejects `DEMO_TOKEN` even though emails are sending it | `src/pages/MyTechAlert.tsx` |
| 3,7 | Dead action buttons | Buttons are `<a>` tags with `href="#"` or pointing to nonexistent routes | email template HTML in scanner function |
| 6 | Sources visible in client emails | Founder report HTML uses raw `source` field instead of color label | scanner email template |
| 8,9 | DWA email → M2 splash | `View Dashboard` URL uses `m2training.lovable.app` instead of `detroitwebagent.com`; the `/my-techalert` route is loading inside the M2 app shell with bottom nav | scanner email URL builder + `App.tsx` route placement |

## Plan (I will VERIFY each fix in DB + by curl before saying "done")

### Step 1 — Read first, fix second
- Query `hire_alert_candidates`, `hire_alert_clients`, `hire_alert_runs` to confirm what's real vs seeded
- Read `hire-alert-scanner/index.ts` email template, `hire-alert-founder-report` if it exists, `MyTechAlert.tsx`, and `App.tsx` route for `/my-techalert`
- Identify every action button's `href` and route them properly

### Step 2 — The fixes (all in one loop)

**A. Kill seeded/fake data**
- Delete demo candidates from `hire_alert_candidates` (anything tagged `is_demo=true` or matching the seed names: Darnell Porter, Tamika Johnson, etc.)
- Delete fake `hire_alert_clients` rows (Premier HVAC, Sunrise Senior Care, Macomb Electric — unless Matt confirms these are real paid clients)
- Founder report KPIs read from real DB only — no fallback fake numbers

**B. Sanitize the source column** (memory rule enforcement)
- Replace `source` text in email HTML with color label only:
  - score 8-10 → `🔥 High Priority`
  - score 5-7 → `🟡 Worth Checking`
  - below 5 → `🔵 Monitor`
- Strip `miosha`, `sonar`, `nursys`, `lara_*`, `npi_registry`, `trade_school` from ALL client-facing surfaces (founder report stays internal — Matt can see sources, clients cannot)
- Apply to: scanner candidate cards, founder report (mark as internal-only), MyTechAlert dashboard

**C. Fix dashboard access**
- Email URL: `https://www.detroitwebagent.com/my-techalert?token=<real_client_token>` — never `m2training.lovable.app` and never literal `DEMO_TOKEN`
- Each `hire_alert_clients` row gets a unique `access_token` column (generate if missing)
- `MyTechAlert.tsx`: validate token via edge function `verify-techalert-access` (creates session, returns client data) — proper auth-less B2B gate per `mem://auth/b2b-subscriber-access-gate`
- Route `/my-techalert` must NOT render inside the M2 PageShell (no bottom nav, no M2 splash) — wrap in DWA-only layout

**D. Wire every button or remove it**
- `Call` / `Business Line` → `tel:+1XXXXXXXXXX` (verify number exists, else hide button)
- `Send Email` → `mailto:candidate@email.com?subject=...&body=...` (verify email exists, else hide)
- `LinkedIn` → only show if `linkedin_url` is non-null
- `Verify NPI` → `https://npiregistry.cms.hhs.gov/provider-view/<npi>` (real CMS URL)
- `Verify License` → `https://aca-prod.accela.com/MILARA/...` (real LARA lookup URL with license number)
- `Draft Outreach` → `https://www.detroitwebagent.com/my-techalert?token=X&action=draft&candidate_id=Y` — opens dashboard with draft modal pre-loaded (uses `generate-outreach-draft` edge function per memory)
- `Claim` → POST to `claim-candidate` edge function (per `mem://` 48-hour claim system spec); show success/fail toast on dashboard
- Any button with no real target → REMOVE from email entirely

**E. Domain/routing hygiene**
- All TechAlert emails go out with DWA-domain links only
- `/my-techalert` route in `App.tsx` wrapped in a DWA-only layout (no `PageShell`, no M2 nav)
- Add `DWARouteGuard`-style check that redirects M2 hostname → `detroitwebagent.com/my-techalert?token=X`

### Step 3 — VERIFY (mandatory, won't stop until all 4 pass)
1. `curl` the email-rendered HTML for one client → confirm: no source labels, all buttons have real hrefs, dashboard URL uses detroitwebagent.com + real token
2. Open dashboard URL in browser → confirm: no Access Denied, no M2 splash, no bottom nav, candidate list loads
3. Click each action button type → confirm: tel/mailto/external URLs open correctly, Claim hits the edge function and returns 200, Draft opens modal
4. Query DB → confirm: zero rows where `is_demo=true` remain visible to clients; founder report numbers match `count(*)` from real tables

### Step 4 — Report back with proof
- Screenshot of the corrected email HTML
- Screenshot of the dashboard loading cleanly
- DB query results showing real counts
- List of every button + what it now does

## What I need you to confirm before I start

One question: **Are Premier HVAC Inc., Sunrise Senior Care LLC, and Macomb Electric real paying TechAlert clients, or were they seeded as demo data?** If real, I keep their rows and just fix the data/links. If demo, I delete them and the founder report will honestly show "0 active clients" until you onboard one.

Default if you don't answer: I treat them as demo and delete (you can re-add via admin panel in 30 seconds).

