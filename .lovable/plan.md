

## Plan: Audit & Harden SECURITY DEFINER Views and Functions

### Goal
Find every database view and function that runs with elevated privileges (`SECURITY DEFINER` for functions, default-definer behavior for views) and confirm each one is either:
- A function with `SET search_path` locked (already the project standard), OR
- A view explicitly created with `WITH (security_invoker = true)` so RLS is enforced as the calling user, not the view owner.

Then surface a single report of anything missing and fix the gaps.

### Why this matters
A `SECURITY DEFINER` function or a default `SECURITY DEFINER` view bypasses the caller's RLS. If a public-facing view exposes data through such a view without `security_invoker=true`, any anon user can read everything in the underlying table — this is the #1 silent data leak risk in Supabase projects.

### Audit steps (read-only — runs in plan mode)

1. **Run Supabase linter** — catches `security_definer_view` and `function_search_path_mutable` warnings out of the box.
2. **Query `pg_views` + `pg_class.reloptions`** for every view in `public` schema — flag any view whose `reloptions` does NOT contain `security_invoker=true`.
3. **Query `pg_proc`** for every function with `prosecdef = true` in `public` — confirm each has `proconfig` containing `search_path=`.
4. **Cross-check with the `db-functions` list already in context** — 200+ functions, most are pgvector/cube/pg_trgm extension functions (safe, owned by extensions). Only audit the project's own functions (the ones with `SET search_path TO 'public'`).
5. **Check for `system_comms_log`, `hire_alert_*`, `contractor_*`, `dead_lead_*`, `prospect_*`, `industry_pulse_*` views** specifically — these are the highest-risk surfaces because they back public dashboards and magic-link pages (no auth).

### Report format (delivered after audit)

```
SECURITY DEFINER AUDIT — <date>
─────────────────────────────────────────────
✅ SAFE FUNCTIONS (NN):       has SECURITY DEFINER + locked search_path
✅ SAFE VIEWS (NN):           has security_invoker=true
⚠️  MISSING search_path (NN): function list — fix required
🚨 DEFINER VIEWS w/o invoker (NN): view list — CRITICAL, fix immediately

Per finding:
  - Object name
  - Schema
  - Why it's risky (1 line)
  - Exact ALTER statement to fix
```

### Fix phase (after report — requires default mode)

For each gap, generate one migration:
- **Views**: `ALTER VIEW public.<name> SET (security_invoker = true);`
- **Functions missing `search_path`**: `ALTER FUNCTION public.<name>(args) SET search_path TO 'public';`
- **Definer views that should actually be invoker** (vast majority): convert in place — no schema change needed.
- **Definer views that intentionally bypass RLS** (e.g. `vw_public_*` views that expose sanitized columns): document in a migration comment why and leave as-is. These are rare and only legitimate when the view itself filters/redacts columns the underlying table protects.

Each fix logged to a single migration: `supabase/migrations/<timestamp>_security_definer_hardening.sql` with one `ALTER` per object + a comment block at the top listing every change.

### Ongoing guardrail (added in same migration)

Add a `pg_event_trigger` that fires on `CREATE VIEW` / `CREATE OR REPLACE VIEW` and **rejects** any new view in `public` that doesn't have `security_invoker=true` set. This prevents regression — no future migration can ship a definer view without an explicit override.

```sql
CREATE OR REPLACE FUNCTION public.enforce_security_invoker_views()
RETURNS event_trigger LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM pg_event_trigger_ddl_commands()
           WHERE command_tag IN ('CREATE VIEW','CREATE OR REPLACE VIEW')
             AND schema_name = 'public'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      WHERE c.oid = r.objid
        AND 'security_invoker=true' = ANY(c.reloptions)
    ) THEN
      RAISE EXCEPTION 'View %.% must be created WITH (security_invoker = true) — see CLAUDE.md security rules', r.schema_name, r.object_identity;
    END IF;
  END LOOP;
END $$;

CREATE EVENT TRIGGER enforce_invoker_views
  ON ddl_command_end WHEN TAG IN ('CREATE VIEW','CREATE OR REPLACE VIEW')
  EXECUTE FUNCTION public.enforce_security_invoker_views();
```

### Files touched
- **NEW migration**: `supabase/migrations/<ts>_security_definer_hardening.sql` — one ALTER per finding + the event trigger
- **NEW memory file**: `mem://security/definer-views-and-functions` — records the current safe list + the rule "all new public views must include `WITH (security_invoker = true)`"
- **EDITED**: `mem://index.md` — add the new memory to the index

No edge function changes. No frontend changes. No data changes.

### What I'll deliver to you
1. A clean report (markdown, in chat) of everything audited
2. The single migration that fixes the gaps
3. The event trigger that prevents the same gap from being reintroduced
4. A memory entry so future sessions enforce the same rule automatically

