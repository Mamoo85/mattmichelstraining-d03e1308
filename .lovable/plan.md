# Receipt Banner Hardening + UX + Tests

Four-part sprint covering security, UX, fulfillment recovery, and test coverage for the Stripe success-page receipt flow. No changes to webhook fulfillment logic — strictly receipt **read path** + UI.

---

## 1. Lock down `get-receipt-status` (security)

**Problem:** `checkout_receipts` currently has `public_read_checkout_receipts USING (true)` for `anon, authenticated`. Anyone can scrape session IDs and read email + product_type for every customer. The edge function uses the service role and returns whatever is asked for.

**Fix:**
- **Migration**: drop the public-read policy. Replace with two narrower policies:
  - `select_own_receipt_by_email` for `authenticated` — `USING (email = auth.jwt() ->> 'email')`
  - `service_role_all_checkout_receipts` stays.
- **Edge function `get-receipt-status`**:
  - Switch to **POST** with JSON body `{ session_id }` (the hook already invokes via `supabase.functions.invoke` with body — no caller change).
  - Validate `session_id` matches `/^cs_(test|live)_[A-Za-z0-9]+$/`.
  - Require `Authorization` header. Resolve the user with the anon client + bearer token.
    - If **authenticated**: load the receipt with the service-role client, then return data **only if** `receipt.email === user.email` (or `receipt.metadata.user_id === user.id`). Otherwise return `{ status: "pending" }` (don't leak existence).
    - If **anonymous**: return a minimal payload — `status` only (`pending | paid | fulfilled | failed`), no email, no product_type, no fulfilled_at. This preserves the guest-checkout success page UX without leaking PII.
  - Add a simple per-IP rate limit (in-memory token bucket, 30 req/min) to blunt scraping.

**Why this is safe for guest checkouts:** the success page already polls — anonymous callers still get the live status string they need to flip the banner; they just don't get email/product details back.

---

## 2. Timeout UX in `ReceiptStatusBanner`

When the 60s poll window elapses without `fulfilled` or `failed`:

- Banner switches to a new **"Taking longer than usual"** amber state with three actions:
  1. **Retry** button — resets the hook (new poll window, fresh 60s).
  2. **Email support** — `mailto:matt@detroitwebagent.com?subject=Receipt%20pending%20{session_id}` prefilled with the session id.
  3. **Text Matt** — `sms:+13139921219?body=Receipt pending for session {session_id}`.
- Copy: "Stripe confirmed your payment but our system hasn't finished provisioning. Your card is safe — we'll fix it personally."

**Hook changes (`useReceiptStatus`)**:
- Expose `timedOut: boolean` and `retry: () => void`.
- `retry()` resets `startedAt`, clears timer, restarts polling.
- Cap at 3 manual retries, then force the support state.

---

## 3. "Check your email" + resend-receipt section

New component `src/components/checkout/CheckEmailCard.tsx`, rendered on success pages **whenever** banner status is `paid`, `fulfilled`, or `pending` (not on `failed` or hard-error states).

Contents:
- Headline: "Check your email for the receipt"
- Body: lists the email Stripe sent it to (pulled from receipt response when authenticated; otherwise generic copy).
- Primary button: **Resend receipt** → calls new edge function `resend-receipt`.
- Secondary link: "Wrong email? Text Matt at (313) 992-1219."

**New edge function `supabase/functions/resend-receipt/index.ts`**:
- POST `{ session_id }`, validated.
- Looks up `checkout_receipts` (service-role), enforces same auth check as `get-receipt-status` (owner or anon-with-cooldown).
- Rate-limit: max 1 resend per session per 60s (tracked in `checkout_receipts.metadata.last_resend_at`).
- Pulls Stripe `receipt_url` from the PaymentIntent; sends via Resend using existing `dwaEmail()` helper for DWA products, `m2Email()` otherwise (route by `product_type`).
- Returns `{ ok: true, sent_to: "<email>" }` (mask domain for anon callers).

Mounted in: `BundleRevenueSuite.tsx`, `DeadLeadIntake.tsx`, `HireAlert.tsx`, `MortgageRadar.tsx` (the same 4 pages that currently use `ReceiptStatusBanner`).

---

## 4. Playwright mobile tests with mocked polling

Extend `tests/e2e/checkout.spec.ts` with a new `describe("Receipt banner state machine — mobile")` block using `devices["iPhone 13"]`.

For each transition, intercept the edge function via `page.route("**/functions/v1/get-receipt-status", ...)`:

```text
test 1 — pending → paid → fulfilled
  call 1: { status: "pending" }    → assert [data-testid=receipt-banner-pending] visible
  call 2: { status: "paid" }       → assert pending banner shows "provisioning" copy
  call 3: { status: "fulfilled", fulfilled_at: <iso> }
                                    → assert [data-testid=receipt-banner-fulfilled]

test 2 — pending → failed
  call 1-2: pending; call 3: { status: "failed" }
                                    → assert [data-testid=receipt-banner-failed]

test 3 — timeout → support actions
  always return { status: "pending" }; advance time past 60s
                                    → assert "Taking longer than usual" + Retry + mailto

test 4 — CheckEmailCard resend
  fulfilled state; click Resend; assert toast success and POST to /resend-receipt fires
```

Run on `BundleRevenueSuite` (`/bundle-revenue-suite?status=success&session_id=cs_test_synthetic`) since it has the cleanest banner mount.

---

## Technical Details

**Files created**
- `supabase/migrations/<ts>_lock_checkout_receipts_rls.sql`
- `supabase/functions/resend-receipt/index.ts`
- `src/components/checkout/CheckEmailCard.tsx`
- `tests/e2e/receipt-banner.spec.ts` (separate file — the existing `checkout.spec.ts` is product-matrix focused)

**Files edited**
- `supabase/functions/get-receipt-status/index.ts` — auth + scoping + rate limit
- `src/hooks/useReceiptStatus.tsx` — `timedOut`, `retry`, retry counter
- `src/components/checkout/ReceiptStatusBanner.tsx` — timeout state with action buttons
- `src/pages/BundleRevenueSuite.tsx`, `DeadLeadIntake.tsx`, `HireAlert.tsx`, `MortgageRadar.tsx` — mount `<CheckEmailCard />` next to banner

**Constraints honored**
- No changes to `stripe-webhook` or any fulfillment edge function.
- No DB schema changes besides RLS policy swap (no new columns; `metadata.last_resend_at` is JSONB).
- Continues to use shared `@/lib/toast` helpers and `<ActionButton />` for the resend button.
- No "AI" terminology in any new copy.

**Approve to execute.**