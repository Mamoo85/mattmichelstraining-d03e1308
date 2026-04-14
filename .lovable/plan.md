

# The "Inescapable Ecosystem" Build — 7 Features

This is the build that turns DWA from a software product into infrastructure that clients physically cannot leave without losing superpowers. All 7 features ship as edge functions + minimal frontend, maximizing the existing architecture.

---

## Feature 1: Lightning Claim (Reply "CLAIM" to SMS)
**Product**: Contractor Leads (PPL)

When a contractor gets a lead SMS, they reply **CLAIM** and the system instantly charges their saved Stripe card ($50) and texts back the homeowner's phone number. Zero browser, zero login.

**What gets built:**
- Modify `handle-dead-lead-reply` edge function to detect "CLAIM" keyword from contractor phones (not homeowner phones — new inbound path)
- New edge function `handle-contractor-sms-reply` — Twilio webhook for contractor inbound SMS
  - Matches sender phone to `contractor_clients.phone`
  - "CLAIM" → finds their most recent unclaimed lead → charges `stripe_payment_method_id` → texts back homeowner contact
  - "PASS" → marks lead as passed, opens to aged lead pool
- Migration: add `claimed_at`, `claimed_by` to `contractor_leads` table
- Update `contractor-lead-notify` to include "Reply CLAIM to buy instantly" in SMS

**Database columns needed**: `contractor_leads.claimed_at`, `contractor_leads.claimed_by`
**Secrets needed**: None (Stripe + Twilio already configured)

---

## Feature 2: Fast-Track Interview (TechAlert)
**Product**: TechAlert / HireAlert

One-tap "Fast-Track Interview" button on the TechAlert client dashboard. Client clicks it → system texts the candidate an interview invite with the client's booking link.

**What gets built:**
- Migration: add `booking_link` (text, nullable) to `hire_alert_clients`
- New edge function `fast-track-interview` — accepts `candidate_id` + `client_id`, sends templated Twilio SMS to candidate with client's booking link/phone
- Update `get-my-techalert` to return `booking_link` in client data
- Update MyTechAlert dashboard component to show "Fast-Track Interview" button on each candidate card (only if `booking_link` is set)
- If no `booking_link` configured, show prompt: "Add your scheduling link in settings to enable Fast-Track"

**Database columns needed**: `hire_alert_clients.booking_link`
**Secrets needed**: None

---

## Feature 3: Recovered Revenue Ledger
**Product**: Dead Lead Reactivation + cross-platform

A massive green ticker at the top of every client dashboard: **"Total Revenue Recovered by DWA Systems: $14,500"**

**What gets built:**
- Migration: add `average_ticket_value` (integer, default 500, in dollars) to `contractor_clients`
- New edge function `get-client-revenue-stats` — calculates total recovered revenue across all products for a given contractor:
  - Dead leads revived × `average_ticket_value`
  - Missed calls caught × `average_ticket_value`
  - Leads delivered × `average_ticket_value`
- New React component `RevenueRecoveredTicker.tsx` — animated green counter, pulsing dollar sign, placed at top of ROI report page and any client-facing dashboard
- Update `contractor-roi-report` to include `total_revenue_recovered` in response

**Database columns needed**: `contractor_clients.average_ticket_value`
**Secrets needed**: None

---

## Feature 4: En-Route Transparency Engine (Google Distance Matrix)
**Product**: FieldDesk

When a tech clicks "En Route" in FieldDesk, the system calls the **Google Distance Matrix API** to calculate real drive time, then texts the homeowner: *"Your tech John is en route. Estimated arrival: 18 minutes. Track: [link]"*

**What gets built:**
- New edge function `field-service-en-route` — triggered when tech status changes to `en_route`:
  1. Gets tech's last known GPS from `tech_locations` table
  2. Gets customer address from `field_service_customers`
  3. Calls Google Distance Matrix API (`https://maps.googleapis.com/maps/api/distancematrix/json`) with tech coords → customer address
  4. Sends Twilio SMS to customer with real ETA + tech name + client business name
  5. Logs to `system_comms_log`
- Update `TechJobDetail.tsx` `handleStatusChange` — when status becomes `en_route`, fire the edge function with job ID
- Migration: add `customer_notified_at` to `field_service_jobs` (prevents duplicate notifications)
- The SMS is white-labeled: comes from client's business name, not DWA

**Database columns needed**: `field_service_jobs.customer_notified_at`
**Secrets needed**: None (GOOGLE_MAPS_API_KEY already configured — Distance Matrix uses the same key)

---

## Feature 5: Territory Defense Monitor
**Product**: TechAlert (cross-platform intelligence add-on)

