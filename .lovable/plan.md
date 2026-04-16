

# Fix Postcards System — Plan

## Root Cause
**RLS blocks all frontend reads.** All three postcard tables (`postcard_prospects`, `postcard_campaigns`, `postcard_conversions`) only have `service_role` policies. The admin UI queries as `authenticated`, so RLS returns 0 rows — even though there are 38 prospects and 6 campaigns in the database.

## What's Broken

1. **RLS — no authenticated read policies** on all 3 postcard tables. Admin sees "0 prospects" despite 38 existing in the DB.
2. **Missing `audience_type` column** on `postcard_campaigns` — the UI displays it but the column doesn't exist in the schema.
3. **`generate-postcard-copy` ignores `audience_type`** — the edge function only accepts `county`, not the audience dropdown selection. All copy is hardcoded for "HVAC/boiler/plumbing/electrical" regardless of what's selected.

## Fix Plan

### 1. Database Migration
Add admin-read RLS policies to all three tables using `public.has_role()`:

```sql
-- Allow admins to read all postcard data
CREATE POLICY "Admins can read postcard_prospects"
  ON public.postcard_prospects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read postcard_campaigns"
  ON public.postcard_campaigns FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read postcard_conversions"
  ON public.postcard_conversions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add audience_type column to campaigns
ALTER TABLE public.postcard_campaigns ADD COLUMN audience_type TEXT;
```

### 2. Update `generate-postcard-copy` Edge Function
- Accept `audience_type` parameter from the request body
- Adjust the AI system prompt based on the audience (healthcare agency, trades agency, nursing home, contractor, supply house)
- Store `audience_type` on the inserted campaign row

### 3. Verify End-to-End
- Confirm prospects load in UI after migration
- Confirm campaigns display with audience badges
- Confirm generate copy stores audience_type

## Technical Details
- Uses existing `public.has_role()` security definer function (project standard)
- Only SELECT policies needed — writes happen via edge functions with `service_role`
- No frontend code changes needed — the UI already handles these fields correctly

