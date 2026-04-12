

# Fix: Dead Lead Reactivation "Failed to send a request to the Edge Function"

## Root Cause

Two issues found:

### 1. Missing CORS headers (causes the browser error)
Both `contractor-prospector/index.ts` and `dead-lead-drip/index.ts` have **zero CORS headers**. When the admin dashboard calls `supabase.functions.invoke()`, the browser sends a preflight OPTIONS request. Without CORS headers in the response, the browser blocks the request entirely — producing the toast error you see.

- `contractor-prospector` — no OPTIONS handler, no CORS headers on any response (557 lines, no mention of "cors" or "OPTIONS")
- `dead-lead-drip` — has a bare-bones OPTIONS handler (line 15-17) that only returns `Access-Control-Allow-Origin: *` but is missing `Access-Control-Allow-Headers` (which blocks the `authorization` and `apikey` headers the Supabase client sends)

### 2. Missing `channel` column on `outreach_leads` (secondary — causes silent insert failures)
The prospector logs show repeated errors: `Could not find the 'channel' column of 'outreach_leads' in the schema cache`. Migration `20260330000007` adds this column, but it appears not applied to the live database. Every SMS-only lead insert fails silently.

## Fix Plan

### Fix 1: Add full CORS headers to `contractor-prospector/index.ts`
- Add standard `corsHeaders` object at top of file
- Add OPTIONS preflight handler returning 200 with CORS headers
- Add `...corsHeaders` to the success response (line 550) and error response (line 555)

### Fix 2: Fix CORS headers on `dead-lead-drip/index.ts`
- Replace bare `Access-Control-Allow-Origin` with full `corsHeaders` object
- Add `...corsHeaders` to the success response (line 166) and error response (line 171)

### Fix 3: Add `channel` column to `outreach_leads` via migration
- `ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'email';`
- This is idempotent — safe even if it was previously applied.

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/contractor-prospector/index.ts` | Add CORS headers + OPTIONS handler |
| `supabase/functions/dead-lead-drip/index.ts` | Fix incomplete CORS headers |
| New migration | Add `channel` column to `outreach_leads` |

### Deploy
Both edge functions redeployed + migration applied. The "Find Prospects Now" and "Run Drip Now" buttons will work immediately after.

