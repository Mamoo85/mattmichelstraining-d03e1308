# SYSTEM LAUNCH AUDIT — QA Readiness Report

## Detroit Web Agency: Top 4 Revenue Engines

---

## 1. CONTRACTOR LEADS (PPL / Dead Lead Reactivation)

**Readiness Score: 92% Ready**

**Critical Blockers (Red Flags):**

- None identified. Stripe webhook returns 500 on DB failure (Stripe retries). Lead lock mechanism is atomic. Checkout → webhook → DB insert → welcome email → SMS all traced and working.

**Minor Polish (Yellow Flags):**

- `contractor-aged-lead-downsell` cron uses hardcoded URL (`https://eauvubfpanpeuxsrqesu.supabase.co/...`) instead of vault pattern — will work but inconsistent with new cron standard.
- `contractor-fomo-mailer` and `contractor-lead-notify` crons use `email_queue_service_role_key` vault secret name — verify this secret name actually exists in vault (some crons use `service_role_key`).
- `chargeContractor()` in `handle-dead-lead-reply` doesn't check `res.ok` before parsing Stripe response (noted in CLAUDE.md as known issue — NOT YET FIXED).

**Missing Code:** None — all edge functions, tables, and pages exist.

**Next Action:** Fix `chargeContractor()` to check `res.ok` before JSON parse, and standardize cron vault secret names.

---

## 2. TECHALERT (Hiring Monitor)

**Readiness Score: 78% Ready** ← LOWEST SCORE

**Critical Blockers (Red Flags):**

1. **Welcome email unsubscribe link points to wrong domain.** Line 839 of `stripe-webhook/index.ts`: `mailto:matt@mattmichelstraining.com?subject=Unsubscribe%20TechAlert` — should be `matt@detroitwebagent.com`. This is a DWA product being sent from `sendM2Email()` (M2 Training branding) instead of DWA branding.
2. **Welcome email sent via `sendM2Email()` (M2 branding) instead of DWA branding.** Line 848: `await sendM2Email(email, ...)` — the welcome email uses M2 Training orange header, M2 footer, and `matt@mattmichelstraining.com` sender. TechAlert is a DWA product and should use `matt@detroitwebagent.com`.
3. **Scanner NOT running every 30 minutes as requested.** Cron `hire-alert-scanner-daily` is scheduled `0 11 * * *` (once daily at 11am). The deep enricher runs every 30 min (`15,45 * * * *`), but the scanner itself that discovers new candidates is still daily. Clients were promised 30-minute alert cycles. (Whatever the original promise was keep, once a day seems right) 
4. `**hire_alert_client_candidates` table may not exist.** Line 839 of scanner: `sb.from("hire_alert_client_candidates" as any).upsert(...)` — the `as any` cast suggests this table was never created via migration. If it doesn't exist, every client-candidate tracking insert silently fails.

**Minor Polish (Yellow Flags):**

- Welcome email says "AI availability score" (line 822) — should say "availability score" per branding rules (no "AI" jargon).
- Checkout origin defaults to `mattmichelstraining.com` (line 31 of `create-hire-alert-checkout`) — should default to `detroitwebagent.com` for a DWA product.
- `matt-boat.jpg` image in welcome email references `mattmichelstraining.com` domain — should use `detroitwebagent.com` for DWA consistency.

**Missing Code:**

- `hire_alert_client_candidates` table — no migration found creating it.
- No 30-minute cron for `hire-alert-scanner` — only daily exists.

**Next Action:**

1. Create migration for `hire_alert_client_candidates` table.
2. Switch welcome email from `sendM2Email()` to DWA-branded email with `matt@detroitwebagent.com`.
3. Fix unsubscribe link to `matt@detroitwebagent.com`.
4. Update `create-hire-alert-checkout` origin default to `detroitwebagent.com`.
5. Update scanner cron from daily to every 30 minutes.
6. Remove "AI" from welcome email copy.

---

## 3. FIELDDESK (Field Service CRM)

**Readiness Score: 90% Ready**

**Critical Blockers (Red Flags):**

- **Webhook handler returns 200 on DB failure.** Line 3088: `catch (e) { console.error(...); }` then `return 200`. If `field_crm_clients` upsert fails, Stripe won't retry. Client pays but never gets provisioned. No `notifyMatt()` fallback on failure.

**Minor Polish (Yellow Flags):**

- No welcome email sent directly from webhook — relies entirely on `auto-onboard` edge function. If auto-onboard fails, client gets no confirmation.
- No SMS confirmation to Matt on successful FieldDesk signup (other products send SMS + email).

**Missing Code:** None — all components exist.

**Next Action:** Add error handling with `notifyMatt()` fallback and return 500 on DB failure (matching contractor_lead_subscription pattern). Add direct welcome email as safety net.

---

## 4. MISSED CALL TEXT-BACK

**Readiness Score: 88% Ready**

**Critical Blockers (Red Flags):**

- **Webhook handler returns 200 on DB failure.** Line 3991: `catch (e) { console.error(...); }` then implicit 200. Same pattern as FieldDesk — if `missed_call_clients` upsert fails, Stripe won't retry.
- **Twilio number purchase uses raw Twilio API instead of shared `sendSMS` helper.** Lines 3893-3918 use direct `fetch()` with basic auth — this bypasses the Twilio connector gateway. Not a blocker for functionality, but inconsistent with architecture.

**Minor Polish (Yellow Flags):**

- FriendlyName for purchased Twilio numbers says "M2 -" (line 3909) — should say "DWA -" for Detroit Web Agency branding.
- `matt.jpg` image in welcome email references `detroitwebagent.com/images/dwa/matt.jpg` — confirm this file exists on the deployed domain.

**Missing Code:** None.

**Next Action:** Add `notifyMatt()` fallback + return 500 on DB failure in catch block. Fix FriendlyName prefix from "M2" to "DWA".

---

## Summary Ranking


| Service          | Score   | Biggest Risk                                              |
| ---------------- | ------- | --------------------------------------------------------- |
| Contractor Leads | 92%     | `chargeContractor()` no error check                       |
| FieldDesk        | 90%     | Webhook swallows DB failures                              |
| Missed Call      | 88%     | Webhook swallows DB failures                              |
| **TechAlert**    | **78%** | **Wrong branding, daily instead of 30min, missing table** |


**Lowest-scoring service: TechAlert at 78%.** It has the most critical blockers: wrong email sender/branding (M2 instead of DWA), unsubscribe link pointing to wrong domain, scanner still running daily instead of every 30 minutes as committed, and a missing `hire_alert_client_candidates` table causing silent tracking failures.

**Recommended fix order:**

1. TechAlert branding + missing table + cron frequency (brings it to ~95%)
2. FieldDesk + Missed Call webhook error handling (brings both to ~95%)
3. Contractor Leads `chargeContractor()` fix (brings to ~97%)

All fixes are code-only — no new features, no new pages. Estimated: 1 implementation pass.