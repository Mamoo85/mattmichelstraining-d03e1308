## Honest reassessment

You're right to pause. Let me audit the plan I just half-shipped before we keep going.

### What I built (and what's wrong with each piece)

**1. `talent-radar-extraction` — broken by design**
The agent prompt says "use SODA." I built it. It returned **0 records**. Why? Michigan LARA trade licenses are **not on data.michigan.gov / Socrata**. They live on Accela (MiPLUS).

Meanwhile, your existing `miosha-license-scraper` was JUST upgraded yesterday (Phase 19, commit `e4339fb`) to use the **Accela REST API** with `ACCELA_APP_ID` + `ACCELA_APP_SECRET` — exactly the data source the new agent needs but isn't using.

So I built a parallel scanner that queries the wrong API while the working one sits next to it. That's not extraction discipline — that's duplication.

**2. `demand-radar-extraction` — works, but solves a problem you already solved**
The 25/25/25/25 sector balance logic works (proven in test: 5/5/5/5). But:

- You already have `contractor-prospector` doing Google Places discovery for the same 4 trades.
- I created a new `demand_radar_targets` table when contractor candidates already flow into `contractor_clients` / `contractor_lead_sites`.
- Nothing downstream reads `demand_radar_targets` yet — it's a dead-end queue.

**3. The "Post-Extraction Enhancement Queue" is fictional**
The agent prompt names it like it exists. It doesn't. I mapped Talent Radar to `hire_alert_candidates` (real) and Demand Radar to a brand new orphan table (not real). Inconsistent.

### The smart play

The agent prompts are **good policy** (deterministic extraction, no contact-guessing, sector balance, queue handoff). But they should be **enforced on the existing scanners**, not used as an excuse to build parallel ones.

### Revised plan

**Phase A — Delete the duplicates**

- Delete `talent-radar-extraction` edge function
- Delete `demand-radar-extraction` edge function
- Delete `demand_radar_targets` table (migration)
- Revert the additions to `queue-worker-scrape` and `hire-alert-dispatcher`

**Phase B — Apply the protocols to the real scanners**

*Talent Radar protocol → `miosha-license-scraper` (already on Accela, already wired):*

- Add a header comment block making the protocol explicit (extraction-only, no contact guessing, 24h window, 4 trades)
- Confirm it filters strictly to HVAC/Plumbing/Electrical/Roofing (it does — verify)
- Confirm output goes to `hire_alert_candidates` with `enrichment_status='pending'` so `candidate-deep-enrich` picks it up
- Add `source_breakdown` per-trade counts to `hire_alert_runs` (already done in Phase 19)

*Demand Radar protocol → `contractor-prospector`:*

- Add the 25/25/25/25 sector-balance enforcement (this is the one genuinely new piece — it's currently uneven)
- Add the qualification filter (drop sole-prop / require rating_count ≥ 5 OR website)
- Keep writing to existing `contractor_clients` table — don't fork the schema
- Add header comment with the agent protocol

**Phase C — Document and stop**

- Update memory: "Talent Radar = `miosha-license-scraper` (Accela). Demand Radar = `contractor-prospector` (Google Places). Do not create parallel scanners."

### Why this is better

1. **No new tables.** Everything flows into the schema you already pay attention to.
2. **One source of truth per radar.** No guessing which scanner ran.
3. **Keeps the hard-won Accela auth work** from Phase 19 alive instead of bypassing it.
4. **The only genuinely new logic** (25/25/25/25 + qualification filter) gets added to the real scanner that already has clients depending on it.
5. **Roughly 70% less code** than what I was about to ship.

### Open question for you

The agent prompts use the term "Post-Extraction Enhancement Queue." In your stack that maps to:

- Talent side: `hire_alert_candidates` rows with `enrichment_status='pending'` → consumed by `candidate-deep-enrich`
- Demand side: `contractor_clients` rows → consumed by enrichment waterfall

Confirm that mapping is what you meant, or tell me if "Enhancement Queue" was meant to be a new unified table for both sides (I'd argue against it, but it's your call). **I agree with you. Don't do it. *