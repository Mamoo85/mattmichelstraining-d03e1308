# Full Customer-Path Live Audit — Execution Plan

This is a read-only audit run end-to-end against the live DB + edge functions. Output: one markdown report at `/mnt/documents/audit-2026-05-07.md` with a PASS/FAIL table per layer, receipts inline (SQL output / curl bodies / log excerpts), and a prioritized P0/P1/P2 fix list at the end.

Before I burn ~80–120 tool calls executing this, I need you to confirm 3 scope decisions below — otherwise I'll guess wrong and we redo it.

---

## Methodology per layer

**L1 — Public links & SEO**
- Parse `public/sitemap.xml`, `public/robots.txt`, then `rg "https?://" supabase/functions/_shared/` and every `success_url|cancel_url` in `supabase/functions/create-*-checkout/`.
- Curl each URL with `-o /dev/null -w "%{http_code} %{url_effective}\n"`, group by host, flag non-200 + cross-domain.
- Diff `productCatalog.ts` keys vs `PRODUCT_PITCH` keys vs `OFFERS` keys in `_shared/offers.ts` vs sitemap entries. Curl `/start-trial?product=<key>` for each.

**L2 — Checkout → Webhook → Provisioning**
- `ls supabase/functions/create-*-checkout` → for each, grep `metadata.type` + `success_url`.
- Cross-reference against switch arms in `stripe-webhook/index.ts`. Build a matrix: checkout → type → handler → table upsert → welcome email → `markFulfilled`.
- SQL: `SELECT type, fulfillment_status, count(*) FROM stripe_webhook_events WHERE created_at > now()-interval '30 days' GROUP BY 1,2`.
- SQL: webhook events with no client row (LEFT JOIN per product).
- Invoke `e2e-link-auditor` if it exists; otherwise note as gap.

**L3 — RLS & GRANTs**
- Run the `information_schema.role_table_grants` query you provided for the full anon-write table list.
- For each, attempt `curl -X POST $SUPABASE_URL/rest/v1/<table>` with anon key + minimal body. Record 201 / 401 / 403 / 42501.
- Cross-check against `pg_policies` for `WITH CHECK` clauses.

**L4 — Auth & portal gates**
- Static analysis of `ProtectedRoute`, `SubscriptionGuard`, `BlurGate`, `PostCheckoutClaim`, all 23 `My*` pages — check redirect targets + loading-state guards (infinite-loop risk).
- Live: I cannot puppeteer all 4 auth states for 23 pages without browser sessions. **Decision needed (Q1).**

**L5 — Inbound webhooks**
- Static: confirm signature verification in `stripe-webhook`, `inbound-sms-relay`, Resend webhook handler.
- Live: query last 7 days of `missed_call_captures`, `voicemail_transcriptions`, `inbound_sms_log`, `email_send_log` for completeness. I will NOT place a real test call to Twilio (costs money + pages you). **Decision needed (Q2).**

**L6 — Outbound compliance**
- `rg` every `sendSMS|sendEmail|sendFax|sendPostcard` callsite, confirm each is preceded by blocklist + suppression + quiet-hours + frequency-cap check.
- SQL: `SELECT recipient, count(*) FROM email_send_log WHERE created_at > now()-interval '7 days' GROUP BY 1 HAVING count(*) > 5` — surfaces the 6–8 emails/recipient bug.
- Parse cold-email template CTAs, curl each.

**L7 — Cron**
- SQL: `cron.job` + `cron.job_run_details` last 7 days, success/fail counts per job.
- `rg "name = 'SUPABASE_URL'|name = 'SUPABASE_SERVICE_ROLE_KEY'|app.supabase_url" supabase/migrations/` to find any unfixed broken patterns.
- Cross-check every cron-invoked function has `verify_jwt = false` in `config.toml`.

**L8 — Silent failures**
- SQL: `error_logs` last 7d grouped by source/severity/function_name.
- `supabase--analytics_query` for `function_edge_logs` 5xx by function last 7d.
- Run `supabase--linter`.
- SQL: `SELECT * FROM dlq WHERE resolved_at IS NULL` (if table exists).

---

## Decisions I need from you

**Q1 — Live portal auth testing**
For 23 `My*` pages × 4 auth states = 92 page loads. Options:
- **(a) Static-only** for L4: I read the gate components and trace logic, no live page loads. Fast, ~10 min, ~60% confidence.
- **(b) Browser tool** spot-check 5 highest-traffic portals × 4 states = 20 loads. ~25 min, ~85% confidence. Requires you to log in once in the preview.
- **(c) Full sweep** all 23 × 4. ~60 min, requires you to create test accounts at each tier (free, trialing, subscribed, admin).

**Q2 — Live Twilio inbound test**
Placing a real call to (313) 992-1219 will trigger missed-call SMS to you AND charge ~$0.05. Options:
- **(a) Skip live call**, audit DB rows from real customer calls in last 7d.
- **(b) Place one test call** — you'll get a "test call from audit" SMS.

**Q3 — Anon INSERT probes (L3)**
To prove RLS works, I'll POST a row like `{event_type:'audit_probe', ...}` to each anon-write table. These leave ~10 test rows. Options:
- **(a) Probe + auto-cleanup** via a single DELETE at end (requires migration tool, technically a state change but trivial).
- **(b) Probe + leave rows** — you delete later.
- **(c) Skip probes**, rely on `pg_policies` static check only (~70% confidence — won't catch the GRANT-without-policy class of bug, which is exactly what burned us with `trial_funnel_events`).

**My recommendation: Q1=b, Q2=a, Q3=a.** Highest confidence per minute spent.

---

## Deliverable

`/mnt/documents/audit-2026-05-07.md` with:
- 8 PASS/FAIL tables (one per layer), receipts column with SQL/curl/log snippet
- Prioritized fix list: P0 (revenue-blocking / data leak / TCPA), P1 (UX broken), P2 (polish)
- Final question to you: "Which P0s do I ship in build mode?"

Estimated: ~90 tool calls, 30–45 min wall time.

Reply with answers to Q1/Q2/Q3 (or just "go with your recs") and I'll execute.