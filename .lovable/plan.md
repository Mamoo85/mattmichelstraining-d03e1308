

# Fix: Edge Function Build Error — Missing `nodeModulesDir` Config

## Problem
The `welcome.tsx` transactional email template imports `npm:@react-email/components@0.0.22`, but the Deno runtime can't resolve it because the `deno.json` files for functions that use this shared template are missing `"nodeModulesDir": "auto"`.

## Fix
Add `"nodeModulesDir": "auto"` to the `deno.json` files for all three edge functions that import from the shared transactional email templates:

1. `supabase/functions/send-transactional-email/deno.json`
2. `supabase/functions/preview-transactional-email/deno.json`
3. `supabase/functions/auth-email-hook/deno.json`

Each file gets the same one-line addition:
```json
{
  "nodeModulesDir": "auto",
  "compilerOptions": { ... }
}
```

That's it — no other changes needed.

