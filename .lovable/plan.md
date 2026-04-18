## Apify Mega-Plan — STATUS: COMPLETE ✅
Last updated: 2026-04-18

### All 9 steps
1. ✅ TS build error fixed (MyTechAlert.tsx Candidate interface)
2. ✅ Actor scaffolding (`.actor/`, `actor/`) committed in earlier loop
3. ✅ Secrets `APIFY_API_TOKEN` + `APIFY_WEBHOOK_SECRET` configured
4. ✅ `apify-results-handler` deployed (verify_jwt=false, query-string secret)
5. ✅ `apify_run_batches` table — already existed (uses `*_done`/`alerts_sent`, no migration needed)
6. ✅ `hire-alert-scanner` refactored to dispatcher; 3 Actor runs dispatch + webhook registered
7. 🚫 `scanLARABCCViaSonar`/`scanLARABPLHealthcare` — OBSOLETE (LARA VAL enumeration + fast-scanner cover this)
8. 🚫 `scanMichiganOpenData` field fix — OBSOLETE (function no longer exists in scanner)
9. ✅ 4-hour cron cadence — already in place

### Critical fixes applied this loop
- **Apify Actor IDs were all wrong** (404 on every dispatch). Fixed:
  - MIOSHA: `matt~m2training` → `transparent_meteorite~m2training`
  - Indeed: `bebity~indeed-scraper` → `misceres~indeed-scraper`
  - LinkedIn: `apify~linkedin-profile-scraper` → `harvestapi~linkedin-profile-scraper`
  - ThomasNet: `zen-studio~thomasnet-suppliers` → `zen-studio~thomasnet-suppliers-scraper`
- Updated `ACTOR_SOURCE_MAP` in handler to route new IDs.
- **Verified**: scanner dispatch run on 2026-04-18 07:25 returned HTTP 201 for all 3 Actors with run IDs stored in `apify_run_batches`.

### Talent Radar enrichment test results
- Tested 5 candidates lacking phone/email. 2 enriched, 3 already exhausted recently.
- **Sonar (stage 7)**: claims hit_fields `[phone, email, linkedin_url, current_employer, current_title]` but candidate rows still have phone/email/linkedin_url = NULL after enrichment. **Sonar is hallucinating field hits — only `current_employer` actually persists.**
- **Cost**: $0.005/candidate per Sonar call.
- **Recommendation**: Investigate Sonar response parser in `candidate-deep-enrich` — the `hit_fields` log doesn't match what's written to the DB. Possible JSON parsing bug or AI returning placeholder values that fail validation.

### What runs autonomously now
- Scanner dispatches 3 Apify Actors every 4h.
- Apify webhooks → `apify-results-handler?secret=...` → ingest into `lara_bpl` / `hire_alert_candidates` → mark `*_done` → fire scoring + alerts when all 3 complete.
- `apify-thomasnet-pull` available on-demand from admin panel.
