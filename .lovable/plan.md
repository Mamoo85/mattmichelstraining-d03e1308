## Reality check first

I will not claim "0% chance anything goes wrong." Across 311 pages, 598 edge functions, and ~20 paid products, residual risk always exists (Stripe edge cases, Twilio carrier filtering, third‑party API outages, race conditions under load, browser quirks). What's true today: the last audit's P0/P1 items are fixed, the build is green, and the Mortgage Radar end‑to‑end flow now enforces TCPA + age‑gate + manual‑only outreach. Anything stronger than that is marketing, not engineering.

This plan tackles the three concrete asks.

---

## 1. Dashboard performance optimization

Heaviest components today (confirmed): `ProgressCharts` (loads all `progress_logs` for a user, renders TronChart + VolumeChart + StreakHeatmap + BodyProgressMap simultaneously), `LogHistory` (full table render), `DashboardHome` (eager subcomponents), Recharts bundle.

Changes:
- **Code-split charts**: convert `TronChart`, `VolumeChart`, `RecoveryChart`, `BodyProgressMap`, `StreakHeatmap` to `lazyRetry()` imports rendered inside `Suspense`. Recharts is ~95KB gz — only load when the user is on the Progress tab.
- **Memoize chart data**: wrap `data`, `logs`, `allLogs` derivations in `useMemo`; wrap chart components in `React.memo` with shallow prop equality. Today every keystroke in `LogForm` re-renders all charts.
- **Paginate `LogHistory`**: render first 25 rows + "Show more" instead of full list. Add `content-visibility: auto` on row containers for off-screen rows.
- **Server-side cap**: add `.limit(500)` on the all-lifts `progress_logs` query and a `.gte('logged_at', <90d ago>)` window on the per-lift query. Heatmap already only needs ~365 days.
- **Defer non-critical dashboard widgets**: `CommunityActivityFeed`, `SharedWorkoutFeed`, `DashboardChallengePreview` already lazy — verify Suspense fallbacks are `null` (they are) and move them below an `IntersectionObserver` so they only mount when scrolled near.
- **Recharts → lighter primitives where possible**: `StatsRow` and `StreakHeatmap` don't need Recharts; confirm and strip if so.

No visual changes. Target: TTI on `/zone` and `/dashboard` cut by ~40% on a throttled mid-tier Android profile.

## 2. Vitest + Playwright smoke run

Vitest:
- Add 3 new unit/integration specs covering the most critical pure logic that has no coverage: `src/lib/marketplacePricing.ts`, `src/lib/validateCommandInputs.ts` (already has one, expand edge cases), and a render smoke for `DashboardHome` with mocked `useAuth`.
- Run `npx vitest run` and report pass/fail counts.

Playwright (extends existing `tests/e2e/`):
- `tests/e2e/auth-smoke.spec.ts` — load `/auth`, assert email + password fields render, assert Google button visible, assert no console errors.
- `tests/e2e/dashboard-smoke.spec.ts` — navigate `/dashboard` unauthenticated, assert redirect to `/auth`; navigate `/` and `/shop`, assert 200 + no `Error:` in console.
- `tests/e2e/checkout-smoke.spec.ts` — load `/mortgage-radar`, assert ROI calculator + territory picker + compliance gate render, assert "Subscribe" button is disabled until DOB + 3 consents are checked (this is the new TCPA gate from last pass).
- Run `npx playwright test` headless against the preview URL.

Output: a checklist showing which flows pass/fail with screenshots on failure. Honest: Playwright in this sandbox can't complete real Stripe checkout — it stops at the redirect to `checkout.stripe.com`. That is the correct boundary for a smoke test.

## 3. Supabase connectivity check

New edge function `health-check-supabase`:
- Pings `auth.getSession()` (auth API reachable)
- Performs a SELECT on `profiles` (RLS read works under service role + under anon key)
- Performs an INSERT + DELETE on a dedicated `health_check_pings` table (write path works, RLS scoped to service role only)
- Returns `{ auth: ok|fail, db_read: ok|fail, db_write: ok|fail, latency_ms, timestamp }`

Frontend additions:
- New page `/admin/health` (admin-gated) showing live status + last 24h history.
- Cron entry: run every 5 min, alert Matt via `notifyMatt()` if any check fails 2 consecutive runs.
- Migration: `health_check_pings` table with `created_at`, `latency_ms`, RLS service-role only.

This gives you a real "is staging up" signal instead of guessing from user complaints.

---

## Files

**New**
- `tests/e2e/auth-smoke.spec.ts`, `tests/e2e/dashboard-smoke.spec.ts`, `tests/e2e/checkout-smoke.spec.ts`
- `src/components/dashboard/__tests__/DashboardHome.test.tsx`
- `src/lib/__tests__/marketplacePricing.test.ts`
- `supabase/functions/health-check-supabase/index.ts`
- `src/pages/AdminHealth.tsx`
- `supabase/migrations/<ts>_health_check_pings.sql`

**Modified**
- `src/components/features/ProgressCharts.tsx` (lazy + memo + query limits)
- `src/components/progress/LogHistory.tsx` (pagination)
- `src/components/dashboard/DashboardHome.tsx` (intersection-observer mounts)
- `supabase/config.toml` (register new function)
- `src/App.tsx` (admin route)

## What this plan does NOT do

- Does not load-test edge functions (would need k6 / artillery, separate effort).
- Does not catch Stripe webhook race conditions under high concurrency — needs production observation.
- Does not eliminate third-party outage risk (Twilio, Resend, Stripe, Anthropic).
- Does not rewrite Recharts. We keep it but defer it.

After approval I'll execute, run the test suite, and give you the actual pass/fail numbers — not a "looks good."