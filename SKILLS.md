# DWA Skills — SOPs & Runbooks

Reusable playbooks for every repeatable situation. When something happens, find it here, follow the steps exactly. No improvising.

---

## SOP 1 — Cold Email Reply Received

**Trigger:** A prospect replies to any cold email (web design, TechAlert, Trade Radar, Missed-Call, etc.)

**Steps:**
1. Read the reply tone: positive / question / objection / unsubscribe
2. If **unsubscribe/STOP**: do NOT reply. Add to suppression list immediately. Done.
3. If **positive or question**: reply within 2 hours. Use their name. One sentence acknowledging what they said, then move to the next step (book a call or send the demo link).
4. If **objection** ("too expensive", "not the right time", "already have someone"): acknowledge it, give the one-liner reframe (see below), offer a no-obligation demo call. Don't push harder.
5. Log reply in `outreach_leads` → update `drip_campaign_status.current_stage` to `"2_Reply_Received"` and `email_opened: true`.
6. Stop the drip sequence for that contact immediately (don't let D4/D8 go out to someone who already replied).

**Objection Reframes:**
- "Too expensive" → "The site is $1,499 — that's a one-time fee. The texting automations alone recover that in two months of collected reviews."
- "Already have a website" → "I'd love to take a look. Most sites I see aren't set up to rank locally or capture leads after hours. Takes 5 minutes to show you what I mean."
- "Not the right time" → "Totally fine. I'll check back in 60 days. Mind if I send you one thing in the meantime?" (send the demo link)

---

## SOP 2 — New Trial Signup (Any Product)

**Trigger:** Stripe webhook fires `subscription.status = "trialing"` → row written to `trial_signups`

**Steps:**
1. `trial-drip-runner` automatically handles Day 2 / Day 5 / Day 6 touches — verify it's running.
2. Day 1 (same day): Matt gets an SMS alert with the client name, product, and email.
3. Within 24 hours: manually send a welcome text from (313) 992-1219 — "Hey [name], Matt from Detroit Web Agency. You're all set on [product]. Text me anytime with questions."
4. Check `trial_signups.first_lead_delivered_at` — if still NULL after 48 hours, SLA is amber. Investigate the scanner for their vertical.
5. Day 7 (trial end): if `trial_signups.status` is still `"active"` (not `"converted"`), send the conversion pitch manually if the drip didn't convert them.

**SLA rules (auto-managed by trial-drip-runner):**
- Green: first lead delivered within 48 hours
- Amber: no lead by Day 2 → auto-extend trial
- Red: no lead by Day 4 → auto-extend + Matt gets SMS alert

---

## SOP 3 — New Web Design Client Onboarding

**Trigger:** Stripe payment for a web design package ($499 / $799 / $1,499)

**Steps:**
1. Reply to client within 1 hour: "Got it — let's get started. I'll send you a quick intake form."
2. Send intake questions (text or email):
   - Current website URL (if any)
   - 3 services they most want to rank for
   - Their top 2 competitors
   - Preferred colors / any branding
   - Google Business Profile email address
3. Build the site in Lovable or existing stack. Target: live within 5 business days.
4. Before going live, confirm these are wired:
   - [ ] Review Text automation connected to their phone number
   - [ ] Pay-Me Text set up (Stripe or payment processor link)
   - [ ] Appointment Reminder Texts configured
   - [ ] SiteRadar script installed on their domain
5. Go-live SMS to client: "Your site is live at [URL]. I've also activated your review texts, payment texts, and reminder texts. You'll see your first visitor report within 24 hours."
6. Set a 30-day check-in reminder to upsell SiteRadar dashboard access or a Radar product.

---

## SOP 4 — Scanner Silent / No Leads Delivering

**Trigger:** Matt notices a product has delivered zero leads for 24+ hours, or a client texts asking "where are my leads?"

**Diagnosis steps (run in order):**
1. Check `agent_heartbeats` table — find the scanner's last beat. If > 2 hours ago, it crashed.
2. Check `error_logs` — filter by function name, look for the last error.
3. Check `cold_email_ramp_state` — confirm marketing kill switch is OFF.
4. Curl the scanner manually:
   ```
   curl -X POST https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/[scanner-name] \
     -H "Authorization: Bearer [anon key]" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
5. If it returns `{ ok: true, sent: 0 }` with no error — data source is dry today (normal). Check again tomorrow.
6. If it returns an error — escalate to Fixer agent or fix the root cause in code.
7. If cron never ran (heartbeat is days old) — check `pg_cron` for the schedule; may need re-adding via migration.

**Common silent killers:**
- `GOOGLE_MAPS_API_KEY` not in Supabase secrets (validator fails open for scrapers but fails for address lookup)
- `SUPABASE_SERVICE_ROLE_KEY_VAULT` vault key missing in pg_cron SQL
- Daily cap already hit (check `cold_email_ramp_state` or function-level cap constants)
- `marketing_kill_switch` table has a blocking row

---

## SOP 5 — Lead Credit Request (Trade Radar / Contractor Leads)

**Trigger:** Client disputes a lead quality (wrong address, duplicate, out of area)

**Valid credit reasons:**
- Invalid or non-existent address
- Duplicate lead delivered within 30 days
- Lead is outside the client's enrolled ZIP codes
- Wrong signal type for their vertical

**Steps:**
1. Client submits credit request via the portal mailto link (pre-filled with lead details).
2. Verify the claim against `trade_radar_leads` or `contractor_leads` table.
3. If valid: extend their trial by 3 days OR apply a $20 account credit to next invoice.
4. Reply within 24 hours: "Confirmed — I've applied a credit to your account. You'll see it on your next invoice."
5. Mark the lead as `status = 'bad_lead'` in the database so it doesn't recirculate.
6. If the same source is producing repeat bad leads, investigate the signal file for that vertical.

---

## SOP 6 — New Product Launch Checklist

**Trigger:** Adding a new DWA product to the stack

**Required before launch:**
- [ ] 1 migration: product table + RLS + service_role bypass
- [ ] 1 checkout function: `create-[product]-checkout` with inline `price_data`
- [ ] Stripe webhook handler: `metadata.type` match, `markFulfilled` call
- [ ] Welcome email: uses `dwaEmail()`, links to customer portal
- [ ] Customer portal page: `/my-[product]` with `OnboardingChecklist`
- [ ] Config.toml entry: `verify_jwt = false` for checkout + webhook
- [ ] `AdminOpsCenter.tsx` ALL_SERVICES array updated
- [ ] `AdminClientHealth.tsx` SERVICE_TABLES array updated
- [ ] `StartTrial.tsx` PRODUCTS + ALIASES entries (if trial-eligible)
- [ ] Landing page: `/[product]` with pricing, demo, CTA to `/start-trial?product=[key]`
- [ ] MEMORY.md updated with pricing and add-on notes for this product

---

## SOP 7 — Weekly Revenue Health Check

**Run every Monday (weekly-admin-digest handles SMS, but do this manually monthly):**

1. Check `trial_signups` — how many trials started this week? How many converted?
2. Check `outreach_leads` — how many cold emails sent? Open rate (check Resend dashboard)?
3. Check `stripe` dashboard — MRR vs last week. Any churn?
4. Check each scanner's `agent_heartbeats` — all green?
5. Check `techalert_prospect_targets` — pipeline depth (how many enriched, how many emailed, replies)?
6. Any client with `sla_status = 'red'` in `trial_signups`? Fix immediately.
7. Any `error_logs` entries from the last 7 days with `severity = 'fatal'`? Investigate.

**Healthy pipeline numbers (targets):**
| Metric | Target |
|---|---|
| Cold emails sent/day | 100–150 |
| Trial signups/week | 3–5 |
| Trial → paid conversion | > 30% |
| Lead delivery SLA green | > 90% of clients |
| Scanner heartbeat gap | < 2 hours |

---

## SOP 8 — Upsell Path (Website Client → Full Ecosystem)

**Trigger:** Web design client is 30 days post-launch and active

**Sequence:**
1. **Day 30:** Text them — "How's the site performing? Seeing any new leads come in?" (Relationship touch, not a pitch)
2. **Day 35:** If they engage, send SiteRadar pitch: "By the way — I can show you exactly which companies are visiting your site every day. It's $49/mo and takes 5 minutes to set up."
3. **Day 60:** If they're in a trade vertical (HVAC, roofing, etc.) — pitch Trade Radar: "I have a product that sends you daily permit and homeowner signals in your area. One lead pays for a year."
4. **Day 90:** If no upsell yet — send the full ecosystem overview email (all products, one paragraph each, positioned as "here's what other clients in your industry are using").

**Upsell priority by industry:**
| Industry | First Upsell | Second Upsell |
|---|---|---|
| HVAC / Roofing / Trades | Trade Radar | TechAlert |
| Dental / Healthcare | Missed-Call Catch | SiteRadar |
| Law Firm | Mortgage Radar | SiteRadar |
| Real Estate / LO | Mortgage Radar | Missed-Call Catch |
| Restaurant | Missed-Call Catch | SiteRadar |
| Manufacturing | TechAlert | SiteRadar |

---

## SOP — Shared Code Sync (run after any _shared/ change)

**Trigger:** Any change to `supabase/functions/_shared/ai.ts` or `supabase/functions/_shared/twilio.ts`

**Steps:**
1. Run `./scripts/sync-shared.sh` (dry-run — shows what differs)
2. If differences found, run `./scripts/sync-shared.sh --apply`
3. Commit both the main change AND the synced frontend file in the same commit
4. If adding a new shared file that frontend also needs, add its filename to `SYNCED_FILES` in `scripts/sync-shared.sh`

**Synced files (must stay identical between main and frontend):**
- `supabase/functions/_shared/ai.ts` ↔ `frontend/supabase/functions/_shared/ai.ts`
- `supabase/functions/_shared/twilio.ts` ↔ `frontend/supabase/functions/_shared/twilio.ts`

**POD protocol:** Before any Printify/Etsy product action, read `PRODUCT_CREATION_PROTOCOL.md`. It is the single source of truth.
