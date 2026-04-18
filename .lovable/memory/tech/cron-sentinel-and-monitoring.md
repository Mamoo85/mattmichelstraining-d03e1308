---
name: Cron Sentinel & Cron Migration Standards
description: Autonomous 6h watchdog for all production crons + ABSOLUTE BAN on vault-lookup patterns in cron migrations
type: feature
---

# Cron Sentinel — Autonomous Cron Watchdog

Lives at `supabase/functions/cron-sentinel/index.ts` + `/dwa-admin → 🛡️ Cron Sentinel`. Runs every 6h via `cron-sentinel-6h`. Three checks per cron: schedule audit, freshness, output pulse. On critical failure: SMS ADMIN_PHONE + email digest + row in `cron_sentinel_alerts`.

**Watchlist names MUST match real `cron.job.jobname` values exactly** — most agent crons end in `-daily`, `-4h`, `-friday`, etc. Mismatched names report false "missing".

---

# 🚨 ABSOLUTE BANS in cron migrations (3 burned us)

### #1 — `current_setting('app.supabase_url')`
Returns NULL inside `cron.schedule()`. Phase 13/15 disaster.

### #2 — `vault.decrypted_secrets WHERE name = 'SUPABASE_URL'` or `'SUPABASE_SERVICE_ROLE_KEY'`
**Phase 17 (2026-04-18) disaster.** The vault on this project contains ONLY `email_queue_service_role_key`. There is NO `SUPABASE_URL` and NO `SUPABASE_SERVICE_ROLE_KEY` entry. Every prior fix-broken-crons migration that did `WHERE name = 'SUPABASE_URL'` returned NULL → scheduled crons with NULL url + NULL Authorization → every fire died with `null value in column "url" of relation "http_request_queue"`. 21 crons silently dormant for weeks.

### #3 — Scheduling without NULL guards
If you don't `RAISE EXCEPTION` when v_url or v_key is empty, you'll never know it failed.

---

# ✅ THE ONLY APPROVED CRON PATTERN

Hardcoded URL + inlined anon JWT (URL never rotates; anon key is already public in `src/integrations/supabase/client.ts`). This is what the 100+ working crons use.

```sql
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw';
  v_hdr text;
BEGIN
  -- 🛡️ NULL GUARDS — non-negotiable
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  PERFORM cron.unschedule('my-job') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'my-job');
  PERFORM cron.schedule('my-job', '0 * * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/my-function', v_hdr));
END $migration$;
```

Reference template: `supabase/migrations/20260418*_phase17_fix_dormant_crons.sql`. Sentinel catches failures within 6h, but prevention > detection.
