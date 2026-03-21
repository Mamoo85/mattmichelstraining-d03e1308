

# Fix Unused Supabase Preconnect

## Problem
Lighthouse flags the Supabase `preconnect` as "unused" because the SDK's first fetch happens after FCP — the browser discards the preconnect by then, wasting a TLS handshake.

## Fix
Replace the Supabase `preconnect` with `dns-prefetch`. This:
- Eliminates the "unused preconnect" Lighthouse warning
- Still pre-resolves DNS so the eventual SDK connection is faster
- Avoids wasting a TLS handshake that expires before use

## Change

**`index.html` line 19:**
```html
<!-- Before -->
<link rel="preconnect" href="https://eauvubfpanpeuxsrqesu.supabase.co" crossorigin />

<!-- After -->
<link rel="dns-prefetch" href="https://eauvubfpanpeuxsrqesu.supabase.co" />
```

One line change. No functional or visual impact.

