# Talent Radar v5 Enrichment Audit — 2026-04-18

## Headline
After full backfill of 126 person candidates through the 8-stage waterfall:
- **Contactability: 7.9% → 17.5%** (13 → 22 contactable leads)
- **Cost: $0.74 total** ($0.034 per contactable lead)
- **Hunter, Snov, Lusha, PDL, Apollo, Clay all returned ZERO hits**

## Per-Source Hit Rates (lifetime, all candidates)

| Source            | Unique Hits | Cost   | Status |
|-------------------|-------------|--------|--------|
| Sonar (OpenRouter perplexity/sonar-pro) | 125 | $0.74 | ⭐ Carrying everything |
| MIOSHA license DB | 105         | $0.00  | ✅ Free baseline |
| Building Permits  | 14          | $0.00  | ✅ Free |
| NPI Registry      | 8           | $0.00  | ✅ Free, healthcare only |
| Yelp              | 6           | $0.00  | ✅ Free |
| HIBP              | 1           | $0.00  | ✅ Free, breach hygiene |
| **PDL**           | **0**       | $0.00  | ❌ Zero hits across 100+ tries |
| **Hunter.io**     | **0**       | $0.00  | ❌ Skipped (no employer) |
| **Snov.io**       | **0**       | $0.00  | ❌ Skipped (no employer) |
| **Lusha**         | **0**       | $0.00  | ❌ Skipped (no employer) |
| **Apollo**        | **0**       | n/a    | ❌ Not wired into deep-enrich |
| **Clay**          | **0**       | $0.00  | ❌ Score≥7 gate, no employer |

## Root Cause
MIOSHA license records expose name + license + city only — **no employer**. Hunter/Snov/Lusha all need either a company domain or employer name to function. Only **26/126 (21%)** candidates have an employer at all.

PDL searches by name + region, doesn't need employer — but trade workers are underrepresented in PDL's LinkedIn-skewed DB. 0 hits in 100+ tries.

## Verdict: Do You Need Apollo?
**No.** Same employer-gate problem as Hunter/Snov. Save the money.

## What's Actually Carrying Talent Radar
**Sonar OSINT** (OpenRouter `perplexity/sonar-pro`) is the only paid API producing results. At $0.005/candidate with a 99%+ structural hit rate, it's the entire enrichment engine.

## Recommendations
1. **Cut Hunter/Snov/Lusha/PDL from trade vertical** waterfall (keep for healthcare + B2B if expanded)
2. **Try OpenRouter alternatives on exhausted high-score candidates**: `openai/gpt-5-mini`, `google/gemini-2.5-pro`, or `perplexity/sonar-reasoning-pro` (you have OpenRouter access)
3. **Add Twilio Lookup** ($0.005) on the 22 contactable phones to verify mobile vs landline
4. **Update deep-enrich short-circuit**: skip stages 4-6 when `current_employer` is null (saves wall time)

## Cost Math
- Per contactable lead: **$0.034**
- At 17.5% contactability, scanning 1,000 fresh candidates = ~$5 spend → 175 contactable leads
- Sonar is profitable even at $0.10/cand if the hit rate held — current $0.005 is essentially free
