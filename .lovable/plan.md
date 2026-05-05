I found the issue, and you’re right to be angry. The FieldDesk email screenshot is using:

```text
/start-trial?product=field_crm
```

But the live Start Trial page only recognizes:

```text
field_desk
```

So that email CTA currently lands on the exact “Unknown product” page you showed. I also manually checked live links in the browser and confirmed more broken keys:

```text
/start-trial?product=field_crm          -> Unknown product
/start-trial?product=trade_radar_roofing -> Unknown product
/start-trial?product=trade_radar_hvac    -> Unknown product
/start-trial?product=missed_call         -> Unknown product
/start-trial?product=field_desk          -> trial form works
```

The reason prior “100% working” checks missed this is because the existing `e2e-link-auditor` only checks HTTP status. `/start-trial?product=bad_key` returns a normal 200 page, so the auditor marked it as healthy even though the page content says “Unknown product.” That is not acceptable for sales links.

Plan to fix it:

1. Normalize every trial/product key at the Start Trial page
   - Add a canonical alias map so old and current outbound links resolve instead of dying.
   - FieldDesk aliases:
     - `field_crm`
     - `fielddesk`
     - `field-service`
     - `field_service`
     - canonical: `field_desk`
   - Missed-call aliases:
     - `missed_call`
     - `missed-call`
     - `missed_call_catch`
     - canonical: `missed_call_catch`
   - Trade Radar aliases:
     - `trade_radar_roofing`, `roofing_radar`, `roofing`
     - `trade_radar_hvac`, `hvac_radar`, `hvac`
     - `trade_radar_plumbing`, `plumbing_radar`, `plumbing`
     - `trade_radar_electrical`, `electrical_radar`, `electrical`
     - `trade_radar_pest_control`, `pest_control_radar`, `pest_control`
     - `trade_radar_gutters`, `gutters_radar`, `gutters`
     - `trade_radar_exterior`, `exterior_radar`, `painting_radar`, `painting`
     - `trade_radar_tree`, `tree_radar`, `tree`
     - `trade_radar_restoration`, `restoration_radar`, `restoration`
     - `trade_radar_demo_junk`, `demo_junk_radar`, `demo_junk`
     - `trade_radar_foundation`, `foundation_radar`, `foundation`
   - Other aliases:
     - `site_radar` / `siteradar`
     - `mortgage_radar` / `mortgage-radar`
     - `techalert` / `hire_alert` / `talent_radar`
     - `phone_answering` / `ai_phone_answering`
     - `bundle_revenue_suite` / `bundle`

2. Make Start Trial use the correct checkout payload per product
   - Current shared form sends a generic payload. Some checkout functions require fields that are currently blank or named differently.
   - I’ll make the page product-aware:
     - FieldDesk: send `business_name`, `email`, `phone`, `industry`.
     - SiteRadar: send `businessName`, `website`, `email`.
     - Missed-Call: require `phone`, send `businessName`.
     - Trade Radar verticals: send `vertical`, `business_name`, `phone`, `zip_codes`, `tcpa_consent: true`.
     - Mortgage Radar: do not pretend a lightweight trial form is enough; route to the real Mortgage Radar page if compliance fields are missing.
     - Contractor Leads / Dead Lead: route to the real intake/landing flow instead of a fake generic “trial” path.

3. Fix the actual bad outbound email generators
   - `fielddesk-cold-blast`: change `product=field_crm` to a canonical, working key.
   - `dwa-product-blast`: change `product=trade_radar_${vertical}` links to keys Start Trial can resolve and pass vertical-specific checkout data.
   - `dwa-product-blast`: change `product=missed_call` to a canonical working key, while also preserving alias support so already-sent emails work.
   - Sweep every direct `/start-trial?product=` reference and route it through the central `buildOfferUrl()` helper where possible.

4. Fix the backend trial-email flow too
   - `start-radar-trial` currently recognizes older keys like `roofing_radar`, but not newer keys like `trade_radar_roofing`, and it is missing the newer Trade Radar verticals (`exterior`, `tree`, `restoration`, `demo_junk`, `foundation`).
   - Add the same alias normalization there so landing pages, email CTA links, and backend-generated magic links all agree.
   - Fix FieldDesk dashboard path consistency (`/my-field-desk` or the correct public onboarding path) instead of sending people to a mismatched dispatch route.

5. Replace the bad link auditor with a real conversion-link auditor
   - Update `e2e-link-auditor` so it does not only check 200/300 status.
   - For `/start-trial` links, it must GET the page and fail if the HTML contains:
     - `Unknown product`
     - `trial link is missing or invalid`
   - It should also verify the expected product label appears on the page.
   - Add explicit targets for all known aliases and all live cold-email hardcoded links, not just keys in `OFFERS`.

6. Add an admin-facing red flag for this exact failure
   - Update Link Health wording from “HEAD-check” to “content-aware conversion check.”
   - Show failures if a URL technically loads but contains the bad error page.

7. Browser click-test the repaired links before calling it done
   - I will manually open representative live/preview links for:
     - FieldDesk old bad link: `product=field_crm`
     - FieldDesk canonical link: `product=field_desk`
     - Trade Radar vertical old link: `product=trade_radar_roofing`
     - Trade Radar canonical/alias link: `product=roofing_radar`
     - Missed-call old bad link: `product=missed_call`
     - Missed-call canonical link: `product=missed_call_catch`
     - SiteRadar
     - Bundle
     - TechAlert
   - Passing criteria: no “Unknown product,” correct product label, correct form fields, and the CTA invokes the intended checkout function.

8. Deploy affected functions after the code fix
   - Deploy/update the changed backend functions so outgoing emails stop creating broken CTAs.
   - Existing already-sent broken links will be rescued by the Start Trial alias map, so those leads are not lost if they click later.

Files I expect to change after approval:

```text
src/pages/StartTrial.tsx
src/pages/admin/LinkHealth.tsx
supabase/functions/_shared/offer-url.ts
supabase/functions/start-radar-trial/index.ts
supabase/functions/e2e-link-auditor/index.ts
supabase/functions/fielddesk-cold-blast/index.ts
supabase/functions/dwa-product-blast/index.ts
possibly supabase/functions/_shared/offers.ts
```

The priority is not just fixing future emails. The priority is also rescuing links that already went out, because alias support on `/start-trial` means `field_crm`, `missed_call`, and `trade_radar_*` links can start working without the recipient needing a new email.