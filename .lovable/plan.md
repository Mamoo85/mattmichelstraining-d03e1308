
# Sonar OSINT Enrichment Engine — DEPLOYED ✅

## What Changed (April 13, 2026)

### Apollo REMOVED — Sonar OSINT is now the sole enrichment engine.

**hire-alert-scanner/index.ts:**
- ❌ Deleted `scanApollo()` (180 lines of dead Apollo people/search code)
- ❌ Deleted `enrichMIOSHAWithApollo()` (Apollo people/match enrichment)
- ❌ Deleted `APOLLO_API_KEY` reference
- ✅ Added `enrichViaSonar()` — Perplexity sonar-pro via OpenRouter for LinkedIn, Facebook, email, phone, employer
- ✅ Added `synthesizeViaAI()` — Lovable AI Gateway (free) for qualifications + hiring recommendation
- ✅ Added `extractJSON()` — regex JSON stripper to handle LLM markdown hallucinations
- ✅ **Timeout Guard**: Sorts by score DESC, enriches only top 5 candidates inline (75s worst case)
- ✅ **No Ghost Lead Rule**: Candidates without ≥1 clickable link (LinkedIn/Facebook/email/phone) are EXCLUDED from client alerts
- ✅ **Action Button Email Cards**: Prominent clickable buttons — Message on LinkedIn, View Facebook, Send Email, Call, Verify State License
- ✅ **Founder Report Enhanced**: Shows enrichment status + ghost lead filter count (Matt-only)
- ✅ Sources NEVER revealed to clients — Black Box methodology preserved

**candidate-deep-enrich/index.ts:**
- ❌ Deleted all Apollo logic (`enrichViaApollo()`)
- ✅ Now Sonar-only second pass for stragglers (enrichment_status='pending')
- ✅ Skips already-complete candidates via DB query filter
- ✅ JSON safety: `extractJSON()` regex stripper
- ✅ AI synthesis: NEVER mentions AI, algorithms, or data sources

## Architecture: Enrich-Then-Alert

```text
scan MIOSHA + job boards → score → sort by score DESC
  → enrich top 5 via Sonar OSINT (15s timeout each)
  → synthesize via Lovable AI (qualifications + recommendation)
  → insert ALL candidates to DB (top 5 as 'complete', rest as 'pending')
  → No Ghost Lead filter (≥1 clickable link required)
  → send email with action buttons to matching clients
  → candidate-deep-enrich picks up 'pending' stragglers every 30 min
```

## Cost
~$0.003/candidate. 5/run × 1 run/day = $0.45/month.
