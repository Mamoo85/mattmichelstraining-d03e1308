

## Problem Analysis

The "CONNECTION INTERRUPTED" screen your clients are seeing is **not** an actual network issue. It's your app's `ErrorBoundary` component catching any JavaScript error and displaying a misleading message. When someone uses a privacy browser like Freespoke (which blocks trackers and third-party requests), certain JS modules or API calls may fail, triggering the ErrorBoundary with this confusing full-screen error.

The current ErrorBoundary has three problems:
1. It shows "Connection interrupted" for ALL errors, not just network/chunk failures
2. It doesn't log what actually went wrong, making debugging impossible
3. It doesn't auto-retry chunk loading failures (which are often transient)

Additionally, lazy-loaded chunks can fail on first load after a deployment or on slow connections, and there's no retry mechanism.

## Plan

### 1. Add auto-retry for lazy chunk imports

Wrap all `lazy()` calls in `App.tsx` with a retry helper that attempts to reload a failed chunk up to 3 times before giving up. This fixes the most common cause of this error (stale chunks after deployment).

### 2. Improve ErrorBoundary with better diagnostics and messaging

- Log the actual error to the console so it's visible in diagnostics
- Differentiate between chunk errors, Supabase/network errors, and unknown JS errors
- Show a more helpful message (not