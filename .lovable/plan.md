# Growth Sprint — Lovable's Side (complementary to Claude's plan)

Updated: 2026-04-30

Claude is building the backend (`generate-dead-lead-campaign`, `$1 pilot` checkout variant, `stripe-webhook` pilot + Missed-Call bundle handlers, `siteredar-self-pitch`, NPS testimonial extension, Lob faxes, etc.). I own the Lovable-side frontend layer.

## Already Shipped
- DWAAdmin tab consolidation — outreach tabs grouped under **Outreach**, plus `Dead Lead Ad Studio` tab.
- `AdminDeadLeadAdStudio.tsx` — 4-tab generator (Brief -> Creative -> Targeting -> Checklist).
- 3 vertical landing pages: `/dead-leads-roofing-texas`, `/dead-leads-hvac-florida`, `/dead-leads-roofing-florida`.
- Routes wired in `App.tsx`.
- `DeadLeadIntake.tsx` already handles `?billing=success` redirect.

## This Sprint — Two Conversion Lifters

### 1. DeadLeadROICalculator (reusable)
- Slider 50–2000. Trade-aware avg job value as a prop.
- Live calc: replies @ 6%, closes @ 33% of replies, revenue, cost @ $50/reply, ROI multiple.
- Persists value to localStorage by trade+geo.
- Mounted on all 3 landing pages above the pilot form.

### 2. Post-pilot activation banner on DeadLeadIntake
- When `?pilot=1` is present, show a top banner pointing to the existing lead-list form. Closes the activation gap.

## Deferred (until first paying TX/FL Dead Lead customer)
- Programmatic /hire-{trade}-{city} pages, FSBO heatmap, public job board, exit-intent popup, comparison pages, live chat, ad-draft persistence.

## Verification
1. Each landing page: calculator renders, slider updates math, value persists across reload.
2. `/dead-lead-intake?pilot=1` shows the activation banner above the form.
3. Mobile (390×844) stacks cleanly.
