# Checkout Test Harness & Verification Sprint

Goal: give Matt a complete, **safe** way to exercise every Stripe checkout path end-to-end with `4242` test cards, confirm the welcome/receipt email landed, and validate the success/receipt UI — without ever risking a live charge or needing to dig through Gmail.

Backend webhooks and `supabase/functions/` business logic stay locked. New work lives in **new** edge functions, **new** pages, and a **new** test-mode flag. The existing `stripe-webhook`, `get-receipt-status`, and product checkout functions are not modified.

---

## 1. Test-Mode Toggle (safe 4242 testing)

Add a project-wide "Stripe Test Mode" flag that the agency admin can flip from `/dwa-admin`.

- New table `checkout_test_mode` (single row, admin-only RW). Columns: `enabled boolean`, `updated_by uuid`, `updated_at`.
- New edge function `get-checkout-mode` (public, anon-readable) returns `{ test_mode: boolean }`.
- New shared helper `_shared/stripeKeys.ts` used by **new functions only** — reads `STRIPE_SECRET_KEY_TEST` when test mode is on, otherwise falls back to `STRIPE_SECRET_KEY`. Existing checkout functions stay untouched per the lock.
- New edge function `create-test-checkout-proxy`: accepts `{ product_slug, email }`, forwards to the underlying `create-<slug>-checkout` function but injects a header `x-stripe-mode: test` so a thin wrapper version can route to test keys. For products we want covered by the click-through script, we register them in a `TEST_MODE_PRODUCTS` map.
- Frontend: small `<TestModeBanner />` (red bar) renders globally when `test_mode = true`, plus an admin toggle card on `/dwa-admin`.
- Buy buttons (see §3) read the flag via `useCheckoutMode()` hook and route to the proxy when on.

User must add **`STRIPE_SECRET_KEY_TEST`** secret. Plan will request it via `add_secret` before deploying the proxy.

---

## 2. Receipt Verification Page (no email needed)

New route `/receipt/:sessionId` (also accessible as `/receipt?session_id=…`).

- Calls a new edge function `get-stripe-receipt` which:
  - Validates `cs_(test|live)_…` format
  - Authenticates the caller against `auth.jwt() ->> 'email'` OR matches the email Stripe captured (server-side check, not exposed to anon)
  - Pulls `session → payment_intent → latest_charge` and returns `{ status, amount, currency, receipt_url, hosted_invoice_url, customer_email, product_label, fulfilled_at }`
- UI shows: status pill (paid/pending/failed), amount, masked email, **"Open Stripe receipt"** button (`receipt_url`), **"Resend welcome email"** button (calls existing `resend-receipt`), and a "Check fulfillment" row that reuses `<ReceiptStatusBanner />`.
- A linkable QR is shown so Matt can scan from his phone during a test.

This satisfies "confirm success/receipt without opening email."

---

## 3. Unified `<BuyNowButton />` Component

A single component used by the top-5 DWA products and the Revenue Suite bundle.

```text
<BuyNowButton
  productSlug="hire-alert"
  price="$149/mo"
  requireAuth={false}
  prefill={{ email, businessName, phone, city }}
/>
```

Behavior:
1. Reads `useCheckoutMode()` → picks live vs test endpoint
2. If `requireAuth` and no session → opens an inline `<AuthGate />` modal (email magic-link) before continuing — no redirect loop
3. Validates required prefill fields (toast on miss)
4. POSTs to the correct `create-<slug>-checkout` function (mapping in `src/lib/checkoutRoutes.ts`)
5. Opens the returned `url` in same tab on mobile, new tab on desktop (popup-blocker safe per existing standard)
6. Logs the click attempt to `checkout_attempts` (new table) for the test report

Refactor targets (only the CTA — keep the rest of the page untouched):
- `BundleRevenueSuite.tsx`
- `HireAlert.tsx`
- `MortgageRadar.tsx`
- `DeadLeadIntake.tsx`
- `FieldServiceCRM.tsx` (or current FieldDesk landing — confirm during build)

---

## 4. Receipt-Email Delivery Log (catch-all confirmation)

We already route emails through Resend. Add a verifiable log so Matt can confirm delivery without opening Gmail.

