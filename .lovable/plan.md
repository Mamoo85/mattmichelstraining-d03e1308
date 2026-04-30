
# D.J. Conley Meeting Kit — 60-min Full Pitch (REVISED)

Two existing live demos already shipped — `/demo-djconley-1` (website) and `/demo-djconley-2` (ops command center). This plan generates 3 PDFs + a click-by-click QA, with **the 4 critical fixes baked in**.

---

## The 4 critical fixes (locked in)

### Fix 1 — Defuse the fake-visitor landmine
The script's SiteRadar segment opens with this **mandatory disclaimer line**, said out loud before clicking:

> *"Pat, before I show you this — what's on screen is a demo build seeded with the kind of buyers we already see hitting boiler-shop sites in Detroit. The Stellantis, DMC, and Wayne County rows are placeholders representing real buyer profiles, not actual visits to djconley.com today. Once we install the 1-line script tomorrow, this dashboard fills with YOUR real visitors within 48 hours."*

Then immediate hard pivot to the **real, defensible** Stellantis $2.4M RFP from Buyer Radar (sourced from MITN.info — actual public procurement board). The PDF mirrors this with a footnote on every dashboard screenshot: *"Demo data shown. Live data populates within 48 hours of installation."*

### Fix 2 — Honest, defensible ROI math
Throw out the $147k number. New conservative Year-1 ROI table that adds to **$48,612** — every line defensible:

| Source | Year-1 Value | How it's calculated |
|---|---|---|
| FieldServio software replacement | $14,412 | (config: `yearOneSavings`) — $1,400/mo competitor − $199/mo FieldDesk × 12 |
| 1 new tech hired via TechAlert | $18,000 | Conservative: 1 hire × $1,500/mo billable margin × 12. (Industry avg = 2-3 hires/yr) |
| 2 recovered missed-call jobs | $8,400 | 2 emergency calls × $4,200 avg ticket (boiler emergency repair) |
| 1 small commercial contract from website redesign | $7,800 | 1 service contract × $650/mo × 12 |
| **Year 1 conservative total** | **$48,612** | vs. $7,651 invested = **6.4x ROI** |

The PDF shows the math line-by-line on a dedicated page. The script tells you to walk Pat through each row with your finger.

### Fix 3 — Real close mechanism (3 options, pick at the table)
The kit includes all three so you can read the room:

1. **Stripe Payment Link** (texted at the table) — I'll create a $499 Website Deposit payment link via Stripe and embed the URL + QR code in both the Why-Choose-Us PDF and the script. One tap on Pat's phone → he's paid. (Real Stripe link, real product, generated today.)
2. **30-second LOI email** — pre-written email template loaded into the script PDF as copy-paste text. Subject + body filled in, just needs Pat's name + signature line. Send from parking lot.
3. **Paper LOI** — single-page tear-off at the back of the Business Plan PDF. "I, Pat ___, agree to engage Detroit Web Agency for the DWA Bundle ($596/mo) + Website ($499 one-time) starting [date]. 30-day cancel-anytime." Sign, photo, done.

### Fix 4 — Actual discovery questions (written out, no improv)
The script's 02:00–05:00 block contains these 3 questions verbatim, with follow-up prompts:

1. **"Pat, walk me through last Tuesday — when a boiler call came in at 2 a.m., what actually happened from the phone ringing to the truck rolling?"**
   *(Listening for: paper dispatch, missed calls, on-call confusion, wife answering phone)*
2. **"Of your senior boiler ops, how many are within 5 years of retirement — and what's your plan when they walk out the door?"**
   *(Listening for: hiring panic, no pipeline, "we'll figure it out")*
3. **"When was the last time someone said 'I found you on Google' — and when you check your website on your phone, what do you actually see?"**
   *(Listening for: word-of-mouth dependency, embarrassment about djconley.com, no online lead flow)*

Each question has a script note: *"Shut up. Count to 5 in your head before responding. Take notes on his actual words — quote them back during the pricing reveal."*

---

## What gets generated

### 1. `DJConley_Business_Plan.pdf` — leave-behind (12 pages)
- Cover, executive summary, 4 pains, integrated solution, **conservative $48,612 ROI breakdown** (Fix 2), 7-day timeline, why DWA, **paper LOI tear-off** (Fix 3 option C), competitor comparison appendix
- Every dashboard screenshot footnoted: *"Demo data — live data within 48 hours"* (Fix 1)

### 2. `DJConley_WhyChooseUs.pdf` — the handout (4 pages)
- Hero, one-pager per product, **ROI table + Stripe payment link QR code** (Fix 3 option A), Matt's contact card

### 3. `DJConley_Presentation_Script.pdf` — your cheat sheet (8 pages)
Minute-by-minute with actual words to say:
```
00:00–02:00  Opening
02:00–05:00  3 discovery questions (Fix 4 — verbatim)
05:00–10:00  Pain validation — quote his answers back
10:00–18:00  DEMO #1 → /demo-djconley-1 (website)
18:00–24:00  DEMO #2 → /demo-djconley-2 (ops)
24:00–28:00  SiteRadar segment with mandatory disclaimer (Fix 1)
28:00–35:00  TechAlert — James P. + Kevin M.
35:00–42:00  Buyer Radar — REAL $2.4M Stellantis RFP from MITN.info
42:00–50:00  Pricing reveal + $48,612 walkthrough (Fix 2)
50:00–55:00  Objections (3 scripted answers)
55:00–60:00  THE ASK + close (3 mechanisms — Fix 3, pre-written LOI email)
```

### 4. `DJConley_Walkthrough_QA.md` — pre-meeting verification
- Screenshots of `/demo-djconley-1` + `/demo-djconley-2` at iPad-portrait viewport
- Verify sizzle video loads, candidate names render, djconley.com images resolve
- Offline backup PDF generated in case WiFi fails at their office

---

## Real Stripe close (Fix 3 mechanism)

Before generating PDFs, I'll create a **real Stripe Payment Link** for "DWA Website — D.J. Conley Deposit — $499" using Stripe MCP. The live URL + QR code embeds in the Why-Choose-Us PDF and the script. Pat scans, pays, you have his card on file before you leave.

(Bundle subscription stays as a separate post-meeting checkout — the $499 deposit is the friction-free yes today.)

---

## Technical approach

- PDFs via `reportlab` Python — DJC navy `#1B4F8A` + orange `#E07B39`
- All numbers sourced from `djconley.json` or conservative industry estimates with shown math
- QR code via `qrcode` Python lib pointing to real Stripe link
- Visual QA: every PDF page rendered to JPG, inspected, fixed before delivery
- Browser QA: `browser--navigate_to_sandbox` against preview URL for both demos at 768×1024 (iPad portrait)

## Total time: 8–12 minutes once approved

**Approve and I'll start. The 4 fixes are non-negotiable and locked in.**
