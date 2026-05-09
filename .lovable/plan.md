# Pre-Launch Audit Plan (Live by Monday)

Goal: Produce a prioritized, fixable audit report before code changes. This plan defines the audit scope, methodology, and deliverable. After approval, I'll execute the audit and return a single report with Critical/High/Medium/Low issues + ready-to-apply fixes.

## Scope (10 categories)

1. **Runtime & Silent Errors**
   - `rg` scan for swallowed errors (`catch {}`, `.catch(() => {})`), unawaited promises, `// @ts-ignore`, `as any` near network/DB calls
   - Pull live `code--read_runtime_errors` + `code--read_console_logs`
   - Check Supabase edge function logs for last 24h FATAL/ERROR rows
   - Verify DWA Defensive Programming Protocol (memory rule) is honored in recently-touched edge functions

2. **Links & Navigation**
   - Crawl `src/pages/`, `src/App.tsx` routes; cross-reference every `<Link to=>`, `<a href=>`, button `navigate()` against route table
   - Flag 404s, dead `mailto:`/`tel:` (especially empty `tel:` — there's an existing test for this)
   - Spot-check footer, nav, product CTAs in preview via browser tools

3. **Stripe Integration (CRITICAL for Monday)**
   - Audit every `create-*-checkout` edge function: inline `price_data`, `metadata.type` set, `success_url`/`cancel_url` correct, idempotency
   - `stripe-webhook/index.ts`: `constructEventAsync` (not sync), every `metadata.type` has a handler, every handler calls `markFulfilled`, fail-fast on errors (per memory rule)
   - Verify `STRIPE_WEBHOOK_SECRET` is live-mode (not test) and webhook endpoint registered in Stripe dashboard
   - End-to-end simulate via `supabase--test_edge_functions` for at least 3 flagship products (TechAlert, Mortgage Radar, Trade Radar)
   - Confirm receipt emails wired (`dwaEmail`/`m2Email`), `PostCheckoutClaim` flow, magic-link delivery

4. **Edge Functions & APIs**
   - CORS headers present on all public endpoints
   - `verify_jwt = false` only where intentional (checkout/webhook); flag any leaks
   - Input validation (Zod or equivalent) on bodies
   - Run `supabase--linter` + check function logs

5. **Cron Jobs**
   - Query `cron.job` + `cron.job_run_details` for last 25h: list any job with no successful run
   - Verify all use the correct vault key pattern (`SUPABASE_SERVICE_ROLE_KEY_VAULT`) — historical bug per CLAUDE.md
   - Confirm Phase 45 cron-fix migration was applied

6. **Database & RLS**
   - `supabase--linter` for missing RLS, overpermissive policies
   - Check `has_role()` usage (memory rule) vs direct `auth.jwt()` checks
   - Spot-check newest tables from recent migrations

7. **Auth**
   - `ProtectedRoute`/`SubscriptionGuard`/`AgencyAdminRoute` cover all sensitive routes
   - Stale-JWT handling in `useAuth` (already implemented — verify still wired)
   - Password reset, Google OAuth flow

8. **Performance & UX**
   - Vite `manualChunks` review, lazy-loading via `lazyRetry` on every page
   - Loading states + error boundaries on top 10 routes
   - Mobile viewport check on hero pages via browser tools

9. **Security**
   - `rg` for hardcoded secrets, `dangerouslySetInnerHTML`, exposed service-role keys client-side
   - Run `security--run_security_scan`
   - Stripe webhook signature verification present

10. **Monitoring & Rollback**
    - Confirm `error_logs` table writes from edge functions (feeds fixer watchdog)
    - PostHog init verified
    - Document rollback (revert + redeploy)

## Methodology

- **Read-only.** No code changes during audit.
- Use parallel `code--exec` (`rg`), `supabase--read_query`, `supabase--linter`, `supabase--edge_function_logs`, browser tools.
- Light browser smoke test on preview: home → pricing → checkout CTA for one product (no real card).

## Deliverable

A single audit report with:
- **Critical** (launch blockers) — exact file:line + ready-to-paste fix
- **High** (fix before Monday)
- **Medium** (fix this week)
- **Low** (post-launch)
- Manual QA checklist
- All-Clear summary or Re-Audit plan

## Out of Scope

- Building new features
- Migrating providers
- Load/penetration testing (recommend external if needed)

## Time Estimate

~15–25 tool calls, single response. After you approve, I'll run the audit and deliver the report. I will NOT apply fixes until you approve them individually (or say "fix all Critical").

## Clarifying Questions (optional — I can proceed without)

1. Are you in **Stripe live mode** already, or still test? (Affects which `STRIPE_SECRET_KEY` we audit.)
2. Any specific product flow you want simulated end-to-end first? (Default: TechAlert + Mortgage Radar + one Trade Radar vertical.)
3. Should I include the `pat.detroitwebagent.com` sandbox in scope, or only main DWA + M2 domains?