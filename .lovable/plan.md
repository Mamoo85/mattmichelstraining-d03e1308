## Cold Email Quality Audit — Findings & Fix Plan

I audited the cold email system end-to-end (102 outreach/drip functions, the shared `dwa-email.ts` sender, recent `email_send_log` activity, and the three emails in your screenshots). Here's what's actually happening and what I'll fix.

---

### Finding 1 — Wrong industry pitched (clarity bug)

**Screenshot evidence:** "We help **manufacturing** owners near AJ Rose Manufacturing Co…", "three other **commercial property management** owners…"

**Root cause:** `supabase/functions/outreach-followup-drip/index.ts` line 24:
```ts
const trade = industry || "contractor";
```
Whatever string is in `outreach_leads.industry` gets dropped verbatim into the body. So a manufacturer gets pitched as a manufacturer, even though Missed-Call/Dead-Lead Reactivation/permit signals are **trades/contractor** offers. A factory owner reads "we help manufacturing businesses capture missed calls" and immediately knows the email isn't for them.

The D7 body also says "**near** {companyName}" referring to other owners "near" the recipient's own company — confusing phrasing.

**Fix:**
- Add an `isTradesIndustry()` whitelist (HVAC, plumbing, electrical, roofing, gutters, pest, restoration, exterior, foundation, demo/junk, tree, painting). If industry isn't in the whitelist, **skip** the email entirely (don't pitch contractors-only product to a factory).
- Rewrite D7 opener: "Three other {city} {trade} owners kicked off a free week this week" — use city, not "near {their own company}".
- Same audit pass on `techalert-followup-drip` and `hoa-cold-outreach`.

---

### Finding 2 — No links in plain-mode emails (intentional but broken)

**Root cause:** `supabase/functions/_shared/dwa-email.ts` lines 209–219:
```ts
if (opts.plainMode) {
  html = opts.bodyHtml;   // CTA block skipped entirely
} else {
  html = dwaWrap(`${visuals}${opts.bodyHtml}\n${ctaBlock}`);
}
```
`outreach-followup-drip` passes `plainMode: true` to look human (avoid spam filters), and the body has no inline link — so `ctaUrl` (the trial signup URL) is built and passed but **never rendered**. The recipient has no way to click through; they can only reply "YES."

This was an intentional spam-avoidance choice, but it kills self-serve conversions and leaves Matt as the only path to start a trial.

**Fix:** In plain mode, append a single discreet plaintext link at the end of the body — looks human, still clickable:
```
Or start it yourself in 60 seconds:
https://detroitwebagent.com/start-trial?...
```
One bare URL per email is the sweet spot for inbox placement (low spam risk, high CTR). Apply across all `plainMode: true` callers.

---

### Finding 3 — Duplicate sends (confirmed in production)

**Evidence from `email_send_log` last 7 days:**

| Recipient | Sends | Templates | Window |
|---|---|---|---|
| info@motorcityplumber.com | **4** | siteradar_cold_blast, techalert_cold_d0 | 4 days |
| info@absoluteroofing.com | 3 | siteradar_cold_blast (×3 same day) | 06:47 → 15:01 same day |
| info@bovaelectric.com | 3 | siteradar_cold_blast (×3 same day) | same day |
| corporateoffice@prmg.net | 3 | dwa_product_blast_missed_call, multi_service_pitch_1, web_drip_d1 | 14h |
| (12 more contractors) | 3 each | siteradar_cold_blast same template, same day | 8h apart |

**Two distinct duplicate causes:**

**A) `siteradar-cold-blast` has no email-level dedup.** It checks `isBlocked()` (suppression/unsubscribe) but does NOT check `email_send_log` for prior sends. The autoscaler firing it 2–3× per cycle re-sends the same template to the same address hours apart.

**B) Cross-product collision.** Same prospect lives in `outreach_leads`, `contractor_clients` enrichment pool, `siteradar` prospect list, and `dwa-product-blast` queue. Each blaster runs independently with its own dedup scoped to its own table. Result: a roofer gets a SiteRadar pitch at 6am, a Missed-Call pitch at 11am, and a TechAlert pitch the next morning.

