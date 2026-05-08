# AmeriSteel Outreach — Tripp Damman (Co-Owner)

## Company snapshot
- **AmeriSteel, Inc.** — 33900 Doreka Dr, Fraser, MI (also Warren plant)
- Family-owned sheet metal fab + steel service center, ISO 9001:2015
- ~6 employees, $1–10M revenue, automotive industry focus (Tier-1 / OEM RFQ work)
- Phone: (586) 585-5250 · Sites: ameristeel.com / ameristeelonline.com
- Co-Owner & Manufacturing Lead: **Tripp Damman** (LinkedIn confirmed)

## Why these 4 products fit a 6-person automotive fab shop

| # | Product | Pain it kills at AmeriSteel |
|---|---|---|
| 1 | **SiteRadar** ($49/mo) | They quote OEMs/Tier-1s daily. SiteRadar de-anonymizes the buyers researching them on ameristeel.com — "Magna viewed your laser-cutting page 3x this week" type intel |
| 2 | **Missed-Call Catch** ($99/mo) | One missed RFQ call = $5–50k PO walks. Auto-text-back the moment a call drops + voicemail transcription |
| 3 | **TechAlert** ($149/mo) | With only 6 employees, a single welder/laser-op leaving is catastrophic. Predicts flight risk before they quit |
| 4 | **Buyer/Growth Radar** ($149/mo) | Tracks new automotive plant expansions, contract awards, and supplier RFP signals across SE Michigan — pure top-of-funnel |

## Existing trial shells (provisioned earlier this session — re-using)

All four already exist under `info@ameristeel.com` — tokens pulled from DB:

| Product | Portal route | Token |
|---|---|---|
| TechAlert | `/talent-radar/dashboard?token=` | `06b71818…82a320d` |
| SiteRadar | `/my-site-radar?token=` | `9201f8ed…3dce1fbe` *(dispatch_token)* |
| Missed-Call | `/my-missed-call?token=` | `71b9e32a…15c889fa` |
| Buyer Radar | `/my-industry-pulse?token=` | `f66c3f09…32d6f948a` |

## Deliverable: text-ready SMS for Tripp

A single SMS with one **bundled landing URL** is cleaner than 4 raw links. Two implementation options:

**Option A — Single bundle hub page (recommended)**
Build `src/pages/AmeriSteelTrials.tsx` at route `/trials/ameristeel` — branded card grid showing all 4 products, each card with a "Open my trial →" button hardcoded to the matching token URL. SMS sends one short link.

```
Tripp — Matt Michels at Detroit Web Agency. 
Spun up 4 free trials for AmeriSteel: live website-visitor ID, 
missed-call catcher, employee flight-risk radar, and a buyer-signal feed for 
auto OEM RFQs. 30 days, no card. Walkthrough: https://detroitwebagent.com/trials/ameristeel
- Matt (313) 992-1219
```

**Option B — Raw 4-link SMS (no code changes)**
Concatenate all four token URLs into a single SMS. Works today, uglier, may segment into 2 SMS parts.

## Recommended implementation (Option A)

1. Create `src/pages/AmeriSteelTrials.tsx` — DWA-branded (Electric Teal #00d4ff), 4-card grid, each card has product name / one-line value prop / "Open my trial" CTA hardcoded to the token URL above. Mobile-first (Tripp will tap from phone).
2. Add route `/trials/ameristeel` in `src/App.tsx` with `lazyRetry()`.
3. Output the final ready-to-text SMS string in chat for Matt to copy.

## Out of scope
- No new DB rows (re-using existing trials per your answer)
- No outbound SMS send from the system — Matt sends manually from his personal phone
- No tracking pixel on the bundle page (can add later if Matt wants click attribution)

## Open question to confirm before build
Do you want the bundle page **public** at `/trials/ameristeel` (anyone with the URL sees the cards but each "Open trial" button hits the tokenized portal), or **gated** by an email-match check first? Public is simpler and the actual product portals are still tokenized so there's no data leak — recommend public.
