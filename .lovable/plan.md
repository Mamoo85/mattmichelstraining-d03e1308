## Goal
Make sure every link Jess receives actually works, and give her a clear way to send back feedback. Test on Matt first, then send to Jess.

## Step 1 — Add a feedback / questions box to the welcome email

Edit `supabase/functions/create-counsel-beta-invite/index.ts` welcome email HTML to add a new section above the footer:

- Headline: **"Does it work? What's missing?"**
- Friendly ask: "I built this for you — please tell me if anything is broken, confusing, or missing. Reply to this email with anything you want added or changed."
- Big primary button: **"Reply with feedback →"** linking to `mailto:matt@detroitwebagent.com?subject=Counsel%20Search%20feedback%20—%20{firstName}&body=Hi%20Matt%2C%0A%0AWhat%20worked%3A%0A%0A%0AWhat%20broke%20or%20felt%20off%3A%0A%0A%0AThings%20I%27d%20like%20added%2Finstead%3A%0A%0A%0A`
- Secondary: "Or text me direct: (313) 992-1219"

Pre-filled mailto means one click opens her mail client with a structured questions/concerns form she can fill in. (Plain HTML emails can't host live form inputs reliably — mailto with a templated body is the click-to-feedback equivalent and works in every mail client.)

Deploy the updated function.

## Step 2 — Click-test the full flow with Matt

Generate a real invite for **Matthew Michels** at `matt@detroitwebagent.com` (30 days) by calling the deployed `create-counsel-beta-invite` function with admin auth.

Then verify each thing Jess will receive:

1. **Email arrives** at matt@detroitwebagent.com — check Resend log + inbox.
2. **Magic dashboard link** `/my-counsel-search?email=...&token=...` — load it, confirm it shows the dashboard (not "Access denied"), shows "Beta · trial ends [date]", and the "Run a New Search" button.
3. **Console link** `/counsel-search/console` — load it, confirm the search page renders.
4. **Feedback button** — confirm the mailto opens with the pre-filled subject/body.
5. **DB row** — confirm `counsel_search_clients` row exists with `tier='beta'`, `active=true`, valid `dashboard_token`, correct `trial_ends_at`.

If anything fails, fix it and re-test until all 5 checks pass.

## Step 3 — Send the real invite to Jess

Once Matt's test passes 100%, generate Jess's invite:
- Email: `Jessberg82@gmail.com`
- Contact name: `Jess`
- Days: 30
- Note: "Beta tester — please send feedback"

Confirm to you (Matt) that it sent, and share the magic link so you have it for SMS backup.

## Technical notes

- Email is sent from `matt@detroitwebagent.com` via Resend (already wired).
- The function requires admin JWT — testing must use your logged-in admin session token, invoked via the curl-edge-functions tool.
- No DB schema changes needed. No new env vars.
- Files touched: `supabase/functions/create-counsel-beta-invite/index.ts` only.
