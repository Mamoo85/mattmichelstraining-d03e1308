## Why `/dead-lead-intake` got 20 visits → 0 conversions

I queried the DB and edge function logs. The funnel never even fired:

- `dead_lead_campaigns` table: **0 rows ever** (no one submitted)
- `dead-lead-intake` edge function: **no invocations logged**
- `trial_funnel_events` for this page: **0** (page is not instrumented at all — we're flying blind same as `/start-trial` was before this week's fix)
- `contractor_clients` last 14d: **0**

So the visitors dropped at one of three places: (1) bounced from the page before reading, (2) hit the form wall and left, or (3) tried to fill it on mobile and gave up. We can't tell which until we instrument it.

### Five concrete reasons it's not converting

1. **Zero funnel tracking on the page** — `DeadLeadIntake.tsx` never calls `logTrialFunnelEvent`. We have no signal between "page view" and "submit success". `/start-trial` got the same fix this week; this page didn't.
2. **5 required fields BEFORE proof** — Business name, your name, phone, email, trade, AND a textarea of dead-lead phone numbers. That's the heaviest form on the entire site. The "first reply free" pitch is buried in paragraph 2 of a teal callout box.
3. **Mobile-hostile data entry** — A contractor on a phone cannot paste 30 leads into a textarea. CSV upload exists but is hidden behind a tab toggle and most phones don't have a CSV in their downloads. Bing referrer in our analytics confirms cold mobile traffic.
4. **No social proof anywhere** — No "Smith HVAC reactivated 12 dead quotes last week", no example SMS, no screenshot of a YES reply, no Google review snippet. It's a form with a promise.
5. **Weak CTA + no escape hatch** — "Start Reactivation Campaign →" is bureaucratic. There's no "Text Matt instead" / "Schedule a 5-min call" / "Email me your list" fallback for people who don't want to fill the form.

---

## Fix plan

### Phase 1 — Visibility (10 min)
1. Add `logTrialFunnelEvent` calls to `DeadLeadIntake.tsx`:
   - `view` on mount (with `product: "dead_lead_reactivation"`, UTM capture)
   - `form_focus` on first email/phone field interaction
   - `form_submit_attempt` on submit click
   - `form_submit_success` / `form_submit_error` after function response
   - `billing_redirect` when Stripe URL is hit
2. Same instrumentation for `/contractor-marketplace` and `MyContractorLeads` claim flow.

### Phase 2 — Pricing + proof above the fold (20 min)
3. Replace the current intro card with a 3-block hero:
   - **Price line**: `$0 to start. $50 only when a dead lead replies YES. First reply free.`
   - **Mini case study**: 1-sentence quote + name + trade (Matt to provide; placeholder until then)
   - **Sample SMS exchange**: 2-bubble screenshot ("Hey Sarah, still need that HVAC quote?" → "Yes actually")
4. Add a **trust strip**: TCPA-compliant · Carrier-screened · Detroit-based · Auto opt-out

### Phase 3 — Demolish the form wall (30 min)
5. **Two-step form**: Step 1 = email + phone + trade only (3 fields → unlock pricing + show the lead-list step). Step 2 = leads list + business name. This is the "slope not wall" pattern that fixed `/start-trial`.
6. **Mobile-first lead entry**: If `window.innerWidth < 768`, default to CSV upload AND show a "📱 Just text me your list — (313) 992-1219" SMS button as the primary CTA. Pasting 30 phone numbers on a phone is not happening.
7. **Inline error fallback**: On any submit error, show SMS + email Matt CTAs immediately (matches the StartTrial fix from earlier today).
8. CTA copy: `Wake Up My Dead Leads — First Reply FREE →`

### Phase 4 — Escape hatches (10 min)
9. Sticky bottom bar on mobile with: `📞 Call Matt` · `💬 Text List` · `📧 Email Sample`. Each click logs a `funnel_escape_hatch` event so we know what they preferred.
10. Add an exit-intent modal on desktop offering: "Not ready? Get a 90-second loom of how it works" → captures email → tags as `dead_lead_warm_lead`.

### Phase 5 — Verify (10 min)
11. After Phase 1 ships, hit `/dead-lead-intake` from incognito mobile + desktop, confirm `view`, `form_focus`, `form_submit_*` rows in `trial_funnel_events`.
12. Add a dashboard tile to `AdminOpsCenter` showing dead-lead funnel: Views → Focus → Submit attempts → Successes → Free-tier exhausted → Billing setup. So we can see where they actually drop next time.

---

## Technical notes

- Reuse the new `PRODUCT_PITCH` pattern from `StartTrial.tsx` for the `dead_lead_reactivation` product so pricing/value-prop blocks share one source of truth.
- All funnel writes will work because Phase 1 of Tuesday's audit already granted `INSERT` on `trial_funnel_events` to `anon`.
- No DB migrations needed for this plan.
- No edge function changes needed for Phase 1–4. Phase 5 dashboard tile reads existing data.

---

## What we're NOT doing (and why)

- **Not adding more lead sources** — the conversion problem is at the form, not the traffic. Fix the form before pouring more clicks at it.
- **Not reducing the $50/reply price** — pricing is fine, the page never gets that far.
- **Not building a chatbot** — over-engineering for a 20-visit/8-day funnel.
