

## Plan: Fix Growth Signals crash + ship 10 distribution channels for the 42 sellable signals

Keep everything from the prior plan (crash fix + PDF dossier generator + Track A/B/C strategy). This addendum answers the real bottleneck: **how does a supply-house branch manager who has never heard of Detroit Web Agency end up clicking "Buy this signal for $50"?**

All 10 channels below are **additive**. None of them touch the working revenue products (PPL, FieldDesk, TechAlert, Missed Call, Dead Lead). They only read from `industry_pulse_signals` and `growth_radar_signals` and write to net-new tables/functions.

---

### Part 1 — Growth Signals crash fix (unchanged from prior plan)

`src/components/admin/AdminGrowthSignals.tsx` only:
- Pagination 25/page (default visible 25, "Show 25 more" button)
- Collapse `recommended_pitch` + `source_urls` behind `▾ Details` toggle
- Cap `predicted_needs` chips at 3 visible + `+N more`
- Lower initial fetch 200 → 80

---

### Part 2 — PDF Dossier Generator (Track A enabler — unchanged)

New edge function `generate-signal-dossier` + `📄 Dossier` button on each Growth Signal card. Renders 1-page branded PDF to `/mnt/documents/dossier-<company>-<signalid>.pdf`. Uses Lovable AI (Gemini 2.5 Flash) to format. ~3 hr build.

---

### Part 3 — 10 Distribution Channels (the new section)

Each channel answers four questions: **medium · what the buyer sees · why they click · build cost**. Ranked by realistic conversion velocity for a cold, unknown-brand sale.

#### 1. Direct cold email to named buyer at supply house — "free sample" packet
- **Medium**: Personal email from `matt@detroitwebagent.com` to a named branch manager (Behler-Young, Standard Supply, Airgas, ABC Supply, Alro Steel)
- **What they see**: Subject `Acme Steel just hired 12 welders — thought your Warren branch should know`. Body: 4 sentences + the actual 1-page PDF dossier attached **for free**. CTA: "Reply YES and I'll send you 5 more like this for $50 total."
- **Why they click**: The free sample IS the proof. They open the PDF, see a real Detroit company hiring real welders this week, and the value is undeniable. $50 for 5 = below their discretionary spend ceiling.
- **Build**: New edge function `dossier-cold-outreach` — pulls top signals filtered by vertical, uses `_shared/cheap-extract.ts` to find branch managers via existing OSINT stack, fires through `email_reply_drafts` ghost delay queue + admin approval gate (TCPA-safe pattern already in use). New table `dossier_outreach_log` for dedup.

#### 2. LinkedIn DM blitz from Matt's personal profile
- **Medium**: LinkedIn 1st/2nd connection DMs to operations directors at industrial distributors
- **What they see**: "Hey [Name] — built a tool that flags Metro Detroit manufacturers right when they start hiring (= about to spend on consumables). Found 42 this week. Free sample dossier?"
- **Why they click**: LinkedIn DM = warmer than cold email, Matt's personal profile (Grosse Pointe, 10+ yr B2B sales) = credible local. Free dossier ask is low-commitment.
- **Build**: Admin component `AdminLinkedInBlitz.tsx` — generates personalized DM copy per signal vertical, copy-paste modal (manual send to stay TCPA-clean). No automation, no API key needed.

#### 3. Public "Detroit Industrial Pulse" weekly newsletter (free, gated upgrade)
- **Medium**: Free weekly email digest at `/industrial-pulse` showing 3 anonymized signals per week ("Welding contractor in Macomb County hired 8 — name available to subscribers")
- **What they see**: Tease the company name + city + role count. Blur the actual company. CTA: "Unlock all 42 this week — $50 one-time, or $199/mo for the firehose."
- **Why they click**: Curiosity gap. They want to know WHICH welding shop. The blurred name is the hook.
- **Build**: New page `src/pages/IndustrialPulse.tsx` (signup form → Resend list) + `industrial-pulse-weekly` cron (Tuesdays 7am ET, reads `industry_pulse_signals` confidence ≥7, emails subscribers). Stripe checkout reuses existing `create-growth-signal-checkout` pattern.

