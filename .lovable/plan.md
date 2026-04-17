

## The Problem

Looking at the screenshot — that's the D4 follow-up from `dead-lead-outreach-drip`. CTA is **"Reply here or text me: (313) 992-1219"** with no link to `/dead-lead-intake` (which is fully self-serve, free first batch, public, no auth). Same dead-end pattern is in 6+ other cold-outreach functions even though the matching self-onboard pages exist.

## What I Found — Cold Outreach Audit

| Sender (edge function) | Product pitched | Self-onboard URL exists? | Currently in email? |
|---|---|---|---|
| `dead-lead-outreach-drip` (D4 + D8 dead-lead, D4 + D8 senior care) | Dead Lead Reactivation | ✅ `/dead-lead-intake` | ❌ "Reply here / text me" |
| `contractor-prospector` SNIPER_DEAD | Dead Lead Reactivation | ✅ `/dead-lead-intake` | ❌ "reply or text" |
| `contractor-prospector` SNIPER_TECH | TechAlert | ✅ `/hire-alert` (Stripe checkout) | ❌ "reply to claim trial" |
| `contractor-prospector` SNIPER_MISSED_CALL | Missed Call Catch | ✅ `/missed-call-catch` | ❌ "reply or text" |
| `contractor-prospector` SNIPER (web design) | Web Design | ✅ `/web-design-services` | ❌ "reply" only |
| `contractor-drip` D4/D8/D15 (leads / GBP / missed call) | PPL leads, GBP, Missed Call | ✅ all 3 product pages | ❌ "reply or text" everywhere |
| `dwa-closer` | Bundle pitch | ✅ multiple | ❌ "quick call, reply" |
| `contractor-sms-follow` SMS1/SMS2 | Various | ✅ all | ⚠️ SMS — short links would help |
| `dead-lead-outreach-drip` senior care D4/D8 | TechAlert (CNA/LPN/RN) | ✅ `/hire-alert` | ❌ "reply or text" |

The infrastructure to self-onboard already exists. The cold emails just don't link to it.

## The Fix

Update every cold-outreach copy template to add a primary self-onboard CTA, while keeping the "or reply / text me" as a secondary fallback (some prospects still want to talk to a human, that's fine).

**New CTA pattern (email):**
> Start free in 60 seconds → https://www.detroitwebagent.com/dead-lead-intake
> Or reply to this email / text (313) 992-1219.

**New CTA pattern (SMS — short URL only):**
> Start free: detroitwebagent.com/dead-lead-intake

### Files to update

1. **`supabase/functions/dead-lead-outreach-drip/index.ts`**
   - Dead lead D4 + D8 → add `/dead-lead-intake` link as primary CTA
   - Senior care D4 + D8 → add `/hire-alert` link as primary CTA

2. **`supabase/functions/contractor-prospector/index.ts`**
   - `sniperDeadLeadEmail` prompt rule #5 → require self-onboard URL `/dead-lead-intake`
   - `sniperTechAlertEmail` prompt rule #5 → require `/hire-alert` (free trial path)
   - `sniperMissedCallEmail` prompt rule #5 → require `/missed-call-catch`
   - `sniperGenerateEmail` (web design) → require `/web-design-services`

3. **`supabase/functions/contractor-drip/index.ts`**
   - `leads` D4/D8/D15 → add `/contractor-leads` Stripe checkout link
   - `gbp` D4/D8/D15 → add `/local-marketing` checkout link
   - `missed_call` D4 → add `/missed-call-catch` link

4. **`supabase/functions/dwa-closer/index.ts`**
   - Prompt rule #5 → require concrete self-onboard URL for whichever product is being pitched (map pitch → URL inside the prompt)

5. **`supabase/functions/contractor-sms-follow/index.ts`**
   - SMS1/SMS2 templates per offer → append `detroitwebagent.com/<product>` short URL

6. **`supabase/functions/dead-lead-outreach-drip/index.ts` HTML wrapper**
   - Add a styled `[Start free →]` button (teal, rounded) above the signature block so the link doesn't get lost in the body text on mobile (the screenshot shows a long wall of text).

### Behavioral guardrails preserved

- All copy still passes Brand Strategy (no "AI" jargon, blue-collar tone, signed by Matt)
- Phone number stays the DWA work line `(313) 992-1219` (not Matt personal)
- TCPA Manual-Only mandate untouched — these are emails, no automated SMS sends are being added
- `/dead-lead-intake` already gates free-trial-then-bill, so even self-onboard prospects hit billing setup before drip runs

### Verification plan

After changes deploy, fire one test email per template via `AdminSimulationSuite` to `matt@detroitwebagent.com` and visually confirm:
- Self-onboard URL is rendered as a button (not buried in text)
- Mobile preview (393px viewport) keeps button above the fold
- Reply/text fallback is still present but secondary

### Out of scope (called out so we don't drift)

- This is **email/SMS copy + URL injection only**. Not changing checkout flows, pricing, or DB schemas.
- Not touching auth/marketing emails or auto-onboard welcome emails — those already point at correct dashboards.
- Not adding new self-onboard pages — every product pitched in cold outreach already has one.