- New table `receipt_email_log`: `id`, `session_id`, `template`, `to_email`, `status` (queued/sent/delivered/bounced), `provider_message_id`, `created_at`, `delivered_at`, `payload jsonb`.
- New edge function `log-receipt-email` is called by the *new* test-checkout proxy whenever it triggers a welcome/receipt email. (We don't modify `stripe-webhook`; instead the proxy mirrors the send into the log table when running in test mode.)
- Extend `resend-webhook` (it's allowed — it's a webhook handler we own outside the locked checkout flow) with one additional case: when the message tag matches `receipt|welcome`, upsert the matching `receipt_email_log` row to `delivered`/`bounced`/`opened`.
- New admin page `/dwa-admin/receipt-log` — a table of the last 100 receipts with filter by `session_id` or email, plus a "View receipt page" deep link to `/receipt/:sessionId`.

If Matt prefers a true catch-all inbox instead of a webhook log: optional follow-up — point a `*@test.detroitwebagent.com` MX at a Mailgun routing endpoint that forwards into `log-receipt-email`. Webhook log first; catch-all is a phase-2 nice-to-have.

---

## 5. Automated Click-Through Script

New file `scripts/checkout-smoke.ts` (Node, runs locally with `bun run scripts/checkout-smoke.ts`).

- Iterates a `PRODUCTS` array — top-5 DWA products + the bundle
- Uses Playwright (already in the project — see `playwright.config.ts` and `tests/e2e/`) with two profiles: **iPhone 13** and **Desktop Chrome**
- For each product:
  1. Visit landing page
  2. Fill the prefill form with synthetic data
  3. Click the unified `<BuyNowButton />`
  4. Wait for Stripe checkout, fill `4242 4242 4242 4242`, submit
  5. Land on success URL → assert `<ReceiptStatusBanner />` transitions `pending → paid → fulfilled`
  6. Hit `/receipt/:sessionId` → assert `receipt_url` button visible
  7. Poll `receipt_email_log` for matching row with `status = sent` (timeout 30s)
- Outputs a Markdown report `mnt/documents/checkout-smoke-report.md` — pass/fail per product per device
- Also added as a Playwright spec `tests/e2e/checkout-smoke.spec.ts` so it can run in CI

Script refuses to run unless `checkout_test_mode.enabled = true` (safety guard against live charges).

---

## File Manifest

**New tables / migrations**
- `checkout_test_mode` (singleton, admin RW)
- `receipt_email_log` (admin read, service-role write)
- `checkout_attempts` (admin read, anon insert via edge function only)

**New edge functions**
- `get-checkout-mode`
- `get-stripe-receipt`
- `create-test-checkout-proxy`
- `log-receipt-email`

**Edge functions edited**
- `resend-webhook` only — to upsert delivery status into `receipt_email_log`. (Not in the locked checkout path.)

**New frontend**
- `src/lib/checkoutRoutes.ts` — slug → endpoint map
- `src/hooks/useCheckoutMode.tsx`
- `src/components/checkout/BuyNowButton.tsx`
- `src/components/checkout/AuthGate.tsx`
- `src/components/checkout/TestModeBanner.tsx`
- `src/pages/ReceiptVerify.tsx` (route `/receipt/:sessionId`)
- `src/pages/dwa-admin/ReceiptEmailLog.tsx`
- `src/pages/dwa-admin/CheckoutTestModeCard.tsx` (mounted in existing admin)

**Frontend edited (CTA swap only)**
- `BundleRevenueSuite.tsx`, `HireAlert.tsx`, `MortgageRadar.tsx`, `DeadLeadIntake.tsx`, `FieldServiceCRM.tsx`
- `src/App.tsx` — register `/receipt/:sessionId` route + global `<TestModeBanner />`

**Tests / scripts**
- `scripts/checkout-smoke.ts`
- `tests/e2e/checkout-smoke.spec.ts`

---

## Constraints respected

- Locked `supabase/functions/` business logic untouched. `stripe-webhook`, `get-receipt-status`, `create-*-checkout` files unchanged. New work lives in **new** functions + a **new** proxy.
- Dark-mode enterprise aesthetic preserved.
- No "AI" word in user-facing copy — banners say "Test Mode", "Automated Routing", "Receipt Verification".
- Toast on every action; never silent.

---

## Required from you before I implement

1. **Approve the plan**.
2. After approval I will request the `STRIPE_SECRET_KEY_TEST` secret (Stripe dashboard → Developers → API keys → "Reveal test key").
3. Confirm whether the 5th unified product card is **FieldDesk/FieldServiceCRM** or another page — I'll default to FieldDesk if you don't say otherwise.

Approve to execute.