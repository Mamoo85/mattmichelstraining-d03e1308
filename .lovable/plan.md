

## Plan: Beef up the schema-mismatch panel + log failures + retry button

Three small, surgical changes — no DB schema redesign, no UI overhaul.

### 1. Upgrade `validateSchema()` to return more debug detail

`src/lib/validateSchema.ts` — extend `SchemaValidation` with the fields we already compute but don't expose:

- `selectFields: string[]` — the exact `select()` string the caller used (passed in, echoed back)
- `tableName: string` — same
- `missing: string[]` (already there)
- `forbidden: string[]` (already there)
- `sampleKeys: string[]` — `Object.keys(rows[0])` so devs see what DID come back
- `rawError?: string` — the original Postgres error message verbatim

Add a 3rd `context` arg: `{ table: string; selectFields: string }` so each call site declares what it asked for.

### 2. Create reusable `SchemaErrorPanel` component

`src/components/shared/SchemaErrorPanel.tsx` — replaces the 3 inline copy-pasted rose-colored divs in `DemandThroughputKPIs.tsx`, `AdminDemandRadar.tsx`, and `DemandRadarHub.tsx` (FilteredSignalList).

Props: `validation`, `onRetry`, `componentName`.

Renders:
- Red header with `AlertTriangle` + "Data model mismatch in {componentName}"
- `reason` line
- Two columns of monospace chips:
  - **Missing columns** (red): list of `missing[]`
  - **Forbidden columns** (amber): list of `forbidden[]`
- **Queried table:** `industry_pulse_signals`
- **Selected fields:** monospace block showing the exact `select()` string
- **Returned columns** (collapsed `<details>`): the actual keys from row 0
- **Refresh data** button (cyan, calls `onRetry`)
- **Copy debug info** button — copies a JSON blob to clipboard for pasting into Lovable chat

### 3. Log mismatches to `schema_validation_failures` table

New migration `supabase/migrations/<ts>_schema_validation_failures.sql`:

```text
schema_validation_failures
├── id              uuid PK
├── component       text       (e.g. "AdminDemandRadar")
├── table_name      text
├── select_fields   text
├── reason          text
├── missing         text[]
├── forbidden       text[]
├── raw_error       text
├── user_agent      text
├── route           text       (window.location.pathname)
└── detected_at     timestamptz default now()
```

RLS: enabled. Policies:
- INSERT: `to anon, authenticated using (true)` — anyone can log a failure
- SELECT: `to authenticated using (public.has_role(auth.uid(), 'admin'))` — admins only

`SchemaErrorPanel` fires a fire-and-forget `supabase.from("schema_validation_failures").insert(...)` once per mount (guarded by `useRef` so retry doesn't double-log).

### 4. Wire the 3 callers to use the new panel + pass retry handler

Refactor each call site to:
- Pass `{ table: "industry_pulse_signals", selectFields: "<exact string>" }` to `validateSchema`
- Replace inline error div with `<SchemaErrorPanel validation={check} onRetry={load} componentName="..." />`
- For `DemandThroughputKPIs` (uses an IIFE in `useEffect`), refactor the loader into a `load()` callback so it can be re-invoked on retry.

### Files touched

| File | Change |
|---|---|
| `src/lib/validateSchema.ts` | Extended return type + context arg |
| `src/components/shared/SchemaErrorPanel.tsx` | **New** — reusable error UI |
| `src/components/dwa-admin/DemandThroughputKPIs.tsx` | Use new panel; extract loader for retry |
| `src/components/dwa-admin/AdminDemandRadar.tsx` | Use new panel |
| `src/components/dwa-admin/DemandRadarHub.tsx` | Use new panel in `FilteredSignalList` |
| `supabase/migrations/<ts>_schema_validation_failures.sql` | **New** table + RLS |

### Out of scope (not doing unless you ask)

- No alerting/email digest of failures — just the table. Add later if it gets noisy.
- No admin dashboard view for `schema_validation_failures` — query it via Supabase or add a `/dwa-admin` tab in a follow-up.

