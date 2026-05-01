# DJ Conley / DWA Master Plan — v4 (Post-Launch Growth)

**Status:** Draft — opened 2026-05-01 after v3 build complete.
**Premise:** v3 shipped the offer + closed Pat. v4 is about retention, expansion revenue, and a second vertical beyond healthcare staffing.

---

## v4 Pillars

### Pillar 1 — Post-Launch Retention (prevent month-3 churn)

**§1. NPS + Health Score Auto-Triage**
- Existing: `client_nps_scores` table, `nps-survey-sender` function
- Add: weekly health score per client (logins, support tickets, feature usage, payment status)
- If score drops below threshold → autopilot triggers Matt SMS + Loom video request
- Surface in `/dwa-admin/client-health` with traffic-light board

**§2. Quarterly Business Review (QBR) Auto-Generator**
- Every 90 days per client: edge function compiles last-quarter wins (leads, calls captured, jobs closed)
- Generates branded PDF via Browserless
- Emails client + Matt with "schedule QBR call" CTA
- Forces a touchpoint that prevents silent churn

**§3. Forever-Pricing Anniversary Notice**
- 30 days before each client's renewal date, autopilot sends "Your price is locked forever — here's what you've gotten this year" recap
- Reinforces the moat baked in v3

---

### Pillar 2 — Expansion Revenue (sell more to existing clients)

**§4. Smart Upsell Triggers**
- Watch for usage patterns that signal upsell readiness:
  - FieldDesk client with >50 jobs/mo → pitch SiteRadar Pro
  - SiteRadar client with >10 hot visitors/wk → pitch Mortgage Radar or TechAlert
  - Any client with >$5k MRR for 6+ mo → pitch Bundle Revenue Suite
- One-click "send upsell pitch" button in `/dwa-admin/clients/:id`

**§5. Add-On Marketplace for Existing Clients**
- New page: `/my-addons` — logged-in client sees menu of add-ons they don't have yet
- Each add-on: 1-paragraph pitch + "add to my plan" button → Stripe subscription update (not new checkout)
- Monthly email digest: "3 add-ons your competitors are using"

**§6. Referral Program v2 — Tiered Rewards**
- v3 paid flat $50 per converted referral
- v4: stack rewards — 3 referrals = free month, 5 = $500 cash, 10 = lifetime 20% off
- Public leaderboard at `/refer-a-contractor` (opt-in, first names only)

---

### Pillar 3 — Second Vertical Beyond Healthcare Staffing

**§7. Vertical Selection Framework**
Score candidates on:
- Avg deal size ($5k+ per customer = priority)
- Pat-style anchor contact already in network? (Y/N)
- Replicates 80%+ of existing tech stack? (Y/N)
- Buyer pain you've personally validated? (Y/N)

**§8. Top Three Candidates for v4**
- **A) Commercial Roofing (Detroit metro)** — $20k–$80k jobs, BSEED permits already scraped, easy fit for Mortgage Radar reskin
- **B) Insurance Restoration (storm chasers)** — high deal size, NOAA API already integrated, Matt's cousin angle?
- **C) Auto Repair Shops (Tier 2/3 cities)** — Missed-Call Catch + Reputation Dashboard slot in cleanly, SMB-density market

**§9. Vertical Launch Playbook (repeatable)**
1. One landing page (copy Healthcare Staffing MI template)
2. One demo page (copy DJ Conley v2 demo pattern)
3. One Apollo enrichment script targeting that vertical's job titles
4. One pricing page (steal Managed Website $499/mo pattern)
5. One pilot contact (Pat-equivalent anchor)

---

### Pillar 4 — Operational Defense

**§10. Compliance Auto-Audit**
- Weekly cron: scan all outbound channels for TCPA/CAN-SPAM violations
- Auto-disable any campaign with 2+ spam complaints in 24h
- SMS Matt on any flag

**§11. Stripe Reconciliation Dashboard**
- Cross-reference Stripe subscriptions vs. local `*_clients` tables every 6h
- Surface mismatches (paid but no provisioning, provisioned but not paid)
- Already partially built — formalize into one admin page

---

## Suggested v4 Build Order

1. §3 Anniversary Notice (1 hr — locks in retention immediately)
2. §1 Health Score Triage (half day)
3. §4 Smart Upsell Triggers (half day)
4. §6 Referral Program v2 tiers (2 hrs)
5. §10 Compliance Auto-Audit (half day)
6. §5 Add-On Marketplace (full day)
7. §2 QBR Auto-Generator (full day)
8. §7–§9 Pick second vertical + ship landing/demo/pricing (2 days)
9. §11 Stripe Reconciliation Dashboard (half day)

**Total:** ~6 build days for full v4.

---

## Decisions Locked (2026-05-01)

1. **Second vertical:** **Commercial Roofing (Detroit metro)** — highest deal size, BSEED permits already scraped, Mortgage Radar reskin is fastest path to revenue.
2. **NPS surveys:** **Auto-sent at 30 days**, then quarterly. Matt gets SMS only on detractor scores (≤6).
3. **Referral tiers:** **$250 cash at 5 referrals** (scaled down from $500), free month at 3, lifetime 20% off at 10.
4. **QBR PDFs:** **Queue for Matt's manual review first** — sent from `/dwa-admin/qbr-queue` with one-click approve & send. Auto-send only after 4 successful manual reviews per client.

Build proceeding in the order above.
