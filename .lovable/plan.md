

## Plan: Fix Build Error + Apify Mega-Plan

Two parts. Part 1 unblocks the build right now (1 line). Part 2 is your Apify mega-plan, fully accepted.

---

### Part 1 — Fix build error (immediate, 1 file)

The `Candidate` TS interface in `MyTechAlert.tsx` declares `flight_risk` and `flight_risk_proof` as **required**, but the demo objects (and any older API responses) might not always include them. Make them **optional** on the interface.

**File:** `src/pages/MyTechAlert.tsx`
**Change:** In the `Candidate` interface, change:
```
flight_risk: string;
flight_risk_proof: string;
```
to:
```
flight_risk?: string | null;
flight_risk_proof?: string | null;
```

Build passes. Demo cards still render (they have the fields). Real API responses are safe even if the field is missing on older rows.

---

### Part 2 — Apify Integration (accepting your full plan)

Approving everything you laid out. Confirming the order:

1. **Step 1 (Bug fix)** — already done in last cycle (`scanMIOSHA()` filter widened). ✅ verified.
2. **Step 2** — Create Apify Actor scaffolding files at repo root: `.actor/actor.json`, `.actor/INPUT_SCHEMA.json`, `.actor/Dockerfile`, `actor/main.js`, `actor/package.json`. Actor downloads MI LARA BPL Excel + FL DBPR CSV via SheetJS, pushes normalized rows to Apify dataset.
3. **Step 3** — Two new secrets needed: `APIFY_API_TOKEN` + `APIFY_WEBHOOK_SECRET`. **I will request both before writing dispatcher/handler code.**
4. **Step 4** — New edge fn `apify-results-handler` (verify_jwt=false): validates `X-Apify-Webhook-Secret`, fetches dataset items, routes by Actor ID (MIOSHA → upsert `lara_bpl`, Indeed → candidate signals, LinkedIn → enrich existing rows), updates `apify_run_batches`, fires scoring + alerts when all 3 done.
5. **Step 5** — Migration: `apify_run_batches` table.
6. **Step 6** — Refactor `hire-alert-scanner` from monolith → dispatcher. Dispatches 3 Apify runs (m2training MIOSHA Actor, `bebity~indeed-scraper`, `apify~linkedin-profile-scraper`) with webhook → `apify-results-handler`. Exits in ~3s.
7. **Step 7** — Replace stub `scanMiPLUS()` with `scanLARABCCViaSonar()` + `scanLARABPLHealthcare()` (Sonar-based, complementary to Actor-based bulk).
8. **Step 8** — Fix `scanMichiganOpenData()` field names + add trade-type filter + log first row for diagnostics.
9. **Step 9** — Cron migration: 4-hour cadence. (Already in place from prior cycle — will verify, skip if duplicate.)

**Note on already-done items:** Last cycle shipped some of this (4h cron exists, source label fix done, Crustdata Stage 7C in deep-enrich, lara_val_cursor + fast-scanner). The Apify work **layers on top** — it does not replace what's there. Crustdata stays as Stage 7C (already paid trial), Apify LinkedIn becomes Stage 7B (replaces dead Proxycurl reference).

**Manual steps for Matt (after code lands):**
1. Apify dashboard → API tokens → create + add to Lovable secrets as `APIFY_API_TOKEN`
2. Apify dashboard → m2training Actor → Webhooks → set URL + secret string → add same string as `APIFY_WEBHOOK_SECRET`
3. Push to main → Apify auto-rebuilds Actor from GitHub

**Order of execution next loop:**
1. Fix the 1-line TS error (unblocks build immediately)
2. Request `APIFY_API_TOKEN` + `APIFY_WEBHOOK_SECRET` (blocker — wait for approval)
3. While waiting: write Actor files + migration + `apify-results-handler` skeleton
4. Once secrets land: wire dispatcher in `hire-alert-scanner`, deploy, test

