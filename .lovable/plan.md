I checked the current state before proposing this. I cannot honestly say “100% every cold-email link works” until I run a broader content-aware audit across every outbound email generator and not just the central trial aliases. What I can confirm right now:

- The latest D.J. Conley proposal sent to Pat was `djconley_pitch_v2` on 2026-05-05 01:33 UTC to `pmichels@djconley.com`; the send log shows status `sent` and the provider returned HTTP 200 with resend id `6cb6b482-ea71-453d-bac4-33870f291e4a`.
- The older short proposal sender still exists in the admin panel and is weaker than the v2 proposal. It also still says “navy + orange” in spots, while the newer v2 says the corrected teal + red brand palette.
- I ran the deployed conversion-link auditor: 99 URLs checked, 0 failures.
- I also browser-tested the links that previously failed:
  - `product=field_crm` now opens FieldDesk trial form.
  - `product=trade_radar_roofing` now opens Roofing Radar trial form.
  - `product=missed_call` now opens Missed-Call Catch trial form.
- I browser-tested D.J. Conley demo links in the current proposal:
  - `https://detroitwebagent.com/demo-djconley-v4/index.html` loads with the D.J. Conley headline and CTA.
  - `https://detroitwebagent.com/demo-djconley-v2/index.html` loads with the D.J. Conley headline and CTA.

Plan:

1. Make the D.J. Conley proposal sender use one upgraded canonical proposal
   - Replace the older short `send-djconley-proposal` email body with the stronger `djconley_pitch_v2` structure so the admin “Send D.J. Conley proposal” button cannot send the weaker/older version by accident.
   - Keep the same offer and pricing:
     - Option A: $499/mo, zero upfront.
     - Option B: $499 one-time + $199/mo.
     - Forever Pricing promise.
     - eWay and FieldServio stay; we add the website/admin/intelligence layer on top.
   - Keep the same proposal substance, but upgrade presentation and proof.

2. Upgrade the proposal visually
   - Add stronger email-safe visual preview sections for:
     - New website homepage concept.
     - Owner dashboard.
     - Command Center tiles.
     - SiteRadar visitor/company intel.
     - Predictive Sales Fusion alert.
     - FieldDesk running next to eWay.
     - Missed-call text-back/review automation.
     - Email campaign controls with master kill switch.
   - Use D.J. Conley’s corrected palette from the latest demo: teal/red/white, with DWA teal as the sender accent.
   - Remove confusing “navy + orange” references from the active proposal unless they are explicitly describing the older alternate demo.

3. Upgrade the proposal’s numbers
   - Add a concise ROI section with concrete, conservative math:
     - One recovered boiler/service opportunity can cover the monthly fee many times over.
     - Missed-call recovery example.
     - SiteRadar/fusion pipeline example using the existing Stellantis/MITN example.
     - Review/request and seasonal email value framed as retained service work, not random add-ons.
   - Make clear the website is the lead offer; SiteRadar, fusion alerts, FieldDesk, missed-call, reviews, and email tools are add-ons inside the managed website stack.

4. Harden links inside the D.J. Conley proposal before resending
   - Use only fully-qualified production URLs for every proposal link.
   - Include only links I can verify:
     - `https://detroitwebagent.com/demo-djconley-v4/index.html`
     - `https://detroitwebagent.com/demo-djconley-v2/index.html`
     - `https://detroitwebagent.com`
     - `mailto:matt@detroitwebagent.com`
     - `tel:+13139921219`
   - Avoid any trial/start-trial links in the D.J. Conley proposal because this is a custom website/proposal sale, not a self-serve trial.

5. Improve the cold-email link audit so “200 OK but bad page” can’t pass
   - The current auditor is better than before, but it still relies mostly on HTTP/content fingerprints from static HTML. It does not execute the React page the way a human click does.
   - I will add/extend a backend audit manifest for active cold email generators and their links, then make it fail on:
     - `Unknown product`
     - invalid/missing trial text
     - wrong product label
     - 404/5xx
     - redirects to irrelevant pages
   - I will also update the admin Link Health copy so it no longer claims only “HEAD-check”; it will accurately say “content-aware conversion check.”
   - For the most sensitive trial links, I will browser click-test representative live links after the code changes, not just rely on HTTP status.

6. Send only after end-to-end verification
   - Deploy the changed proposal function(s).
   - Test the proposal send to Matt first, using the same function and same links.
   - Check the function response, provider response, and email/audit log.
   - Browser-open every proposal link from the final HTML.
   - After it passes, send the upgraded proposal to:
     - `pmichels@djconley.com`
   - Also send Matt a copy. I will use the DWA/Matt copy address already used in the existing proposal BCC unless you want a different address.

Files/functions I expect to change:

```text
supabase/functions/send-djconley-proposal/index.ts
supabase/functions/send-djconley-pitch-v2/index.ts
src/components/admin/SendDJConleyProposalCard.tsx
src/pages/admin/LinkHealth.tsx
supabase/functions/e2e-link-auditor/index.ts
possibly supabase/functions/_shared/offer-url.ts
```

Acceptance criteria before I tell you it is done:

- Final D.J. Conley proposal sends successfully to Matt test inbox first.
- Final D.J. Conley proposal has no self-serve trial CTA.
- Every proposal link opens a correct live page or client action.
- Pat receives the upgraded proposal.
- Matt receives a copy.
- The send logs show successful provider responses.
- The cold-email link audit has run and reports 0 failures for the audited trial/offer links.