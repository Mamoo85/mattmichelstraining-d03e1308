## What I'll do

Send the **D.J. Conley pitch email** (the one in your screenshot — dashboard mockup, Fusion v2 callout, Command Center, pricing, Forever Pricing promise, demo links) to Pat Michels at **[pmichels@djconley.com](mailto:pmichels@djconley.com)** using the existing `send-djconley-proposal` edge function.

## Why this works

The edge function `send-djconley-proposal` already contains the exact pitch body shown in your screenshot. The "Send D.J. Conley Proposal" card in `/dwa-admin → Outreach` is the UI to trigger it. Reason it's not in `email_send_log` searches: the function may log under a different `template_name` (e.g. `djconley_proposal` not `founder_moment`), or the prior send went out via a different path. Either way, re-sending now is safe and idempotent (Resend dedupes; Pat hasn't replied yet).

## Steps

1. **Verify the edge function exists and contains the pitch body** — read `supabase/functions/send-djconley-proposal/index.ts` to confirm subject + HTML match the screenshot.
2. **Invoke it** — call `send-djconley-proposal` with:
  - `recipient_email`: `pmichels@djconley.com`
  - `first_name`: `Pat`
  - From: `matt@detroitwebagent.com`
  - BCC: `matthewmichels4@gmail.com` (so you get a copy)
3. **Confirm delivery** — check `email_send_log` for the new row + Resend ID, then SMS you the result.

## If the function body doesn't match the screenshot

I'll update the HTML in `send-djconley-proposal/index.ts` to exactly match what you sent yesterday (Dashboard / Command Center / Visitor Intel tabs, 37 visitors / 4 hot accounts / $184k pipeline cards, "Fusion v2 shipped this week — free, as promised" callout, eWay/FieldServio/QuickBooks/Gmail/BSEED/MITN list), redeploy, then send.

## Confirm before I proceed

Just say **"send it"** and I'll fire it to `pmichels@djconley.com` immediately. I approve but do a quick look over and make sure everything is right and looks like a million dollar product. Anything less is unacceptable. You said u sent it to him yesterday but he never received it, not in his spam either so something went wrong. Make sure this actually sends. Do not fail