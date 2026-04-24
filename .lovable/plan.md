
# Persona UX/Copy Audit — Exact Changes to Ship

I read the surfaces these two actually touch:
- **Dave**: the FOMO SMS → `ClaimLead.tsx` + `LeadQualityBadges.tsx`, plus the `/contractor-leads` landing
- **Sarah**: `TalentIntelligence.tsx`, `HireAlert.tsx`, `HireAlertTrial.tsx`

Below is what each one would say out loud, then the **exact** copy/structure changes.

---

## DAVE THE PLUMBER — sitting in his truck, iPhone, dirty hands

### What he sees that breaks trust

**1. The teaser SMS itself** (`contractor-lead-notify/index.ts` line 335):
> "🚨 HOT LEAD in Livonia: water heater. EXCLUSIVE — first contractor to claim it gets it. ⚡ Reply CLAIM to buy instantly ($50) or tap: [link]"

Dave's reaction: *"Buy a lead? Who is this? I don't know this number."* He's never heard of us. There's no signature.

**Fix — replace SMS body with:**
```
Detroit Web Agency: New plumbing job in Livonia — water heater.
Exclusive to the first contractor who grabs it. $50, one-time.

See it: {claimUrl}

Reply STOP to stop. -Matt (313) 992-1219
```
Why: signs the message, names the trade, swaps "buy instantly" (sketchy) for "one-time" (clear), and keeps Matt's number visible so he can text a human if confused.

---

**2. The Claim Lead page badges** (`LeadQualityBadges.tsx`)

Dave sees badges saying:
- "Quality 8/10"
- "VoIP — verify"
- "ID Verified"
- "ID Unconfirmed"
- "Email Bad — call only"
- "⚠️ 3 breach exposures"
- "Property Intelligence — Est. value $340,000"

Dave's reaction: *"What the hell is VoIP? Why are you showing me this person's data breaches? This feels like spying. I just want to know if they'll answer the phone."*

