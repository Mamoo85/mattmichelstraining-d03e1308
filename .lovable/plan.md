# Audit-of-the-Audit + Realistic Roadmap

## TL;DR — Direct answers to your 4 questions

1. **What can I NOT do on this list?** — Almost everything is doable in this environment. The only items I genuinely cannot do are: (a) buy/sign legal policies (lead guarantee, FCRA disclosure PDF), (b) build native mobile apps with OS push notifications (PWA push works on Android, partial on iOS 16.4+), and (c) sign ATS/CRM partnership agreements. Everything else — code, migrations, edge functions, deploys — is in scope.

2. **Audit of Claude's audit** — Mostly accurate, but **3 material errors** (see below). The biggest one: he listed "deploy the 5 missing verticals" as a P0 blocked on you fixing a GitHub token. **That's wrong.** I can deploy the scanner directly via Lovable Cloud — no GitHub Actions involved. That's why your token fix yesterday didn't change anything: it deploys to the *secondary* project (`zmyczlfuufhngzovkjdh`), not the primary one customers actually use.

3. **Free alternatives to Apollo / Hunter** — Yes, several. You already have **Hunter (`HUNTER_API_KEY`)**, **Snov (`SNOV_API_KEY` + OAuth set)**, **PDL (`PDL_API_KEY`)**, **Clay (`CLAY_API_KEY`)**, **Lusha (`LUSHA_API_KEY`)**, and **Apollo** itself is already paid for in your secrets. So the "risky to pay before paying customer" concern is moot — every key in the waterfall is already provisioned. Free fallback chain: **public site scrape (Firecrawl) → Hunter domain search (free 25/mo) → SEC EDGAR / state SoS for entity owners → SiteRadar visitor identify (already built)**. We can run this without spending Apollo credits at all on cold scans.

4. **Fix the Supabase deploy problem** — Doing it in this turn. See P0 below.

---

## Audit-of-Claude's-Audit: Errors and corrections

| Claude said | Reality |
|---|---|
| "P0-A: Matt must fix GitHub token to deploy 5 verticals" | **Wrong.** GitHub Actions deploys to the secondary project. The primary project (Lovable Cloud) deploys via the agent. I'll deploy `trade-radar-scanner` in this run. |
| "MyMissedCall.tsx is 111 lines, no real features" | Need to verify — last session log shows missed-call infra is built (voicemail-transcription-handler, callback-reminder-sender exist). Portal may already display it. Will audit before rebuilding. |
| "RadarExportBar already exists in `src/components/shared/`" | Need to verify — if it exists, Fix #3 is a 10-min wiring job. If not, must build it first. |
| "Apollo + Hunter risky to pay before customer" | Moot — both keys are already in your secrets. Snov + PDL + Lusha + Clay also already paid. No new spend needed. |
| "% Customer-Ready" percentages | Subjective. Useful directional, not absolute. I'll re-score after the P0 fixes. |
| "Buyer Radar 55%" | Unverified — need to check if `MyBuyerRadar.tsx` exists and what state it's in. |
| "Mortgage Radar — no mark-as-contacted" | **Already fixed in last session** — I added `LeadActionBar` to `MyMortgageRadar.tsx` an hour ago. |

The rest of the audit is directionally correct.

---

## Free / Already-Paid Enrichment Stack (no new spend)

You already own a stronger enrichment stack than Claude proposed. Real waterfall:

```text
Stage 1 (free)    Firecrawl site scrape  → owner name, sometimes email/phone from contact page
Stage 2 (free*)   Hunter domain search    → 25 free/mo, then $34/mo (you have key)
Stage 3 (paid-yours) Snov.io              → email finder + verifier (you have OAuth keys)
Stage 4 (paid-yours) PDL                   → person enrichment by email/name (you have key)
Stage 5 (paid-yours) Apollo               → people/org search (you have key)
Stage 6 (paid-yours) Lusha / Clay         → premium fallback (you have keys)
```

For mortgage/trade leads, owner contact via **public records** is also free:
- Wayne County Register of Deeds → owner name + mailing address
- Michigan SoS Business Search → LLC owner
- BSEED permit applicant → contractor + sometimes owner

Recommendation: build the waterfall but **gate stages 3–6 behind a per-client setting**. Free stages 1–2 run on every lead. Premium stages run only after a customer marks the lead "calling now" (intent signal). Cost stays near zero until a lead is actually being worked.

---

## P0 — I do these in the next build pass

1. **Deploy `trade-radar-scanner` to primary project via Lovable Cloud** (no GitHub needed). Verify all 11 verticals respond. ETA: 2 min.
2. **Audit + fix `MyMissedCall.tsx`** — read current state, decide rebuild vs incremental.
3. **Verify `RadarExportBar`, `MyBuyerRadar`, `MyDemandRadar`, `MyFieldDesk`** existence and state.
4. **Build `OnboardingChecklist` component** (shared, used by all portals).

## P1 — Same build pass if time, otherwise next loop

5. **Build `_shared/enrichment-cheap.ts`** — Firecrawl + Hunter free-tier waterfall, no Apollo spend.
6. **Wire enrichment into `trade-radar-scanner`** — runs on score ≥ 7 leads only (cost control).
7. **Add CSV export** (`RadarExportBar` if exists, else build) to TradeRadarPortal + MyMortgageRadar.
8. **Score ≥ 9 SMS push** in trade-radar-scanner using existing `sendSMS` helper.

## P2 — Next loop after P1 ships

9. Extend portal history to 90 days (date-range picker).
10. Self-serve Dead Lead CSV upload UI.
11. Realtime subscription on TradeRadarPortal.
12. Geographic expansion to Michigan-wide ZIPs.

## P3 — Ask before building (revenue/policy decisions)

13. Team seats — needs pricing decision from you.
14. CRM webhook delivery — needs prioritization (HubSpot first? Jobber first?).
15. Lead guarantee policy — your decision, not mine.
16. Native mobile push — PWA push (free) vs Capacitor native ($99/yr Apple).

---

## What I will NOT do without your approval

- Spend money on a new vendor (none of the above requires it).
- Sign legal compliance docs.
- Build CRM integrations until you say which CRM matters first.
- Promise customers a lead guarantee.
- Build a native mobile app (PWA is already wired and shipped).

---

## Files I will touch in P0/P1

```text
DEPLOY (no file change):
  supabase/functions/trade-radar-scanner   → push to primary project

READ ONLY (audit):
  src/pages/MyMissedCall.tsx
  src/pages/MyBuyerRadar.tsx (if exists)
  src/components/shared/RadarExportBar.tsx (if exists)
  src/pages/MyDemandRadar.tsx
  src/pages/MyFieldDesk.tsx

CREATE:
  src/components/shared/OnboardingChecklist.tsx
  supabase/functions/_shared/enrichment-cheap.ts (P1)

EDIT:
  supabase/functions/trade-radar-scanner/index.ts (P1 — enrichment + score-9 SMS)
  src/components/trade-radar/TradeRadarPortal.tsx (P1 — export bar)
  src/pages/MyMortgageRadar.tsx (P1 — export bar)
  Possibly src/pages/MyMissedCall.tsx (P0 — based on audit)
```

Approve and I'll start with the scanner deploy + audit.