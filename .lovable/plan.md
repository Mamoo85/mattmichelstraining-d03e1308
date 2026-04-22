

## Fix: "Dossier failed: Failed to send a request to the Edge Function"

### Root cause

The green **Dossier** button on the Growth Signals admin card calls `supabase.functions.invoke("generate-signal-dossier", …)` (in `src/components/admin/AdminGrowthSignals.tsx`, line 63).

The function source exists at `supabase/functions/generate-signal-dossier/index.ts`, but it has **never been deployed** because it was never registered in `supabase/config.toml`. There are zero logs for the function, and supabase-js returns the generic `"Failed to send a request to the Edge Function"` message when the endpoint 404s.

### The fix (one tiny change)

Add a config block for `generate-signal-dossier` to `supabase/config.toml` so Lovable deploys it on next push:

```toml
[functions.generate-signal-dossier]
verify_jwt = false
```

That's it — the function code itself is correct (proper CORS, valid signal lookup, AI blurb fallback, printable HTML). Once registered in config.toml, Lovable's auto-deploy picks it up and the button will:

1. Invoke the function with the `signal_id`
2. Open a new window with the printable 1-page intelligence dossier
3. Auto-trigger the print dialog after 500ms
4. Show "Dossier ready for {company}" toast

### Verification after deploy

- Click **Dossier** on any Growth Signals card → printable HTML opens in a new tab
- Check `supabase--edge_function_logs` for `generate-signal-dossier` to confirm it's now receiving requests
- If the function still 500s, it'll be a real downstream issue (DB row missing or AI gateway timeout), not the routing bug we're fixing here

