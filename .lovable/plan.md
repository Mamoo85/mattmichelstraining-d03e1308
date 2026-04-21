

## Final E2E Test — Pretend to Be the Electrician

I will run through the **exact** signup flow a Livonia electrician will hit tomorrow, clicking every button, filling every form, and verifying every backend write. Both of us will know it works before he wakes up.

### What I'll test (in order)

**1. Landing page → Territory form**
- Navigate to `https://www.detroitwebagent.com/contractor-leads` on mobile viewport (390×844, since most contractors browse on phones)
- Verify page loads, no console errors, no broken images
- Scroll through the offer, find the territory signup form
- Fill it out as **"Sparky's Electric, Mike Sparks, mike+test@detroitwebagent.com, (313) 555-0142, Electrical, Livonia"**
- Click submit → verify Stripe checkout opens

**2. Stripe checkout page**
- Verify the checkout shows: **$399/mo, "Exclusive Electrical Leads — Livonia, MI"**, correct bonus stack in description
- Verify trade-specific pricing logic didn't accidentally trigger Gutters/Siding $299 rate
- Verify customer email is prefilled
- **Cancel** the checkout (don't actually charge a test card — we just need to confirm the cancel URL goes to detroitwebagent.com, not mattmichelstraining.com)
- Verify cancel redirects back to `https://www.detroitwebagent.com/contractor-leads`

**3. Re-do checkout, complete with Stripe test card**
- Re-submit form, get back to checkout
- Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP
- Submit payment
- **Critical check**: Success URL must land on `https://www.detroitwebagent.com/contractor-leads?success=1&...` — NOT mattmichelstraining.com (this is the bug Matt flagged)

**4. Backend verification (via supabase--read_query)**
- Confirm `contractor_clients` row exists with `free_dead_leads_quota=40`, `free_dead_leads_used=0`
- Confirm `contractor_lead_subscriptions` row created by webhook
- Confirm welcome SMS fired (check `system_comms_log` for outbound to (313) 555-0142 — will fail-soft since fake number, but log must show attempt)
- Confirm welcome email queued in `email_send_log`
- Check `stripe-webhook` edge function logs for `contractor_lead_subscription` event processed cleanly with no 500s

**5. Contractor portal magic link**
- Pull `roi_token` from the DB row
- Navigate to `https://www.detroitwebagent.com/contractor-portal/<roi_token>`
- Verify dashboard loads showing: business name, "0/40 free boost used", Lead Probability card (65% / 80% / 90% tiers), "No leads yet — Google ads typically take 3-5 days to prime" empty state

**6. Free Boost intake flow (`?cid=` param)**
- Click the Free Boost CTA → should land on `/dead-lead-intake?cid=<contractor_id>`
- Verify "🎁 Free Boost Gift — 40 free reactivations" hero shows
- Paste 3 fake dead leads (name/phone format), submit
- Verify rows land in `dead_lead_contacts` linked to the contractor

**7. Lead Boost upsell (don't complete payment)**
- Back on portal, click "Boost Your %" → $100 option
- Verify Stripe checkout opens with $100, correct fine print about 20% management fee in description
- Verify success/cancel URLs point to detroitwebagent.com portal, not mattmichelstraining.com
- Cancel out

**8. Cleanup**
- Delete the test `contractor_clients` row + cascading `dead_lead_contacts` rows so the test data doesn't pollute live admin views
- Refund the $399 test charge in Stripe (or note it for Matt to refund manually since I'm using a test card on live mode — wait, **I need to verify if Stripe is in test or live mode first** before charging anything)

### Pre-flight check before charging anything
- Inspect `stripe-webhook` logs and recent `contractor_lead_subscriptions` rows to determine if the Stripe account is in test mode or live mode
- If LIVE: I will NOT complete a real $399 charge. I'll only verify the checkout page renders correctly + cancel URL works, then test the post-payment flow by manually inserting a fake `contractor_clients` row and invoking `stripe-webhook` with a synthetic event
- If TEST: full $4242 card flow, then refund

### Bugs I'll fix on the fly (no asking)
- Any redirect that lands on mattmichelstraining.com instead of detroitwebagent.com
- Any 500 error in `stripe-webhook` during the subscription event
- Any missing CTA / broken link / wrong price displayed
- Any console errors on the portal dashboard

### What I'll report back
- ✅ / ❌ for each of the 8 steps above
- Screenshot of the final dashboard
- Confirmation that cancel/success URLs both go to detroitwebagent.com
- List of any bugs found + fixes applied
- Green light (or red flag) for tomorrow's signup

### Tools I'll use
- `browser--navigate_to_sandbox` + `browser--navigate_to_url` (test the live detroitwebagent.com flow)
- `browser--observe` + `browser--act` (fill forms, click buttons)
- `browser--screenshot` (proof of each milestone)
- `supabase--read_query` (verify DB writes)
- `supabase--edge_function_logs` (verify webhook ran clean)
- `stripe--list_payment_intents` + `stripe--list_subscriptions` (verify Stripe side)
- `code--line_replace` / `code--write` (any bug fixes found mid-test)

### Time estimate
~10 minutes of browser automation + DB checks. You can stay calm and wait for the green light.

