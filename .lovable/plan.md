

# Full Launch Audit — Build Fixes + Ad Strategy

## Part 1: Fix All Build Errors (7 Edge Functions)

| # | File | Error | Fix |
|---|------|-------|-----|
| 1 | `osha-compliance-sender/index.ts` | Duplicate `bcc` property (line 37) | Remove the second `bcc: ["matthewmichels@gmail.com"]` line, merge into the first one |
| 2 | `permit-monitor-sender/index.ts` | Duplicate `bcc` property (line 50) | Same fix — remove duplicate `bcc` line |
| 3 | `ops-autonomous/index.ts:106` | `.catch()` on non-promise Supabase builder | Wrap in `Promise.resolve(sb.from(...).upsert(...)).catch(() => {})` |
| 4 | `oracle-monitor/index.ts` | 8 type errors — `row.created_at` on `never`, function signature | Cast `sb` as `any` in `gatherDailyReport()` call, and cast `data` rows with `as any[]` on all dynamic table queries |
| 5 | `podcast-content-generator/index.ts` | `DOMParser` not available in Deno, `Element` type errors | Replace with `deno-dom` import (`import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts"`), cast items as `Element[]` |
| 6 | `process-email-queue/index.ts` | Type mismatch on `.insert()` | Cast insert payloads with `as any` on all `email_send_log` inserts |
| 7 | `deliver-domain-breach-report/index.ts` | The diff was applied but line 71 still destructures `order_id` — need to verify current state and apply auth + idempotency changes from the diff if not applied |

## Part 2: Fix Dead Lead Form

`AdminDeadLeads.tsx` line 196 inserts `contractor_id` into `dead_lead_contacts`. If the column doesn't exist, remove it from the insert payload (the `campaign_id` already links to the contractor via `dead_lead_campaigns`).

## Part 3: Ad Strategy for Cold-Sell Products

Here are the questions I didn't get to finish asking you — I'll re-ask them so you can answer:

**Which products get ads first?** From the 10 cold-sell products, the best candidates for paid ads (impulse buy, clear value, easy to explain in an ad):

1. **Am I Breached? ($4.99)** — Mass appeal, fear-driven impulse buy. "Enter your email, find out if hackers have your passwords." Facebook/Instagram ad.
2. **Website Speed Report ($9)** — Every business owner wonders. "Is your website costing you customers? Find out in 60 seconds." Google Search ad targeting "website speed test."
3. **Google Me ($14.99)** — Curiosity-driven. "What does Google say about YOUR business? Get the full picture for $15." Facebook ad.
4. **Reputation Snapshot ($29)** — Higher ticket but strong for contractors. "See what customers are REALLY saying about you across 10+ sites." Google Search ad.

**Recommended first two:** Am I Breached ($4.99) + Google Me ($14.99) — lowest friction, highest curiosity, broadest audience. $20-30/day Facebook budget each.

## Part 4: `create-keyword-gap-checkout` Build Error

This file looks syntactically correct. The build error log was truncated. I'll inspect more carefully during implementation — likely a Stripe API version or import issue. May just need `as any` on the Stripe client.

---

## Files Changed

1. `supabase/functions/osha-compliance-sender/index.ts` — remove duplicate bcc
2. `supabase/functions/permit-monitor-sender/index.ts` — remove duplicate bcc
3. `supabase/functions/ops-autonomous/index.ts` — fix .catch() pattern
4. `supabase/functions/oracle-monitor/index.ts` — cast dynamic queries as any
5. `supabase/functions/podcast-content-generator/index.ts` — switch to deno-dom
6. `supabase/functions/process-email-queue/index.ts` — cast insert payloads
7. `supabase/functions/deliver-domain-breach-report/index.ts` — verify diff applied
8. `supabase/functions/create-keyword-gap-checkout/index.ts` — inspect and fix
9. `src/components/admin/AdminDeadLeads.tsx` — remove contractor_id from contacts insert

No database migrations needed.

