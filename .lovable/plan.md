

# Fix Build Error + SQL Migration

## Issue 1: `process-email-queue` Build Error
The `process-email-queue` Edge Function imports `npm:@lovable.dev/email-js` which cannot resolve. This is a **Lovable-managed email infrastructure function** — it needs to be regenerated using the email infrastructure setup tool, not manually edited.

**Fix**: Run the `setup_email_infra` tool to regenerate the function with correct dependencies.

## Issue 2: `seo_page_configs` SQL Migration Syntax Error
The migration file `20260331000001_seo_page_configs.sql` is failing. The table likely already exists in the database from a prior manual run. 

**Fix**: Create a new migration that uses `DO $$ ... IF NOT EXISTS` guards around both the table creation and the policy creation to make it idempotent:

```sql
CREATE TABLE IF NOT EXISTS public.seo_page_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade TEXT NOT NULL,
  city TEXT NOT NULL,
  slug TEXT NOT NULL,
  page_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.seo_page_configs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'seo_page_configs' AND policyname = 'service_role_seo_page_configs'
  ) THEN
    CREATE POLICY "service_role_seo_page_configs"
      ON public.seo_page_configs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
```

Delete the broken migration file and apply this corrected version.

## File Changes

| File | Action |
|------|--------|
| `supabase/functions/process-email-queue/*` | Regenerate via email infra tool |
| `supabase/migrations/20260331000001_seo_page_configs.sql` | Replace with idempotent version |

