---
name: Cron Sentinel & Cron Migration Standards
description: Autonomous 6h watchdog for all production crons + ABSOLUTE BAN on current_setting in cron contexts
type: feature
---

# Cron Sentinel — Autonomous Cron Watchdog

**Lives at**: `supabase/functions/cron-sentinel/index.ts` + `/dwa-admin → 🛡️ Cron Sentinel` tab.

**Runs every 6 hours.** Performs three checks per monitored cron:

1. **Schedule Audit** — confirms cron exists in `cron.job` and is `active`
2. **Freshness Check** — confirms last run within expected window via `cron.job_run_details`
3. **Output Pulse** — confirms the table the cron writes to actually got new rows. **THIS is the check that catches silent failures** (cron runs successfully but function exits early because a secret returned NULL).

**On any critical failure:**
- SMS to ADMIN_PHONE (+13138064952) with summary
- Email digest to matthewmichels4@gmail.com with full diagnostic table
- Row inserted into `cron_sentinel_alerts` (visible in admin UI)

**Tables:**
- `cron_sentinel_alerts` — every check result (pass/fail), 7-day rolling history
- `cron_sentinel_snoozes` — admin-managed list to silence specific crons during planned downtime

**Watchlist** is hardcoded in `cron-sentinel/index.ts` `WATCHLIST` array. Adding a new cron requires adding it to the watchlist — forces discipline.

---

# 🚨 ABSOLUTE BAN: `current_setting('app.supabase_url')` in cron migrations

**This bug has burned us twice (Phase 13, Phase 15).** It silently kills crons.

**WHY it fails**: `current_setting('app.supabase_url')` returns NULL inside `cron.schedule()` because pg_cron runs in a separate context where the GUC variable isn't set. The cron schedules with a NULL URL, every execution silently dies (or never fires), and the function appears "broken" with no obvious cause.

**NEVER do this:**
```sql
-- ❌ FORBIDDEN — returns NULL in cron context, silently fails
PERFORM cron.schedule('my-job', '0 * * * *', $$
  SELECT net.http_post(url := current_setting('app.supabase_url') || '/functions/v1/...');
$$);
```

**ALWAYS do this — vault.decrypted_secrets pattern:**
```sql
DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  PERFORM cron.unschedule('my-job') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'my-job');

  PERFORM cron.schedule('my-job', '0 * * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $job$,
    v_url || '/functions/v1/my-function',
    json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text
    )
  );
END $$;
```

Reference template: `supabase/migrations/20260413000000_fix_broken_crons.sql`.

**Every PR that adds a cron MUST use this pattern.** Sentinel will catch failures within 6h, but prevention > detection.
