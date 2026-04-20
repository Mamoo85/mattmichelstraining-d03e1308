The user is handing me a third agent prompt — the **Lead Enhancement Orchestrator**. Same pattern as last time: nice-sounding spec, but I need to map it against what already exists before I touch anything.

Let me think about what's already live:

**Existing enrichment infrastructure (from CLAUDE.md + memory):**

- `lead-enrichment-waterfall` — already exists (referenced in `capture-enrich/index.ts`)
- `candidate-deep-enrich` — runs the 8-stage waterfall per candidate (referenced in `queue-worker-enrich/index.ts`)
- Memory `tech/talent-radar-enrichment-v5` — documents the actual enrichment stack with measured hit rates
- Memory `features/lara-data-extraction-pipeline` — Sonar + VAL + NinjaPear + Crustdata
- Phase 18 (yesterday): added Hunter, Snov, Apollo, HIBP, PDL, NPI Registry stages
- Phase 17 decision: **Proxycurl is dead** (LinkedIn lawsuit, shut down July 2025); **Crustdata is the LinkedIn replacement** but weak for trades
- `_shared/scraper.ts` + `_shared/cheap-extract.ts` — cost-optimization adapters already centralized
- `ai_call_log` — per-provider ROI tracking already exists

**What the prompt asks for vs reality:**


| Prompt step                   | Reality                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Apollo primary email          | ✅ Already wired (Phase 18)                                                                                            |
| Prospeo fallback              | ❌ Not integrated. New vendor.                                                                                         |
| Hunter fallback               | ✅ Already wired (Phase 18, `HUNTER_API_KEY`)                                                                          |
| ZeroBounce/NeverBounce SMTP   | ❌ Not integrated. New vendor. Hunter already does verification though.                                                |
| Lusha mobile primary          | ❌ Not integrated. New vendor.                                                                                         |
| Cognism mobile fallback       | ❌ Not integrated. New vendor.                                                                                         |
| Clearbit firmographics        | ❌ Clearbit was acquired by HubSpot, free tier killed. PDL already does this.                                          |
| PeopleDataLabs                | ✅ Already wired (`PDL_API_KEY` live)                                                                                  |
| CRM POST (HubSpot/Salesforce) | ❌ No CRM connector. Records go to `hire_alert_candidates` / `contractor_clients`.                                     |
| 85% coverage target           | Memory `talent-radar-enrichment-v5` says **trade vertical ceiling is ~17%** measured. 85% is fantasy for blue-collar. |


**This is the same trap as last time.** If I build it literally, I'll:

1. Add 4 new vendor integrations (Prospeo, ZeroBounce, Lusha, Cognism, Clearbit) — each needs a secret, each costs money, several duplicate what Hunter/PDL already do
2. Build a parallel "orchestrator" function that competes with the existing `candidate-deep-enrich` and `lead-enrichment-waterfall`
3. Promise an 85% hit rate that the measured data says is impossible for trades

**The smart play (same shape as last time):**

- Treat the prompt as **policy** to enforce on the existing waterfall, not as a spec for a new function
- Identify which vendor gaps are actually worth filling (Lusha for mobile is the real one — current stack is weak on direct-dial)
- Reject duplicates (Prospeo, ZeroBounce, Clearbit add no signal over Hunter + PDL)
- Set an honest coverage target per vertical, not one global 85%

I have enough context. No need to read more files — I just refactored this stack twice in the last 3 days. Let me write the plan.

---

## Honest read on the prompt

You're feeding me a third agent spec. Same shape as the last two: it sounds tight, but if I implement it literally I'll build a parallel orchestrator that competes with `candidate-deep-enrich` + `lead-enrichment-waterfall` (both already live and just upgraded in Phase 18 yesterday).

Let me grade each step against what's actually shipped.

### What the prompt asks for vs. what exists