Clients input up to 3 local competitors. DWA's Sonar engine monitors their Google Reviews and license status. If a competitor drops the ball (bad reviews, license lapse), the client gets an alert: *"Competitor X got 2 one-star reviews this week in Dearborn. Deploy aggressive ads now."*

**What gets built:**
- Migration: new `competitor_monitors` table (`id`, `client_id` FK to `contractor_clients` or `hire_alert_clients`, `competitor_name`, `google_business_url`, `license_number`, `last_scanned_at`, `last_review_count`, `last_avg_rating`, `created_at`)
- Migration: new `competitor_alerts` table (`id`, `monitor_id`, `alert_type` (review_drop / license_issue / new_negative), `details` jsonb, `created_at`)
- New edge function `competitor-monitor-scan` — weekly cron:
  1. For each monitor: Sonar query for "[competitor name] Google reviews [city]"
  2. Detect review count/rating drops vs last scan
  3. If 2+ negative reviews in a week OR rating drop > 0.3 → insert alert + SMS client
- Admin UI: "Competitor Watch" section in client dashboard where they can add/remove competitors
- Fold into existing TechAlert as premium intelligence, not a separate product

**Database tables needed**: `competitor_monitors`, `competitor_alerts`
**Secrets needed**: None (Sonar uses LOVABLE_API_KEY, already configured)

---

## Feature 6: Referral Multiplier (Your Addition)
**Product**: Cross-platform

48 hours after a job is marked "completed" in FieldDesk, auto-text the homeowner: *"Thanks for choosing [Business Name]! Know someone who needs [trade] work? Reply their name and number and we'll give them $25 off."*

**What gets built:**
- New edge function `post-job-referral` — daily cron scans `field_service_jobs` for `completed_at` between 44-52 hours ago (one-shot window):
  1. Gets customer phone from `field_service_customers`
  2. Sends referral ask SMS (white-labeled from client business)
  3. Marks job `referral_asked_at` to prevent duplicates
- New inbound handler in `handle-dead-lead-reply` or new function `handle-referral-reply` — if someone texts back a name+number, creates a new lead in `contractor_leads` tagged `source = 'referral'`
- Migration: add `referral_asked_at` to `field_service_jobs`

**Database columns needed**: `field_service_jobs.referral_asked_at`
**Secrets needed**: None

---

## Feature 7: Monthly Proof Email (Your Addition)
**Product**: Cross-platform retention

First of every month, every active client gets a premium HTML email: *"Your DWA Performance Report — March 2026"* showing leads delivered, calls caught, dead leads revived, revenue recovered, candidates surfaced.

**What gets built:**
- New edge function `monthly-proof-email` — cron 1st of month 9am ET:
  1. For each active client across all product tables (`contractor_clients`, `hire_alert_clients`, `field_crm_clients`, `missed_call_clients`)
  2. Query last 30 days of activity across all their subscribed products
  3. Generate premium dark-branded HTML email with stat cards
  4. Send via Resend from `matt@detroitwebagent.com`
  5. Include the revenue recovered ticker number prominently
- No frontend needed — email only

**Database needed**: None (reads existing tables)
**Secrets needed**: None

---

## Build Order (Recommended)

1. **Lightning Claim** — highest revenue impact, simplest build
2. **En-Route Transparency** — uses your new Distance Matrix API, most impressive demo feature
3. **Fast-Track Interview** — quick build, high retention for TechAlert
4. **Recovered Revenue Ledger** — psychological lockdown, moderate build
5. **Monthly Proof Email** — pure retention, no frontend
6. **Referral Multiplier** — lead generation flywheel
7. **Territory Defense** — most complex, highest long-term moat

## Migration Summary

One migration file covers all schema changes:
- `contractor_leads`: +`claimed_at`, +`claimed_by`
- `hire_alert_clients`: +`booking_link`
- `contractor_clients`: +`average_ticket_value` (default 500)
- `field_service_jobs`: +`customer_notified_at`, +`referral_asked_at`
- New table: `competitor_monitors`
- New table: `competitor_alerts`
- Cron entries for `competitor-monitor-scan` (weekly), `post-job-referral` (daily), `monthly-proof-email` (monthly 1st)

## New Edge Functions (6 total)
1. `handle-contractor-sms-reply` — Lightning Claim
2. `fast-track-interview` — TechAlert
3. `get-client-revenue-stats` — Revenue Ledger
4. `field-service-en-route` — En-Route with Distance Matrix
5. `post-job-referral` — Referral Multiplier
6. `monthly-proof-email` — Proof Email

`competitor-monitor-scan` makes 7 total.

No new secrets required. Zero new third-party dependencies.

