# Autonomous Engine & System Health Finalization

Extends existing telemetry (`system_comms_log`, `cron_job_health`, `cron-sentinel`, `HealthComplianceHub`) rather than duplicating it. Three additive layers — no UI restyling, strict DWA nomenclature ("Automated Systems," "Ingestion Pipelines," "Proprietary Infrastructure" — never "agents/bots").

## 1. Centralized Heartbeat Log — `engine_logs` table

New table capturing **per-execution** footprints (the existing `system_comms_log` is per-message; `cron_job_health` is rolling aggregate — neither captures "job X started at T, processed N records, finished OK").

```sql
CREATE TABLE public.engine_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL,              -- e.g. 'hire-alert-scanner'
  run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL,                -- 'started' | 'success' | 'partial' | 'failed'
  records_processed int DEFAULT 0,
  records_failed int DEFAULT 0,
  duration_ms int,
  error_message text,
  metadata jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
-- RLS: admin SELECT, service_role full
-- Indexes on (pipeline, started_at DESC), (status) WHERE status IN ('failed','partial')
```

Shared helper `supabase/functions/_shared/engine-log.ts` exporting `startRun(pipeline)` → returns `{ runId, complete(records, opts), fail(error) }`. Wraps insert + update; never throws (telemetry must not break pipelines).

**Instrumented pipelines (Phase 1 — top revenue paths):**
- `hire-alert-scanner`
- `contractor-lead-notify`
- `dead-lead-drip`
- `missed-call-handler`
- `mortgage-radar-scanner`
- `process-email-queue`
- `cron-sentinel` itself

Pattern: `const run = await startRun('hire-alert-scanner'); ... await run.complete(processed);` in the success path; `await run.fail(err)` in catch.

## 2. Dead-Letter Queue & Self-Healing

Add `requires_retry` columns to the existing comms log instead of a parallel table:

```sql
ALTER TABLE public.system_comms_log
  ADD COLUMN requires_retry boolean NOT NULL DEFAULT false,
  ADD COLUMN retry_count int NOT NULL DEFAULT 0,
  ADD COLUMN last_retry_at timestamptz,
  ADD COLUMN retry_payload jsonb;       -- enough to re-dispatch (to, body, product)
CREATE INDEX idx_comms_retry_pending
  ON public.system_comms_log (created_at)
  WHERE requires_retry = true AND retry_count < 5;
```

**`_shared/twilio.ts` change**: on Twilio fetch failure or non-2xx, instead of just logging `status='error'`, write the row with `requires_retry=true` + `retry_payload={to,body,product}`. Same pattern in `_shared/stripe-helpers` for webhook dispatch failures (timeouts only — never duplicate paid charges; retries are scoped to *outbound notifications* and *idempotent edge-function invocations*, not Stripe API mutations).

**New cron + function**: `dispatch-retry-queue` runs every 10 min. Selects up to 100 rows where `requires_retry=true AND retry_count < 5`, re-dispatches via the appropriate channel, increments `retry_count`, clears flag on success. After 5 attempts, sets `status='dead_letter'`, clears `requires_retry`, calls `notifyMatt` once. Each scanner cron also calls this **before** new work so stranded records drain first.

Scheduled with `safe_cron_schedule` per the Cron Safety Layer rules — hardcoded URL + inlined anon JWT, NULL guards, no vault lookups.

## 3. Admin Dashboard — "Automated Systems Heartbeat"

New component `src/components/dwa-admin/AutomatedSystemsHeartbeat.tsx`. Mounted as the **first tile** inside the existing `HealthComplianceHub` "🛡️ Service Resilience" sub-tab (no nav restructure, no styling overrides — reuses the same glass-card / pill conventions as `EnrichmentHealthStrip`).

Reads:
- `engine_logs` — last run per pipeline, success rate (24h), avg duration
- `system_comms_log WHERE requires_retry=true` — dead-letter backlog
- `cron_job_health` — already-tracked freshness

Renders one row per Ingestion Pipeline with a colored dot:
- **Green**: last run succeeded AND within expected interval AND retry backlog < 10
- **Amber**: stale (>2× expected interval) OR retry backlog 10–50 OR last run = `partial`
- **Red**: last run = `failed` OR retry backlog > 50 OR pipeline silent > 24h

Auto-refresh every 60s. Click a row → expandable panel showing last 10 `engine_logs` rows for that pipeline. Copy: "Automated Systems," "Ingestion Pipeline," "Proprietary Infrastructure." No "agent/bot/AI" terminology in any string, comment, or label.

## Out of scope (intentionally)

- No UI restyling outside the new heartbeat tile
- No retries on Stripe charge mutations (idempotency risk) — only on outbound SMS/email and idempotent function invocations
- Phase 2 instrumentation of the remaining ~580 edge functions follows the same pattern but is a follow-up sweep

## File changes

**New (5):**
- `supabase/migrations/<ts>_engine_logs_and_dead_letter.sql`
- `supabase/functions/_shared/engine-log.ts`
- `supabase/functions/dispatch-retry-queue/index.ts`
- `supabase/migrations/<ts>_dispatch_retry_queue_cron.sql`
- `src/components/dwa-admin/AutomatedSystemsHeartbeat.tsx`

**Edited (~9):**
- `supabase/functions/_shared/twilio.ts` — write `requires_retry` on failure
- `supabase/functions/hire-alert-scanner/index.ts`
- `supabase/functions/contractor-lead-notify/index.ts`
- `supabase/functions/dead-lead-drip/index.ts`
- `supabase/functions/missed-call-handler/index.ts`
- `supabase/functions/mortgage-radar-scanner/index.ts`
- `supabase/functions/process-email-queue/index.ts`
- `supabase/functions/cron-sentinel/index.ts`
- `src/components/dwa-admin/HealthComplianceHub.tsx` — mount new tile

Approve and I'll execute.