#### 4. Targeted Google Ads on supplier-intent keywords
- **Medium**: Google Search Ads bidding on `"detroit manufacturing leads"`, `"michigan industrial sales prospects"`, `"hvac distributor leads detroit"`
- **What they see**: Ad headline `42 Metro Detroit Manufacturers Hiring This Week`, description `Names, addresses, predicted spend. $50/dossier or $199/mo. Free sample.`. Lands on a dedicated `/growth-signals` page with 3 anonymized signal cards + "See all 42" CTA.
- **Why they click**: Specific number + local + buyer-intent keyword = high quality score, low CPC ($2–4 in this niche). Free sample lowers commit.
- **Build**: New page `src/pages/GrowthSignalsLanding.tsx` (mobile-first, DWA dark theme, follows Grease Slide pattern). Google Ads campaign created manually by Matt. UTM tracking added to checkout flow.

#### 5. Cold-call script to top 20 distributors (Matt makes the calls)
- **Medium**: Phone — Matt calls branch managers directly using DWA work line `+13139921219`
- **What they see/hear**: 30-second pitch: "I've got a list of 12 Metro Detroit manufacturers hiring welders this week. Would your Warren branch want me to email it over for free? If you like it, $50 for 5 more next week."
- **Why they click (or say yes on the call)**: Zero risk free sample, local guy, specific data. Matt's 10+ years B2B field sales background = his strongest channel.
- **Build**: New admin tab `AdminCallList.tsx` — generates a daily call sheet with company name + decision-maker + phone + 1-line opener pulled from each signal. Logs outcomes to `call_outreach_log`. No automation.

#### 6. Trade association partnership (Detroit Regional Chamber, ABC of Michigan, MCA Detroit)
- **Medium**: Co-branded email blast through their member newsletter — Matt provides the content, they hit send
- **What members see**: Trade association branding ("MCA Detroit Member Spotlight: Free Industrial Hiring Intelligence from Detroit Web Agency"). 2 free signals + "$199/mo for members, normally $249."
- **Why they click**: Trust transfer. Member newsletters get 30%+ open rates. Trade association endorsement removes "unknown company" objection entirely.
- **Build**: Admin component `AdminPartnerSignalShare.tsx` — generates a co-brandable HTML block. Partner-specific landing page `/p/<slug>` with their logo. Stripe coupon code per partner. 1 hr build per partner once template exists.

#### 7. SMS alert subscription for impatient buyers ($29/mo "Pulse Alerts")
- **Medium**: SMS sent same-hour the signal lands in `industry_pulse_signals`
- **What they see**: `🚨 Acme Steel just posted 12 welder openings (Warren). Free dossier: dwa.link/s/abc123` — replies with TCPA opt-out language built in
- **Why they click**: Speed. Supply houses fight for first-mover advantage. SMS is the fastest channel. Free first dossier removes friction.
- **Build**: New page `/pulse-alerts` ($29/mo Stripe checkout) + `pulse-alert-sender` edge function triggered when new high-confidence signal lands. Reuses `_shared/twilio.ts` (TCPA quiet-hours enforcement already built in). Bypass whitelist NOT needed — these are paid subscribers with explicit consent.

#### 8. Postcard campaign to supply house branch addresses (reuse Postcard Engine)
- **Medium**: Physical postcard via Lob API (existing infrastructure — see `mem://features/postcard-campaign-engine`)
- **What they see**: Glossy 6x9 postcard, front: `42 Metro Detroit Manufacturers Hired Welders This Week`. Back: QR code → personalized landing page with their company name + 3 free signals + Stripe checkout.
- **Why they click**: Tangible. Sits on a desk for days. QR → mobile checkout = ~4% conversion in B2B postcard benchmarks. Already-built infrastructure = ~$0.85/postcard cost.
- **Build**: New `dossier-postcard-cron` — pulls 50 supply house addresses/week from existing LARA scraper output, generates QR-coded landing pages, fires through Lob. Reuses `postcard_send_log` table.

#### 9. Reddit/Facebook industry group "value drop" posts
- **Medium**: Manual posts in r/Detroit, r/smallbusiness, MI HVAC Contractors Facebook group, Detroit Manufacturing Network LinkedIn group
- **What they see**: Plain-text post: "I built a tool that watches 16 public data sources for Metro Detroit manufacturers about to hire. Found 42 this week. Posting 5 free dossiers as samples — DM if you want one." Includes 1 redacted screenshot.
- **Why they click**: Community trust + free value + visible proof. The DMs that come back become Track A buyers.
- **Build**: Zero code. Admin component `AdminCommunityDrop.tsx` generates the post copy + 5 redacted dossier screenshots weekly. Matt copy-pastes manually.