**Fix:**
1. Add a shared helper `_shared/cold-email-dedup.ts` with `wasContactedRecently(sb, email, days = 5)` querying `email_send_log` for any send (any template) in the window.
2. Wire it into all cold blasters: `siteradar-cold-blast`, `techalert-outreach`, `dwa-product-blast`, `contractor-outreach-email-blast`, `outreach-email-blast`, `multi-service-drip`, `web-design-drip`, `mortgage-radar-outreach`, `mortgage-radar-lo-blast`, `marketplace-outreach-blast`, `fielddesk-cold-blast`, `hoa-cold-outreach`, `counsel-cold-outreach`, `neo-outreach`. (~14 callers)
3. Hard rule: **max 1 cold email per recipient per 5 days across all products.** Drip follow-ups (D3/D7/D14) bypass this since they're scheduled by `last_contact_date`, not blasted.
4. `outreach-followup-drip` already has a per-recipient frequency cap (line 154-162) but allows up to 2 sends/7d — tighten to 1 cold + drips only.

---

### Finding 4 — Subject line clarity issues

Audit of recent subjects:
- ✅ Clear: "Re: {Company} — still buried in missed calls?", "{First} — 7-day trial"
- ⚠️ Vague: "Last note — {Company}" (no value prop), "Quick question {First}"
- ⚠️ Misleading: "Re:" prefix on a first follow-up implies a prior thread that didn't exist (this is a known cold-email pattern but flirts with deceptive-subject CAN-SPAM territory)

**Fix:** Subject library audit — every subject must answer "what is this email about?" in <50 chars. Drop "Re:" prefix on D3 (use it only when there genuinely was a prior reply). Standardize D14 subject to "{Company} — last note on the 7-day trial".

---

### Finding 5 — Body language clarity (general pass)

Reading through the three screenshot bodies:
- "Just bumping this up — wanted to make sure my note didn't get buried." ✅ Clear.
- "We help commercial real estate broker businesses in Detroit capture missed calls, recover dead leads, and surface live homeowner signals…" ⚠️ Three products in one sentence; recipient has to parse. **Lead with the single biggest pain point** for their industry, save the others for the bullet list.
- "kicked off a free week of Detroit Web Agency" — recipients don't know what "Detroit Web Agency" *is*. **Add a one-line "what we do" descriptor** the first time the brand is mentioned.

**Fix:** Rewrite all 3 follow-up bodies (D3/D7/D14) with the framework:
1. Why this email (specific to their industry/city)
2. One clear value prop (their #1 pain)
3. The 7-day trial offer + what they get (3 bullets max)
4. Single CTA: "Reply YES" + bare clickable URL fallback
5. Signature with phone

---

### Implementation plan

| # | Change | Files |
|---|---|---|
| 1 | Add `isTradesIndustry()` filter; skip non-trades from contractor pitches | `outreach-followup-drip`, `techalert-followup-drip`, `hoa-cold-outreach`, new `_shared/industry-filter.ts` |
| 2 | Append plaintext CTA URL when `plainMode: true` | `_shared/dwa-email.ts` |
| 3 | New `_shared/cold-email-dedup.ts` + wire into 14 cold blasters | new shared + 14 edge fns |
| 4 | Rewrite D3/D7/D14 subjects + bodies for clarity | `outreach-followup-drip`, `techalert-followup-drip` |
| 5 | Tighten frequency cap from 2/7d → 1/5d | `outreach-followup-drip` |
| 6 | Add "what is DWA" one-liner on first brand mention | drip/blast bodies |

No DB migrations needed. All changes are edge-function code. Will deploy via Lovable after merge.

### Out of scope (call out, do not change)

- The autoscaler firing functions multiple times per hour is fine — dedup at the email level is the right place to fix this, not at the cron level.
- The "Re:" prefix on D3 is industry-standard cold-email practice; I'll keep it but only on the bumping-up follow-up.
- Suppression/unsubscribe (`isBlocked`) is already correct — no change needed.