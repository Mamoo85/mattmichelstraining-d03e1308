

# Fix JWT Mismatch, Harden Auth Recovery, Fix Lazy Imports

## Problem Summary
1. `src/integrations/supabase/client.ts` falls back to old project `zmyczlfu...` when env vars are missing at build time, causing "unrecognized JWT kid" errors
2. Auth page needs stronger recovery when stale/mismatched JWTs are detected
3. `src/pages/Index.tsx` uses raw `React.lazy()` instead of the project's `lazyRetry()` pattern, causing "Failed to fetch dynamically imported module" crashes

## Plan

### 1. Lock build to correct backend via vite.config.ts
Add `define` block to force the correct Supabase URL and key as build-time constants, so even if the auto-generated client file has stale fallbacks, the env vars win:

```ts
define: {
  'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
    env.VITE_SUPABASE_URL || "https://eauvubfpanpeuxsrqesu.supabase.co"
  ),
  'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || "eyJhbGci..."
  ),
}
```

### 2. Harden auth recovery in Auth.tsx
- In the `clearStaleToken` effect, also catch `session_not_found` and `JWT expired` patterns
- After clearing a stale session, also clear the TanStack Query cache to prevent stale data from persisting
- In `finishAuthCallback`, if `getSession()` returns a session but `getUser()` fails with JWT errors, clear and retry the callback tokens instead of silently succeeding

### 3. Strengthen useAuth.tsx mismatch handling
- In the `safeClearSession` path and `getUser()` validation, also match `unrecognized JWT kid` in the error message list (it's currently missing — only `invalid JWT`, `invalid claim`, `JWT expired`, `token is unverifiable` are checked)

### 4. Extract lazyRetry to shared utility & fix Index.tsx
- Create `src/lib/lazyRetry.ts` exporting `retryLazyImport` and `lazyRetry` (move from App.tsx)
- Update `src/App.tsx` to import from `@/lib/lazyRetry`
- Update `src/pages/Index.tsx` to use `lazyRetry()` for all its lazy imports (`ChallengeTeaser`, `DoNotPressButton`, `FirstMonthPromo`, `AiGeneratorShowcase`, `ProveItShowcase`, `InstagramSocialBox`)

### Files Changed
- `vite.config.ts` — add `define` block
- `src/lib/lazyRetry.ts` — new file (extracted from App.tsx)
- `src/App.tsx` — import `lazyRetry` from shared utility
- `src/pages/Index.tsx` — switch to `lazyRetry` imports
- `src/pages/Auth.tsx` — broaden stale-token detection
- `src/hooks/useAuth.tsx` — add `unrecognized JWT kid` to error pattern list

