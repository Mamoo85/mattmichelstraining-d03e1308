# Checkout Hardening Plan

## Reality Check

- **177 checkout edge functions** and **158 product pages** — touching them all is not realistic in one pass.
- **Stripe live click-through testing is blocked** until you create a Stripe Sandbox (Accounts V2 doesn't allow testmode subscriptions in your account). I'll do everything that doesn't require live card flow now, and queue the rest for after Sandbox is set up.

## Scope Decision: "Top Products" = 9 Revenue-Critical Flows

Per `CLAUDE.md` "Golden Paths" and revenue tables, the top products are:

1. Bundle Revenue Suite ($299/mo)
2. FieldDesk ($199/mo)
3. TechAlert / HireAlert ($149/mo)
4. Contractor Leads PPL ($399/mo)
5. Mortgage Radar ($149/mo)
6. Missed-Call Catch ($99/mo)
7. Marketplace Lead ($39–59/lead)
8. Dead Lead Billing Setup ($50/reply)
9. Hire Alert One-Time ($49)

These are the 9 cards I'll harden + test. Other 149 pages keep working; they get the same UX pattern in a follow-up sweep when you ask for it.

## What I'll Build

### 1. Shared Checkout UX Component — `useCheckoutFlow` hook + `<CheckoutButton />`
One reusable hook + button that every product page can swap in. Replaces the ad-hoc `try/catch/setLoading` blocks (currently duplicated 158 times).

States:
- **idle** — normal CTA
- **submitting** — spinner + "Securing your checkout…"
- **redirecting** — "Sending you to Stripe…" (after URL received, before navigation)
- **error** — inline red banner with retry button + Matt's text link `(313) 992-1219` as fallback
- **success** (on `?status=success` return) — green confirmation + receipt status pill

Wire all 9 top product pages to use it. Keeps existing pages functional during rollout.

### 2. Receipt Status Verification

**New table**: `checkout_receipts` (already partially modeled via `processed_stripe_events` — this table tracks the user-facing side):

```text
checkout_receipts
  id (uuid, pk)
  stripe_session_id (text, unique)
  product_type (text)        -- matches metadata.type
  email (text)
  status (text)              -- 'pending' | 'paid' | 'fulfilled' | 'failed'
  fulfilled_at (timestamptz)
  webhook_event_id (text)    -- correlates to processed_stripe_events
  created_at, updated_at
```

**Edge function**: `get-receipt-status?session_id=cs_xxx` — public, returns `{ status, product_type, fulfilled_at }`.

**Webhook update**: `stripe-webhook` upserts `checkout_receipts` on `checkout.session.completed` and again when fulfillment finishes.

**On success page**: poll `get-receipt-status` every 2s for up to 30s. Show:
- "Payment received" (paid) → "Setting up your account…" (paid, not fulfilled) → "You're all set" (fulfilled).
- If still `paid` after 30s, show "Payment confirmed — Matt is finishing setup. You'll get an email within 5 minutes."

This is the explicit "receipt ready" state across all products.

### 3. Webhook Verification Function

**New edge function**: `verify-checkout-webhook` — admin-only utility you can call from `/admin` to:

- Take a `session_id`, look up the latest `processed_stripe_events` row, the matching `checkout_receipts` row, and the product-specific table (e.g., `field_crm_clients`, `hire_alert_clients`).
- Return JSON:
  ```text
  {
    session_id,
    webhook_received: true/false,
    webhook_event_id,
    receipt_status,
    fulfillment_record_exists: true/false,
    welcome_email_sent: true/false,
    issues: [...]
  }
  ```

I'll add an "Audit Checkout" panel in `AdminOpsCenter` that takes a session ID and shows this report. This is your verification step — proves the webhook fired and unlocked access.

### 4. QA Report (Markdown, written to `/mnt/documents/`)

After Sandbox is set up and click-through runs, I'll generate `/mnt/documents/checkout_qa_report.md`:

```text
| Product               | Mobile | Desktop | Failure step              |
| Bundle Revenue Suite  | ✅     | ✅      | —                          |
| FieldDesk             | ✅     | ❌      | Stripe redirect / popup    |
| ...                   |        |         |                            |
```

Until Sandbox is ready I'll deliver the *template* + the static-analysis pass (form validation, edge function 4xx coverage, missing fields).

### 5. End-to-End Test — Playwright

Project already has `playwright.config.ts`. I'll add `tests/e2e/checkout.spec.ts`:

- Loops over the 9 top products
- For each: navigates to the page (mobile viewport 390x844 + desktop 1280x720), fills the form with a test email, clicks CTA, asserts the response from the create-checkout function returns a `cs_test_` URL, then directly hits `/?status=success&session_id=cs_test_xxx` and asserts the success card + receipt-status polling appears.
- **Stops short of submitting card details** — that requires Stripe's hosted page in Sandbox mode. After Sandbox is enabled, I'll extend the test to drive Stripe's checkout iframe with `4242 4242 4242 4242`.

Test runs locally with `bunx playwright test tests/e2e/checkout.spec.ts --project=chromium --project=mobile-chrome`.

## What I'm NOT Doing in This Pass

- Touching the other 149 product pages (huge churn risk; they keep working with their current UX). I'll roll the new component out to them in batches when you ask.
- Live card-completion testing (blocked on Stripe Sandbox).
- Refactoring 177 edge functions (only `stripe-webhook` gets the receipt upsert).

## File Changes (estimated)

- **New**: `src/hooks/useCheckoutFlow.ts`, `src/components/checkout/CheckoutButton.tsx`, `src/components/checkout/ReceiptStatus.tsx`, `supabase/functions/get-receipt-status/index.ts`, `supabase/functions/verify-checkout-webhook/index.ts`, `tests/e2e/checkout.spec.ts`, migration for `checkout_receipts`
- **Edited**: 9 top product pages, `supabase/functions/stripe-webhook/index.ts`, `src/components/dwa-admin/AdminOpsCenter.tsx`
- **Generated**: `/mnt/documents/checkout_qa_report.md`

## Order of Execution

1. Migration + `get-receipt-status` + webhook upsert
2. `useCheckoutFlow` + `CheckoutButton` + `ReceiptStatus`
3. Wire the 9 top product pages
4. `verify-checkout-webhook` + admin panel
5. Playwright E2E (form-fill + URL assertion only, until Sandbox)
6. QA report (static-analysis version now; live click-through after Sandbox)

Approve and I start with step 1.
