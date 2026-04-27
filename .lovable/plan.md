## What's already shipped (from last loop)

These items in your request are **already live** — I'll only mention them so you know we don't duplicate:

- **"How This Tab Works" guide** with Live Lead Feed / Territory Status / Locked / Priority / FB Page ID definitions → `ContractorLeadsInfoBox.tsx` (collapsible at top of the tab)
- **Contractor database by trade** with stored emails + phones → `contractor_outreach_prospects` table (indexed by trade + city), Google Maps scraper, 6-stage enrichment waterfall (Snov → Apollo → pattern-verify → Hunter → PDL → site_scrape)
- **Cold-email send + CAN-SPAM footer** → `contractor-outreach-email-blast` with `List-Unsubscribe` headers and one-click unsub endpoint

## What this plan adds

### 1. Compliance & audit infrastructure (new)

**New table `contractor_outreach_audit_log`** — every send, opt-in, opt-out, suppression hit, and consent change writes one row. Powers the audit timeline UI and gives us a TCPA/CAN-SPAM defense file.

```
id, prospect_id, lead_id, channel (email|sms),
event (sent|opened|clicked|replied|unsubscribed|suppressed|consent_granted),
reason, ip_address, user_agent, created_at, actor (system|admin_user_id)
```

**New table `contractor_outreach_suppression`** — global do-not-contact list. Email or phone-keyed, with source (`unsubscribe_link`, `bounce`, `complaint`, `manual`, `competitor_block`). Every send checks this **before** the gateway call, fail-closed.

```
id, contact (email or E.164), contact_type, reason, source, added_by, created_at
```

**Pre-send compliance gate** — refactor `contractor-outreach-email-blast` and a new `contractor-outreach-sms-send` to:
1. Check `contractor_outreach_suppression` → skip + log `suppressed`
2. Check `unsubscribed_at` on prospect → skip + log
3. **SMS only**: require `consent_for_sms = true` AND consent timestamp within 18 months → else hard-fail with reason
4. **SMS only**: TCPA quiet-hours check (8am–9pm prospect's local time, derived from city)
5. Daily cap enforcement (100 cold emails/day, 50 SMS/day) via count from audit log
6. On send → write audit row before returning

### 2. Suppression list & opt-in UI (new)

New section inside `ContractorOutreachPanel.tsx`:

- **Suppression list manager** — table of suppressed contacts with reason, paste-bulk add, CSV import, manual remove (with admin reason)
- **Consent capture controls** — on each prospect row, "Mark consent received" button (dialog asking: source = reply | click | verbal | written, optional notes) → writes `consent_for_sms=true`, `consent_source`, `consent_timestamp` and an audit row
- **Audit log drawer** — clicking any prospect opens a side drawer with the full event timeline pulled from `contractor_outreach_audit_log` (last 50 events), color-coded by event type
- **Daily-cap meter** — top of panel shows "📧 47/100 emails today · 📱 12/50 SMS today" with progress bars; sends disabled when cap hit

### 3. "Real vs Enriched" provenance info panel (new)

New collapsible card `OutreachProvenancePanel.tsx` mounted directly above the prospect table that explains, in plain English:

- **Where business names come from** — Google Maps Places API (verified business listings) + DataForSEO when available
- **Where emails come from** — labeled by stage of the waterfall, with confidence:
  - `snov` / `apollo` / `hunter` / `pdl` → ✅ verified (provider returned validity score)
  - `pattern-verify` → 🟡 educated guess (pattern matched + SMTP-pinged but not provider-vouched)
  - `site_scrape` → 🟡 found on contractor's website mailto/contact
- **Where phones come from** — Google Maps listing OR provider returned with email
- **What "verified" means in the table** — `email_verified=true` only if a provider returned a `valid` deliverability score; otherwise the email shows with a `guess` chip
- Per-prospect "Show enrichment trace" button → expands the JSON `enrichment_trace` (which providers were tried, in order, with the result of each) so you can audit any single email

This makes it impossible for you to confuse a guess with a verified contact.

### 4. Expanded "What this tab means" guide (additions to existing InfoBox)

Add three new sections to `ContractorLeadsInfoBox.tsx`:

- **"What does Locked under [Company] mean?"** — explains `active_contractor_id`, that locked = sold/assigned, how to **Unlock** (one click clears assignment, contractor keeps history), and how to **Request Access** if a contractor wants to take over a territory another contractor abandoned
- **"How Priority works (in detail)"** — lists the exact 5 priority territories, what triggers the amber action card (priority + 0 contractor for 7+ days), and how to add/remove a territory from priority (currently hard-coded — we'll add an `is_priority` boolean to `contractor_lead_sites` and a toggle on each card)
- **"Exact actions you should take"** decision-tree:
  - Stuck lead → unlock or sell
  - Empty priority territory → run scraper or sell
  - Verified-email prospect → email blast
  - Unverified prospect → enrich first
  - SMS-consented prospect → eligible for SMS sniper

### 5. SMS path — TCPA-hardened (new edge function)

New `contractor-outreach-sms-send` function (per-recipient, no bulk):
- Hard-rejects if `consent_for_sms != true` OR `unsubscribed_at != null` OR suppression hit
- Quiet-hours block (uses prospect city → tz lookup)
- Daily cap 50/day
- Routes through `_shared/twilio.ts` `sendSMS()` (not raw Twilio gateway)
- Always appends "Reply STOP to opt out"
- Writes audit row

UI: SMS column on each prospect row showing one of: 🔴 No consent · 🟡 Consent OK · ✅ Sent today · ⛔ Suppressed

## Files

**New**
- `supabase/migrations/<ts>_contractor_outreach_audit_and_suppression.sql` — 2 tables + indexes + RLS (admin + service_role only) + `is_priority` column on `contractor_lead_sites`
- `supabase/functions/contractor-outreach-sms-send/index.ts`
- `src/components/admin/OutreachProvenancePanel.tsx`
- `src/components/admin/OutreachSuppressionManager.tsx`
- `src/components/admin/OutreachAuditDrawer.tsx`
- `src/components/admin/OutreachConsentDialog.tsx`

**Modified**
- `supabase/functions/contractor-outreach-email-blast/index.ts` — add suppression check, audit writes, daily cap
- `supabase/functions/contractor-outreach-unsubscribe/index.ts` — also write to `contractor_outreach_suppression`
- `src/components/admin/ContractorLeadsInfoBox.tsx` — three new sections
- `src/components/admin/ContractorOutreachPanel.tsx` — mount provenance panel, suppression manager, audit drawer, consent button, daily-cap meter, SMS column
- `src/components/admin/AdminContractorLeads.tsx` — add `is_priority` toggle on each territory card

## Compliance guardrails (final)

- Every outbound message has a matching audit row written **before** the API call returns success
- Suppression check is fail-closed: any DB error → block the send, surface error
- SMS sends require consent + quiet hours + suppression clean — three independent checks, all logged
- Daily caps prevent reputation damage on Resend / 10DLC throttling
- Unsubscribe writes to BOTH the prospect row AND the global suppression list (so re-scraping the same business can't re-add them to a campaign)

Approve and I'll build it.