| Step                        | Status                                                                            | Verdict                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Apollo primary email        | ✅ Live (Phase 18)                                                                 | Keep                                                                                                |
| Prospeo fallback            | ❌ New vendor                                                                      | **Skip** — duplicates Hunter                                                                        |
| Hunter fallback             | ✅ Live (Phase 18)                                                                 | Keep                                                                                                |
| ZeroBounce/NeverBounce SMTP | ❌ New vendor                                                                      | **Skip** — Hunter already returns verification status                                               |
| Lusha mobile (primary)      | ❌ Not wired                                                                       | **Add** — this is the real gap                                                                      |
| Cognism mobile (fallback)   | ❌ Not wired                                                                       | **Defer** — enterprise pricing, evaluate after Lusha proves out                                     |
| Clearbit firmographics      | ❌ Dead product (HubSpot killed free tier)                                         | **Skip** — PDL already does this                                                                    |
| PDL firmographics           | ✅ Live                                                                            | Keep                                                                                                |
| CRM POST                    | ❌ No HubSpot/Salesforce                                                           | **Skip** — records already land in `hire_alert_candidates` / `contractor_clients`, which IS the CRM |
| 85% coverage target         | Measured ceiling for trades is ~17% (per `mem://tech/talent-radar-enrichment-v5`) | **Reject the number** — set per-vertical targets                                                    |


### The 85% problem

You already measured this. The memory file from yesterday says trades cap at ~17% contactability because blue-collar workers don't live on LinkedIn and don't have B2B email databases tracking them. Healthcare hits higher (NPI registry is a goldmine). White-collar contractors hit higher (Apollo coverage).

A blanket 85% target is a recipe for me to spam-add vendors chasing a number that physics won't let me hit. Better targets:

- **Healthcare** (CNA/RN/LPN): 60% (NPI + PDL combo)
- **White-collar contractor decision-makers** (HVAC company owners, etc.): 50% (Apollo + Hunter)
- **Trade individuals** (a roofer named on a MIOSHA license): 20% — the ceiling is real

### Revised plan

**Phase A — Add the one vendor that actually closes a gap**

- Wire **Lusha** into `candidate-deep-enrich` as a new stage between PDL and Sonar fallback
- Lusha is SMB-focused, has direct-dial coverage US trades vendors don't
- Add `LUSHA_API_KEY` secret request
- Stage logs to existing `ai_call_log` so we can measure ROI before adding Cognism

**Phase B — Codify the orchestrator policy on the existing function**

- Add header doc block to `candidate-deep-enrich/index.ts` with the protocol (sequential, stop on first hit, log all)
- Verify the "stop on first verified hit" short-circuit logic is actually firing (audit, don't rebuild)
- Confirm Hunter's verification status is being respected (drop "risky"/"catch-all" — currently we may be keeping them)

**Phase C — Per-vertical coverage tracking**

- Add `coverage_by_vertical` rollup to `hire_alert_runs.source_breakdown` (already JSONB)
- Daily morning digest surfaces: healthcare X%, white-collar Y%, trades Z%
- This makes the 85%/17% conversation data-driven instead of vibes

**Phase D — Explicitly do NOT build**

- No Prospeo (Hunter covers it)
- No ZeroBounce/NeverBounce (Hunter returns status)
- No Clearbit (dead, PDL covers it)
- No CRM POST (your DB tables ARE the CRM — `hire_alert_candidates` + `contractor_clients`)
- No new orchestrator function (we have two already)

### Open question for you

Lusha pricing is $39/user/mo for ~330 credits, scaling up. Before I ask you to drop a card on a `LUSHA_API_KEY`, want me to:

1. **Just wire it** — assume you'll pay $39/mo to pilot
2. **Skip Lusha too** — accept current mobile-number coverage and stop chasing the gap
3. **Try the free tier first** — Lusha gives 5 credits/mo free, enough to test the integration before billing **i agree with everything, I got a free trial ask me for the key*

My recommendation: **option 3**. Wire it, you sign up free, we measure 5 lookups, then decide.