#### 10. Affiliate / referral kickback to existing PPL contractors
- **Medium**: SMS to all current Contractor Leads ($399/mo) clients — they refer their supplier
- **What contractors see**: `Hey — know your roofing supply rep at ABC? I built something they'd like. Refer them and you get $50 off next month if they buy.` One-tap forward link.
- **Why it works**: Contractors talk to supply houses every week. Cheapest possible warm intro. $50 referral fee << $50 a-la-carte revenue + $199/mo recurring potential.
- **Build**: `referral_kickback` table + admin trigger button. SMS uses existing `system_comms_log` + admin-approval gate. ~2 hr build.

---

### Recommended sequencing (channels 1, 5, 9 first — zero infra, 100% Matt-effort)

| Week | Ship | Why first |
|---|---|---|
| 1 | Crash fix · PDF dossier generator · Channel 1 (cold email) · Channel 5 (cold call) · Channel 9 (Reddit/FB) | All three are pure-effort distribution. Validate the offer before building infrastructure. |
| 2 | Channel 2 (LinkedIn) · Channel 6 (trade assoc) · Channel 10 (PPL referral SMS) | Warm channels — leverage existing relationships. |
| 3 | Channel 3 (newsletter) · Channel 4 (Google Ads landing page) | Inbound infrastructure once 1–2 paying customers exist as social proof. |
| 4 | Channel 7 (SMS alerts $29/mo) · Channel 8 (postcards) | Paid/automated channels last — they need the offer already validated. |

---

### Files touched (all additive — no edits to PPL/FieldDesk/TechAlert/Missed Call/Dead Lead code paths)

**Frontend (new):**
- `src/pages/GrowthSignalsLanding.tsx`
- `src/pages/IndustrialPulse.tsx`
- `src/pages/PulseAlerts.tsx`
- `src/components/admin/AdminLinkedInBlitz.tsx`
- `src/components/admin/AdminCallList.tsx`
- `src/components/admin/AdminPartnerSignalShare.tsx`
- `src/components/admin/AdminCommunityDrop.tsx`

**Frontend (edits):**
- `src/components/admin/AdminGrowthSignals.tsx` — pagination + details toggle + dossier button
- `src/pages/DWAAdmin.tsx` — register 4 new admin tabs
- `src/App.tsx` — register 3 new public routes

**Backend (new edge functions):**
- `generate-signal-dossier` (PDF)
- `dossier-cold-outreach` (channel 1)
- `industrial-pulse-weekly` (channel 3, cron)
- `pulse-alert-sender` (channel 7, signal-triggered)
- `dossier-postcard-cron` (channel 8, weekly cron)
- `create-growth-signal-checkout` + `create-pulse-alerts-checkout` (Stripe)

**Backend (edits):**
- `stripe-webhook` — add 3 handlers: `growth_signal_purchase`, `industrial_pulse_subscription`, `pulse_alerts_subscription`
- `supabase/config.toml` — `verify_jwt = false` for new public functions

**Migrations (new tables only — no edits to existing tables):**
- `dossier_outreach_log` — dedup cold emails per company
- `growth_signal_purchases` — Stripe purchase records
- `industrial_pulse_subscribers` — newsletter list
- `pulse_alert_clients` — SMS subscription
- `call_outreach_log` — Matt's call sheet outcomes
- `referral_kickback` — channel 10 tracking

**Safety guarantees:**
- Zero schema changes to: `contractor_leads`, `contractor_clients`, `field_crm_clients`, `field_service_jobs`, `hire_alert_clients`, `hire_alert_candidates`, `missed_call_clients`, `dead_lead_campaigns`, `dead_lead_contacts`
- Zero edits to: `contractor-lead-notify`, `missed-call-handler`, `hire-alert-scanner`, `dead-lead-drip`, `stripe-webhook` existing handlers (only additive new handlers)
- All new SMS routes through `_shared/twilio.ts` → inherits TCPA quiet-hours + opt-out scrub automatically
- All new outbound email routes through `email_reply_drafts` ghost delay → admin approval gate enforced
- New cron jobs use the hardened `safe_cron_validate` wrapper → vault-key validation at deploy time

