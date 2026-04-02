

# M² Product Overhaul — Final Unified Plan

This combines your notes, Claude's analysis, and market research into one execution plan. Every product gets fixed, enhanced, or properly gated. Nothing stays broken.

---

## Current State (What I Found)

- **3,441-line stripe-webhook** with ~20 inline 1-3 sentence HTML email blobs
- **Competitor report webhook handler EXISTS** at line 3242 (Claude was wrong about it being missing)
- **Field Rep + B2B access** requires `supabase.auth.getUser()` — breaks after Stripe checkout because no auth account is created
- **WaitlistGate component** already exists and is used on 16+ pages — ready to reuse
- **Missed Call** is correctly at $99/mo in code (`unit_amount: 9900`). Market rate for missed call text-back is $97-$297/mo — $99 is competitive
- **GBP Post Pack** checkout needs price verification (should be $19)
- All welcome emails are bare-bones inline HTML

---

## Batch 1: Pricing + Secrets + Quick Gates

**Pricing confirmation/fixes:**
- Verify GBP Post Pack checkout = $19 (`unit_amount: 1900`)
- Missed Call stays at $99/mo (market validates this)
- Website Audit = $9, Competitor Report = $9 (per your notes)

**Product gates:**
- Review Responder page → swap checkout for `WaitlistGate` (no GBP OAuth exists, no automation)
- AI Chatbot → reframe as "done-for-you install within 48 hours" (remove self-install language)
- Contractor Leads → `WaitlistGate` (on hold per your decision)

**Files:** `ReviewResponder.tsx`, chatbot page, contractor leads page, relevant checkout functions

---

## Batch 2: Welcome Email Overhaul (All 8+ Services)

Rewrite every inline HTML email blob in `stripe-webhook/index.ts` with the M² branded template (dark slate header, orange accent, matt-boat.jpg signature). Each email gets:

| Service | What the email needs to say |
|---|---|
| **GBP SaaS** ($49/mo) | What AI writes about, 3x/week posting schedule (Mon/Wed/Fri), how to share GBP access, what Pro gets extra (review requests), first post within 48 hours |
| **Social Media AI** ($199/mo) | 3 platforms, 3x/week posting, what the AI writes, content calendar preview, onboarding link to connect accounts, first post timeline |
| **Field Rep Tools** ($29/mo) | All 4 tools with descriptions and use cases, quick-start guide, bonus cold email tip from Matt |
| **B2B Database** ($49/mo) | Total records available, filter/search walkthrough, export instructions, how often data refreshes |
| **SEO Reports** | 8 sections the report covers, when it arrives, how to read it, sample metric types |
| **AI Chatbot** | "We build and install it on your site within 48 hours" — setup expectations, what the chatbot handles, FAQ |
| **Review Responder** | Waitlist confirmation — "we'll notify you when live" |
| **Missed Call** ($99/mo) | Step-by-step: what happens when a call is missed, instant text fires, custom message coming soon, setup instructions |

Also applies to: Handbook, Grant Finder, Battlecard, Market Intel, Caption Pack, FAQ Refresh — all get the same treatment.

**Files:** `stripe-webhook/index.ts` (rewrite ~15 email blocks)

---

## Batch 3: Fix Broken Access Gating (Field Rep + B2B)

**The problem:** After paying via Stripe, users have no Supabase auth account. Pages call `getUser()` which returns null → locked out.

**The fix — build a `verify-subscriber-access` Edge Function:**
1. User enters the email they paid with on a simple verification form
2. Edge Function checks `b2b_subscribers` table for `email + active = true`
3. Returns a time-limited access token (JWT or signed hash, 24hr expiry)
4. Store token in `sessionStorage` — grant access for that session
5. Welcome email includes a magic access link with pre-filled email token

**This is fully autonomous** — no manual intervention from Matt.

**Files:** New `verify-subscriber-access/index.ts`, update `FieldRepTools.tsx`, `B2BLeads.tsx`

**DB migration:** Add `access_token` and `token_expires_at` columns to `b2b_subscribers`

---

## Batch 4: Product Output Enhancements

