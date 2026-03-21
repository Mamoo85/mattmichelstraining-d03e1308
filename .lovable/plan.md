

# Apple Auth Resilience & Error Tracing

## Changes — `src/pages/Auth.tsx`

### 1. Add `appleError` state
Add a dedicated `const [appleError, setAppleError] = useState(false);` to track whether Apple sign-in specifically failed (distinct from the general `error` state).

### 2. Enhanced `handleAppleSignIn` error handling
- Extract `error.message`, `error.status`, and `error.code` from the result for detailed console logging
- Log structured diagnostic info: `[APPLE-AUTH] status: X, code: Y, message: Z`
- Display the specific error message to the user (not a generic fallback)
- Set `appleError` to `true` on failure, `false` on retry start

### 3. "Hide My Email" fallback note
After the Apple Sign-In button, conditionally render a small hint when `appleError` is `true`:
> "Note: If you selected 'Hide My Email' and cannot log in, please use the Email Link option below."

### 4. Safari window handling
The `lovable.auth.signInWithOAuth` wrapper doesn't accept `skipBrowserRedirect` — it's managed by `@lovable.dev/cloud-auth-js`. However, we can pass `skipBrowserRedirect: "false"` via `extraParams` to ensure it reaches the underlying provider config. This will be added to the OAuth call options.

### Technical detail

All changes are confined to `src/pages/Auth.tsx`. The `src/integrations/lovable/index.ts` file is auto-generated and will not be modified.