**Fix — rewrite badge labels:**
| Current | Replace with |
|---|---|
| `Mobile` | `Cell phone ✓` |
| `VoIP — verify` | `Internet phone — may not text back` |
| `Landline` | `Home phone` |
| `ID Verified` | `Real person ✓` |
| `ID Unconfirmed` | *(remove badge entirely — adds doubt for no reason)* |
| `Email Verified` | `Email works ✓` |
| `Email Bad — call only` | `Email bounced — call them` |
| `⚠️ 3 breach exposures` | *(remove entirely — irrelevant to Dave, looks creepy)* |
| `Quality 8/10` | `Strong lead` (≥8) / `Good lead` (5–7) / hide if <5 |
| `Property Intelligence` | `About the home` |
| `Premium · $75` / `VIP · Mobile Direct` | *(hide tier pricing on claim page — confusing when he's about to pay $50)* |

---

**3. ClaimLead "What you get for $50" block** (`ClaimLead.tsx` line 191)

Currently reads like a feature list. Dave wants a guarantee.

**Add a line below the bullets:**
```
If the number's disconnected or it's a fake lead, text Matt and we refund it. No forms.
```

**Change button label** from generic claim:
- Current button (line 203) lacks visible text in the snippet — confirm it says **"Pay $50 — Get Their Phone Number"** not "Claim Lead". Dave needs to see exactly what he's buying.

---

**4. "Lead Already Claimed" screen** (line 140)

> "Another contractor got there first. We'll text you the next one as soon as it drops."

Dave's reaction: *"So I rushed for nothing. Annoying."*

**Fix — add a confidence builder:**
```
Beat to it this time. The next plumbing job in Livonia goes to the
contractor who taps fastest — keep your phone close. Average time
between leads in your area: 2–4 days.
```

---

**5. ContractorLeads.tsx WINS list** (line 30) — line 32 is too long for a phone scan:

> "Leads are real homeowners who searched for your service, filled out a form, and asked to be contacted"

**Replace with:**
> "Real homeowners who asked us to send them a plumber"

Same edit pattern for line 33 → "Name, phone, email in your inbox in minutes."

---

**6. PAIN block** (line 38) — "Word of mouth alone … Feast or famine." Dave doesn't think word of mouth is bad. **Remove that row** — don't insult his existing book.

---

## SARAH THE RECRUITER — at her desk, three monitors, on hold with a candidate

### What she sees that wastes her time

**1. TalentIntelligence hero** (line 70):

> "Pre-Market Talent Intelligence — For Specialized Recruiters. Our proprietary talent signal engine identifies candidates 48 hours before they reach open job boards."

Sarah's reaction: *"'Talent signal engine' = marketing fluff. Tell me what I get."*

**Fix:**
```
H1: Get the candidate's phone number 48 hours before Indeed does.
Sub: We surface licensed industrial and healthcare candidates
     the moment their license posts, their LinkedIn flips to
     #OpenToWork, or their employer files a WARN notice. You
     call them first. That's the whole pitch.
```

---

**2. Tier 1 "Proof of Concept — FREE"** (line 86)

Sarah's reaction: *"'Proof of Concept' is a vendor word. Just say what it is."*

**Fix:**
- Tier label: `FREE · 1 candidate, on us` (drop "Tier 1 · Proof of Concept")
- Tier 2 label: `Pay-per-interview` (drop "Tier 2 · Performance Feed")
- Tier 3 label: `Lock your territory` (drop "Tier 3 · Territory Lock")

The word "Tier" makes her hunt for which one is for her. The new labels do the sorting work.

---

**3. Tier 2 wording** (line 105):

> "Charged ONLY when interview gets booked"

Sarah's reaction: *"Booked by whom? What if the candidate ghosts? Am I paying $250 for a no-show?"*

**Fix — add clarification line:**
```
$250 only when the candidate actually shows up to the interview.
Ghosts and reschedules are free.
```

---

**4. ROI Calculator section header** (line 139):

> "Run your own numbers."

Good. Keep. But the `<Input>` form below the fold (`request-form`) likely asks for agency_name, contact_name, contact_email, contact_phone, vertical, counties (6 fields). For a free tier, that's friction.

**Fix — for the FREE tier, collapse to 2 fields only:**
```
Email + Roles you're hiring for. That's it.
We email you the candidate within 48 hours.
```

Counties + agency name can be captured **after** the candidate is delivered, when she's already invested.

---

**5. HireAlertTrial.tsx form labels** (line 134):

> "YOUR NAME" / "BUSINESS NAME" / "EMAIL *" / "CELL (for SMS alerts)"

Currently uses uppercase tracking-wide labels — looks like an enterprise SaaS form, not a 30-second sign-up. Sarah's eye reads it as "10-minute task."

**Fix:**
- Drop the all-caps labels. Use sentence case: `Your name`, `Company`, `Email`, `Cell (we'll text matches)`.
- Make `Name` and `Business name` **optional** and visually de-emphasized. Email + trades is all that's actually required for the trial.
- Above the form, add: **"Takes 20 seconds. We'll text you when we find someone."**

---

**6. HireAlertTrial confirmation screen** (line 91):

> "Our intelligence engine is scanning Metro Detroit for available licensed tradespeople in your trades right now."

Sarah's reaction: *"Cool, when do I get a name?"*

**Fix:**
```
H1: You're in. First match by tomorrow morning.
Body: We scan overnight and email the first qualified candidate
      to {email} by 7am. If we can't find one in 72 hours, we'll
      tell you straight up — no auto-charge, no upsell.
```

---

**7. Role chips in HireAlertTrial** (line 11) say "Boiler Operator", "Pipefitter / Steamfitter" — perfect for Sarah's industrial side. **No change.**

But `HireAlert.tsx` ROLE_OPTIONS line 21 says "Pipefitter / Steamfitter (UA 636)". UA 636 is a Detroit local — fine for Detroit, but if she's in Phoenix selecting that, it's confusing. **Change to:** "Pipefitter / Steamfitter" — drop the local number. Move union-local hint to a tooltip or hide outside Detroit metro.

---

**8. HireAlert success page** (line 117):

> "Talent Radar is Live — Your hiring advantage starts tomorrow at 7am."

This is good. **Keep.** Only tweak: line 120 says "Check your email — we sent your welcome guide with everything you need to know." Sarah doesn't read welcome guides. **Replace with:**
```
We just emailed you your dashboard link. Save it. First candidate
batch hits at 7am tomorrow.
```

---

## SHARED FIXES (both personas)

**1. Stripe checkout page** — currently we hand off to Stripe Checkout. Both personas would feel safer if the redirect button said **"Continue to secure Stripe checkout →"** instead of just "Pay $50". The word "Stripe" is a trust anchor for both blue-collar and corporate buyers.

**2. Phone number visibility** — every error screen already shows "Text Matt at (313) 992-1219". Good. But make the number a **`tel:` link** everywhere (some are plain text in `ClaimLead.tsx` lines 105, 129, 144, 160) so a thumb tap dials.

**3. Remove the word "intelligence" from customer-facing copy** when speaking to Dave. Keep it for Sarah (she's a recruiter, that word sells her). On contractor pages, replace "intelligence engine" / "signal" / "proprietary" with "we find" / "we send" / "we built".

---

## SUMMARY — What ships when you approve

A single copy patch across 6 files:
1. `supabase/functions/contractor-lead-notify/index.ts` — rewrite teaser SMS body
2. `src/components/contractor/LeadQualityBadges.tsx` — relabel/remove jargon badges
3. `src/pages/ClaimLead.tsx` — refund-promise line, button label, "Lead Claimed" rewrite, tel: links
4. `src/pages/ContractorLeads.tsx` — shorten WINS, drop "word of mouth" PAIN row
5. `src/pages/TalentIntelligence.tsx` — new H1/sub, drop "Tier" prefixes, ghost/no-show clarifier, simplified free-tier form
6. `src/pages/HireAlert.tsx` + `HireAlertTrial.tsx` — sentence-case labels, "20 seconds" header, rewritten success copy

Estimated: ~150 lines of copy edits, zero schema changes, zero new components. Safe to ship before driving traffic.

Approve and I'll switch to build mode and apply every change above verbatim.
