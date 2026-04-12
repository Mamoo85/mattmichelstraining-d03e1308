

# Fix: "meta is not defined" Fatal Webhook Error

## Root Cause

The `stripe-webhook/index.ts` file (5671 lines) has a scoping bug:

1. `meta` is defined on **line 449** inside `if (event.type === "checkout.session.completed") {`
2. That `if` block closes around **line 5507**
3. The "catch-all" code on **lines 5541-5625** references `meta`, `session`, `customerEmail`, and `email` — but these variables are **out of scope** because the checkout block already closed
4. The early-return guard on line 5536 correctly blocks non-checkout events, but for `checkout.session.completed` events that don't match any specific handler inside the block, execution falls through to line 5543 where `meta` doesn't exist → crash → SMS alert

## The Fix (one structural change)

Move the catch-all block and Revenue Suite block (lines 5541-5625) **back inside** the `checkout.session.completed` block — specifically before the closing `}` at line ~5507.

This means inserting them after line 5506 (the `new_hire_breach_check` return) and before the checkout block's closing brace, then removing the orphaned copies at lines 5541-5625.

The early-return guard on line 5536 stays as a safety net for any truly unhandled event types.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/stripe-webhook/index.ts` | Move catch-all + Revenue Suite blocks inside checkout scope |

## What This Fixes
- `invoice.finalized` and other non-checkout events already return 200 via the guard (line 5536) — no change needed there
- `checkout.session.completed` events that don't match any specific handler will now correctly reach the catch-all with `meta` in scope
- No more "meta is not defined" crashes or FATAL SMS alerts

