

This is a massive multi-part request. Let me scope what's actually doable and present a clear plan before burning hours.

**What user wants:**
1. Full E2E click-test of all new buttons (user + admin) from last 2 days
2. Cron/edge function/API health audit (find silent killers)
3. Business plan document
4. In-person sales presentation document
5. Competitive market analysis: Michigan trades + healthcare → national → other professions
6. Organize business into documents

**Reality check on scope:**

- Browser click-testing: ~15-25 distinct surfaces shipped in last 2 days (HighVolumeBuyerAlerts, AdminHighVolumeBuyer, MyTechAlert badges, ClaimLead/LeadUnlocked badges, Stripe checkouts, Phase 18 backend triggers). At 1-2 min per surface that's 30-50 min of browser automation. Doable but I should confirm scope.
- Cron/edge audit: I can query `cron.job`, scan recent `function_edge_logs` for 4xx/5xx, check `agent_heartbeats` staleness. ~20 min.
- Market analysis (MI + national, trades + healthcare + others): This is a real research task. Done well = Perplexity Sonar deep research + structured doc. ~30 min and burns API credits.
- Business plan + sales playbook: Generated docs, ~15 min.

Total realistic scope: 1.5-2 hours of execution if all approved.

**Key risks if I just plow ahead:**
- I might click destructive admin buttons (manual digest send, force charges) on live data
- "All other professions" market analysis is unbounded — could be 50 verticals
- "National" analysis without scoping = generic AI slop

I need 2-3 clarifying questions before executing. Plan below.

---

# Launch Readiness + Strategic Docs — Execution Plan

## Phase 1 — E2E Click Audit (browser, ~30 min)

**User-facing surfaces (last 2 days):**
- `/high-volume-buyer-alerts` — landing page, trade/county selectors, Stripe checkout button (will stop at Stripe redirect, not complete payment)
- `/my-techalert` — verify CandidateRiskBadges render (HIBP cyber, urgency decay, FCRA-safe copy from Claude's batch 1)
- `/claim-lead` + `/lead-unlocked` — verify LeadQualityBadges render

**Admin surfaces (last 2 days):**
- `/dwa-admin` → 🛡️ Cron Sentinel tab
- `/dwa-admin` → High-Volume Buyer tab (verify subscriber list loads, MRR calc works, **skip** "Send Digest Now" button to avoid emailing real subscribers)

**Reporting:** Screenshot each, log any console errors, write findings to `/mnt/documents/launch-readiness-report.md`

## Phase 2 — Backend Health Audit (~20 min)

- Query `cron.job` → confirm all 100+ jobs scheduled, none with NULL urls (Phase 17 vault disaster pattern)
- Query last 24h of `function_edge_logs` for status_code >= 400, group by function_id
- Query `agent_heartbeats` for agents stale >24h
- Query `cron_sentinel_alerts` for unresolved critical alerts
- Run `supabase--linter` for security/RLS warnings
- Verify Phase 18 secrets exist: `HUNTER_API_KEY`, `SNOV_USER_ID`/`SNOV_API_KEY` (just added), `PDL_API_KEY`, `HIBP_API_KEY`, `NOAA_API_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `LOVABLE_API_KEY`, `TWILIO_*`
- Spot-curl 3 critical edge functions: `stripe-webhook` (HEAD), `hire-alert-scanner`, `contractor-lead-notify`

## Phase 3 — Strategic Documents (~45 min)

Output to `/mnt/documents/`:

1. **`DWA_Business_Plan_2026.pdf`** — Mission, 4 golden-path products, MRR targets, unit economics, 90-day execution roadmap, KPI dashboard
2. **`In_Person_Sales_Playbook.pdf`** — Per product (TechAlert, FieldDesk, Contractor Leads, Dead Lead Reactivation + new High-Volume Buyer): pitch script, demo flow, objection handlers, leave-behind one-pager, pricing card
3. **`Market_Analysis_Michigan.pdf`** — Trades (HVAC/plumbing/electrical/roofing) + Healthcare (CNA/LPN/RN). For each: market size, competitor matrix (LinkedIn Recruiter, Indeed, ServiceTitan, eWay, staffing agencies), DWA's edge (MIOSHA monitoring, BSEED permits, no other vendor does this), TAM
4. **`Market_Analysis_National.pdf`** — Same trades + healthcare verticals expanded to top 10 metros (Houston, Phoenix, Atlanta, Dallas, Charlotte, Tampa, Nashville, Indianapolis, Columbus, Cincinnati — high trades demand, weaker MIOSHA-equivalents = expansion path)
5. **`Business_Org_Index.md`** — Master index linking all docs + existing `knowledge/` files

**Market analysis methodology:** Perplexity Sonar `sonar-pro` queries (3-5 calls), structured into doc via Python + `python-pptx`/`reportlab`. Cited sources included.

## Clarifying questions (need answers before Phase 3)

I'll ask 3 questions to scope the strategic docs. Phases 1+2 I can execute right after approval.

**Open questions for you:**
1. **"Other professions" scope** — restrict to 3 specific verticals or skip entirely for v1?
2. **Destructive admin buttons** — skip all (safe), or test "Send Digest Now" to your own email only?
3. **Doc format** — PDFs (polished, slow), Markdown (fast, editable), or both?

After your answers I'll execute Phases 1→2→3 in order and deliver one summary message with all 5 documents + the readiness report attached.

