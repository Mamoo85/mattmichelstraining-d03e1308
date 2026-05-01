Continue shipping the remaining items from the One-Press / Agency Outreach hardening plan that were called out as not-yet-shipped:

1. **Queue-route Auto-Blast** (`supabase/functions/contractor-outreach-auto-blast/index.ts`)
   - Replace direct send loop with insertions into `outreach_send_queue` so blasts get retries + observability for free.
   - Return `{ queued_count, skipped, errors }` immediately.
   - Trigger `outreach-queue-worker` once after queueing so manual demos still feel instant.
   - Keep daily-cap and suppression checks before queueing (don't queue garbage).

2. **Deeper diagnostics drawer wiring** (`src/components/admin/OnePressLauncher.tsx` + small new `OnePressDiagnosticsDrawer.tsx`)
   - Add an "Open diagnostics" button on every run card.
   - Drawer shows: full `stage_progress` JSON pretty-printed, last 20 `outreach_send_queue` rows for this run (`run_id` filter), last 20 `outreach_logs` rows, and any `enrichment_trace` from the prospect rows touched.
   - Add a "Run worker now" button that invokes `outreach-queue-worker` directly and toasts the drained count.
   - Add a "Retry failed stage" button that re-invokes `outreach-one-press` with `{ resume_run_id }` for the failed stage only.

3. **Refresh trigger button on the One-Press card** (`src/components/admin/OnePressLauncher.tsx`)
   - Add a "Refresh proof pool" secondary button next to Launch.
   - Calls `agency-prospect-pool` + `techalert-prospect-hunter` (best-effort, parallel) and shows per-source counts in a toast.
   - Disables itself for 60s after click to prevent spam.

4. **Backend support for resume + worker-now**
   - Add `resume_run_id` handling in `outreach-one-press/index.ts`: load existing run row, skip already-completed stages, retry from `stage_progress.failed_stage`.
   - Confirm `outreach-queue-worker` accepts a `{ trigger: "manual" }` body and returns `{ drained, sent, failed }`.

5. **Light migration if needed**
   - If `outreach_send_queue` lacks a `source_run_id` column for filtering by One-Press run, add it (nullable, indexed). Otherwise skip.

6. **Validation**
   - Curl `contractor-outreach-auto-blast` and confirm it returns `queued_count > 0` and rows land in `outreach_send_queue`.
   - Trigger one-press, then click "Open diagnostics" and confirm queue + logs render.
   - Click "Refresh proof pool" and confirm toast shows non-zero counts (or specific zero reasons).
   - Click "Run worker now" and confirm sends drain.

### Files expected to change
- `supabase/functions/contractor-outreach-auto-blast/index.ts` (refactor to queue)
- `supabase/functions/outreach-one-press/index.ts` (resume support)
- `src/components/admin/OnePressLauncher.tsx` (refresh + diagnostics buttons)
- `src/components/admin/OnePressDiagnosticsDrawer.tsx` (new)
- Possibly one tiny migration adding `source_run_id` to `outreach_send_queue`.

### Out of scope
- No changes to Agency Outreach drawer beyond what was already shipped last turn.
- No changes to Stripe / billing / fulfillment paths.
- No new external API integrations.