### Website Audit ($9) — `instant-audit/index.ts`
Current: 6 scored sections, ~400 words. Enhanced:
- **Add 2 new sections:** Page Speed & Performance (Score X/10), Content Freshness & Quality (Score X/10)
- **Add "Quick Win" vs "Long Game" labels** on every recommendation
- **Add "How to Fix It" steps** — 2-3 specific DIY instructions per section
- **Add 5-Point Action Checklist** at the bottom (prioritized)
- **Upsell block:** "Want us to fix these? Our web design packages start at $499 →" with link
- **Upsell block 2:** "Get a full competitor analysis to see how you stack up → $9"
- Increase `max_tokens` to 1500, upgrade model to `gemini-2.5-flash`

### Competitor Report ($9) — `competitor-report/index.ts`
Current: Market Overview, Competitive Landscape, Review Gap, Positioning, Top 5. Enhanced:
- **Add "Win Rate %" per competitor** (calculated from rating × review count ratio)
- **Add SWOT Summary Table** for the business
- **Add "30-Day Sprint" section** — exact actions for the next 30 days with priority order
- **Add "How to Beat Each Competitor" section** — tactical advice per competitor
- **Upsell block:** "Want us to handle your Google presence? GBP Management $49/mo →"
- **Upsell block 2:** "Get a full website audit to fix what's holding you back → $9"

### GBP Post Pack ($19) — `gbp-post-pack/index.ts`
Current: 30 posts, 8 types. Enhanced:
- **Add seasonal calendar layout** — organize posts by recommended month
- **Add image prompt suggestions** per post (for AI image gen or stock photos)
- **Add "Best Time to Post" notes** per post type
- **Add posting instructions** (step-by-step GBP posting guide)
- **Upsell block:** "Want us to post these automatically? GBP Autopilot $49/mo →"

---

## Batch 5: Customization Fields (Make Products Worth the Price)

### Missed Call Text ($99/mo) — Add Custom Message
- `MissedCallSaaS.tsx`: Add `customMessage` textarea (160 chars, with placeholder: "Hey, I just missed your call — I'll call you right back!")
- `create-missed-call-subscription/index.ts`: Accept + pass `customMessage` in Stripe metadata
- `stripe-webhook`: Store `custom_message` in `missed_call_clients`
- **DB migration:** Add `custom_message` column to `missed_call_clients`

### GBP SaaS ($49/mo) — Client Preferences
- `LocalMarketing.tsx`: Add 3 fields to signup form: Posting Tone (dropdown), Content Focus (text), Topics to Avoid (text)
- `create-gbp-subscription/index.ts`: Pass preferences in metadata
- `stripe-webhook`: Store in `gbp_saas_clients` (new columns)
- `gbp-saas-poster/index.ts`: Fetch client prefs from DB, inject into AI prompt per client
- **DB migration:** Add `post_tone`, `content_focus`, `content_avoid` columns to `gbp_saas_clients`

### Social Media AI ($199/mo) — Client Preferences
- `SocialMediaAI.tsx`: Add brand_voice, content_focus, content_avoid, platform preferences
- `create-social-media-checkout/index.ts`: Pass in metadata
- `social-media-poster/index.ts`: Use per-client prefs in generation prompt
- **DB migration:** Add `brand_voice`, `content_focus`, `content_avoid` columns to `social_media_clients`

---

## Batch 6: SEO Reports Delivery + Admin Demo Fix

### SEO Reports — Wire Up Delivery
- Verify `seo-audit-report` or `deliver-seo-package` actually generates and sends reports
- If no cron trigger exists, create one (weekly delivery for active clients)
- If it needs a manual trigger, add an admin button in the dashboard

### Admin Demo Tab
- Debug `AdminDemoLinkGenerator.tsx` — find why demo names aren't rendering
- Fix data fetching or display logic

---

## Infrastructure Notes (Matt's Manual Actions)

- **Resend:** Upgrade from free plan (100/day) before going live — `resend.com/settings/billing`
- **STRIPE_SECRET_KEY:** Already present in Lovable Cloud secrets (confirmed)

---

## Execution Order

| Batch | Items | Impact |
|---|---|---|
| 1 | Pricing + gates | Stops broken products from taking money |
| 2 | Email overhaul | Every paying customer gets a real welcome |
| 3 | Auth gating fix | Field Rep + B2B subscribers can actually use what they paid for |
| 4 | Product enhancements | Audit, competitor, GBP pack deliver 3x more value with upsells |
| 5 | Customization fields | Products justify their monthly pricing |
| 6 | SEO delivery + admin fix | Remaining loose ends |

Each batch is 1-2 implementation messages. Total: ~6 rounds.

