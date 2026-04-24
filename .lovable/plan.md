

# Defense Protocol + E2E Audit & Patch — Combined Plan

## Part 1 — Lock the DWA Defensive Programming Protocol into the codebase

This isn't just a verbal promise. It becomes a file the agents and I read on every session.

**New file: `.lovable/memory/tech/dwa-defensive-programming-protocol.md`** (also referenced from `mem://index.md` Core)

```
---
name: DWA Defensive Programming Protocol
description: Hard rules for any code that touches money, leads, or external APIs
type: constraint
---

Assume the network will fail, the DB will lock, the user will double-click.

1. NO SWALLOWED ERRORS
   - Forbidden: catch(e){} | catch(e){return null} without logging
   - Required: console.error(`[fn-name] context`, e) + structured row in
     system_error_log (or function-specific log table) before any return.

2. NO BLIND FETCHES
   - Every fetch() to Twilio, Resend, Stripe, Sonar, Anthropic, Apollo, Lob,
     Browserless, Firecrawl, DataForSEO, Google APIs MUST:
       a. wrap in try/catch
       b. check `if (!res.ok) { const body = await res.text(); throw ... }`
       c. log the upstream status + body to system_error_log
       d. have a fallback (queue retry / skip / mark failed) — never silent.

3. CONCURRENCY FIRST
   - Any money/lead exchange (claim, purchase, charge, soft-lock) MUST use a
     SECURITY DEFINER Postgres RPC with SELECT ... FOR UPDATE or unique-index
     guard. Never do "check then write" from the edge function or frontend.
   - Stripe webhooks MUST be idempotent on (event.id) — store processed
     event ids in stripe_webhook_events.

4. NO FIRE-AND-FORGET DB CALLS
   - Every supabase.from(...).insert/update/upsert/delete MUST be awaited.
   - Every `.then()` without `.catch()` is a bug.
   - Background work uses EdgeRuntime.waitUntil(...) only — never naked
     promises.

5. WEBHOOK FAIL-FAST
   - stripe-webhook returns HTTP 500 on ANY inner failure so Stripe retries.
   - Never wrap the whole handler in a try/catch that returns 200.

6. INPUT VALIDATION
   - Every public edge function validates body with zod (or equivalent) and
     returns 400 on failure — no untyped destructure.
```

The file is saved to memory so it appears in the index permanently and every future Lovable session is bound by it.

---

## Part 2 — End-to-End Production Audit & Patch (5 products × 4 phases)

Same plan as before, executed under Part 1 rules.

**Products audited:** Apex Talent Signal · Contractor Leads · Dead Lead Reactivation · FieldDesk · TechAlert/HireAlert

**For each product, all 4 phases verified:**

| Phase | What I check |
|---|---|
| 1. Entry vectors | QR / SMS / email URLs hit production domain, params survive SPA, no auth-wall on claim links |
| 2. Conversion gateway | Stripe checkout function returns `{url}`, sets `metadata.type`, dynamic `success_url`, mobile 390px viewport has reachable CTA |
| 3. Webhook handshake | `stripe-webhook` branch exists per `metadata.type`, DB write awaited, returns 500 on failure, idempotent on `event.id` |
| 4. Post-purchase | Portal page refetches, welcome email/SMS fires, `notifyMatt()` hits +13138064952 |

## Known fragility being patched in this session

From CLAUDE.md "Known unfixed bugs":

| # | Bug | Patch |
|---|---|---|
| 1 | `chargeContractor()` in `handle-dead-lead-reply` — no `res.ok` check, silent $50 loss | Add `if (!res.ok)` + log + queue retry row |
| 2 | `dead-lead-drip` — missing `await` → duplicate SMS (TCPA risk) | Await all status updates; add unique index on (campaign_id, contact_id, step) |
| 3 | `create-marketplace-lead-checkout` — race on soft-lock | Replace inline check with new RPC `claim_lead_soft_lock(lead_id, buyer_email)` using `SELECT ... FOR UPDATE` |
| 4 | `stripe-webhook` outer catch returns 200 | Remove outer try/catch swallow; per-branch try/catch that re-throws → 500 |
| 5 | Stripe webhook idempotency | New table `stripe_webhook_events(event_id PK, processed_at)`; insert-or-skip at top of handler |
| 6 | `Marketplace.tsx` uses `window.prompt()` (iOS-blocked) | Replace with shadcn `<Dialog>` + email input |
| 7 | `marketplace_buyer_watches` RLS allows email spoofing | Tighten RLS to require signed buyer_session_token; add `buyer_session_tokens` table |
| 8 | `contractor-lead-notify` — fire-and-forget Resend | Await + check `res.ok` + log on failure |

## Files to be created

- `.lovable/memory/tech/dwa-defensive-programming-protocol.md`
- `supabase/migrations/<ts>_defense_protocol_hardening.sql`
  - `stripe_webhook_events` table (idempotency)
  - `system_error_log` table (centralized error sink) if not present
  - `claim_lead_soft_lock(lead_id, buyer_email)` RPC with row lock
  - Unique index `dead_lead_drip(campaign_id, contact_id, step)`
  - Tighten RLS on `marketplace_buyer_watches` (require token match)
  - `buyer_session_tokens` table
- `src/components/marketplace/BuyerEmailDialog.tsx` (replaces `window.prompt`)

## Files to be edited

- `mem://index.md` — add DWA Defensive Protocol to Core + Memories
- `supabase/functions/stripe-webhook/index.ts` — idempotency check at top, remove outer 200-swallow, per-branch fail-fast
- `supabase/functions/handle-dead-lead-reply/index.ts` — `chargeContractor` res.ok guard + retry row
- `supabase/functions/dead-lead-drip/index.ts` — await all writes, dedupe via unique index
- `supabase/functions/create-marketplace-lead-checkout/index.ts` — call new RPC
- `supabase/functions/contractor-lead-notify/index.ts` — await Resend, res.ok guard
- `supabase/functions/marketplace-watch-add/index.ts` + `marketplace-watched-leads/index.ts` — require buyer session token
- `src/pages/Marketplace.tsx` — replace `window.prompt()` with `BuyerEmailDialog`

## Verification (executed live in build mode)

For each of the 5 products I run:
1. `curl` the entry URL via deployed preview → 200 + correct route
2. `supabase--curl_edge_functions` to checkout fn with test body → expect `{url}`
3. Synthetic webhook event → confirm DB write + 500 on simulated failure + idempotency on duplicate event id
4. Confirm row in `system_comms_log` (welcome) + row in admin notification log

## Deliverable

Single Pass/Fail table (5 products × 4 phases = 20 cells), every Fail patched in the same ship, list of every file changed, every curl + status code.

## Honest scope

~3-4 hours. One ship. Defense Protocol becomes permanent law via `mem://`.

