## Direct Answers To Your Questions

**1. Are these real leads / real contractors?**
- **John Doe / Jane Smith / Robert Johnson / Maria Garcia / Tom Wilson** = **DEMO seeds** (`source='demo_seed'`, `is_demo_record=true`, `email=demo.*@example.com`). Inserted on 2026-04-19 to make the dashboard look populated.
- **Patricia Nguyen / Robert Washington / Angela Moretti / David Thompson / Mike Henderson / Sarah Kowalski / James Rivera** = **manually added test leads** (`source='admin-manual'`, fake @gmail/@yahoo addresses). Not real homeowners.
- **Real leads** = 0. **Real paying contractors** = 0 (DB has 3 contractor_clients rows total, none active/paying).
- "Detroit Plumbing Pros" showing on the locked Detroit cards = a **demo contractor seed**, not a real customer.

**2. Why are some territories locked / what does "Priority" mean?**
- 🔒 **Locked (green)** = a contractor row in `contractor_clients` is assigned to that territory (`active_contractor_id` is set). No one else can claim it. To **unlock**: set `active_contractor_id = NULL` on that `contractor_lead_sites` row (we'll add an "Unlock" button).
- 🔓 **Unlocked (amber)** = no contractor assigned, available to sell.
- ⚡ **Priority** = hard-coded in the file: `["hvac-warren", "plumbing-detroit", "hvac-sterling-heights", "roofing-troy", "electrician-detroit"]`. These are the 5 territories Matt wanted to sell first. Empty priority territories trigger the amber "Run Prospector" action card.

**3. What is "FB Page ID"?**
The contractor's Facebook business page numeric ID. When that contractor runs Facebook Lead Ads, Meta posts the leads to your webhook tagged with their page ID — pasting it here routes those FB leads into this territory automatically. Find it at `facebook.com/[their-page]/about → Page Transparency`. Optional — only matters if the contractor uses FB Lead Ads.

**4. Can we cold-SMS / cold-email contractors with leads? Is it legal?**
- **Cold EMAIL to business contractors**: ✅ **Legal under CAN-SPAM** if (a) accurate "from" line, (b) clear unsubscribe link, (c) physical postal address in footer, (d) no deceptive subject. B2B is the easiest CAN-SPAM use-case.
- **Cold SMS to business contractors**: ⚠️ **Risky.** TCPA + the carriers' A2P 10DLC rules treat unsolicited SMS to *cell numbers* as spam regardless of whether the recipient is a business. Carrier filtering will kill it within ~50–200 messages and you can be fined $500–$1,500 per text. Your A2P brand (work line +13139921219) gets flagged.
- **Safe SMS playbook** (what we'll build): cold *email* first → reply or click = **express written consent** → then SMS the lead offer. We log the consent timestamp + source so it's TCPA-defensible.
- **Recommendation**: Cold **email** the lead offer to scraped contractors. Only SMS contractors who replied "interested" or clicked the buy-link.

---

## What We'll Build

### A) Information Box on the Contractor Leads tab
A dismissible "📖 How This Tab Works" panel at the top with 7 numbered steps + a glossary explaining: Live Lead Feed, Demo vs Real leads, Territory Status, FB Page ID, Lock/Unlock, Priority, Sell button, Stuck status, Delivered status, Action Queue, Prospector. So you never have to re-ask.

### B) New Sub-Tab: **"Contractor Outreach"** (cold-email leads to scraped contractors)
A new section under Contractor Leads with 4 panels:

1. **Contractor Database** (`contractor_outreach_prospects` table)
   - Columns: business_name, owner_name, trade, city, state, email, phone, website, source, scraped_at, enriched_at, email_verified, last_emailed_at, last_smsed_at, reply_status, consent_for_sms (bool + timestamp + source), unsubscribed_at
   - RLS: admin-only

2. **Scrape Contractors** panel — calls existing `contractor-prospector` edge function (already built, uses Google Maps + DataForSEO) to pull contractors by trade + city. Writes into `contractor_outreach_prospects`.

3. **Enrich** panel — runs the unified 6-stage waterfall (Snov → Apollo → pattern-verify → Hunter → PDL → site_scrape) you already have for agency outreach. Reuses `agency-contact-enrich` pattern. Fills owner email + verifies it.

4. **Sell Lead via Cold Email** — on any unclaimed lead in the Live Feed, new "📧 Email to Contractors" button. Opens dialog: pick how many contractors to email (matched by trade + 25mi radius), preview the AI-drafted email (Lovable AI Gemini, with project teaser + Stripe buy-link), one-click send via Resend from `matt@detroitwebagent.com`. CAN-SPAM compliant footer (DWA address, unsubscribe link).

5. **SMS Path (consent-only)** — only contractors with `consent_for_sms=true` (got it because they clicked the buy-link or replied "yes") appear here. Uses existing `_shared/twilio.ts` (TCPA-safe).

### C) Quick Wins on the existing Territory Grid
- Add **🔓 Unlock** button on locked territory cards (clears `active_contractor_id`).
- Add **🗑️ Clear Demo Leads** button at top of Live Lead Feed → deletes all `is_demo_record=true` rows so you only see real ones.
- Add **"DEMO" badge** on demo lead rows so you can tell at a glance.

---

## Technical Details

**New migration** (`20260427_contractor_outreach_prospects.sql`):
```sql
CREATE TABLE public.contractor_outreach_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  owner_name text,
  trade text NOT NULL,
  city text, state text DEFAULT 'MI',
  email text, email_verified boolean DEFAULT false,
  phone text, website text,
  source text, -- 'google_maps', 'dataforseo', 'manual'
  scraped_at timestamptz DEFAULT now(),
  enriched_at timestamptz,
  enrichment_trace jsonb DEFAULT '[]'::jsonb,
  last_emailed_at timestamptz, last_smsed_at timestamptz,
  email_send_count int DEFAULT 0,
  reply_status text, -- null, 'interested', 'not_interested', 'unsubscribe'
  consent_for_sms boolean DEFAULT false,
  consent_source text, consent_timestamp timestamptz,
  unsubscribed_at timestamptz,
  notes text,
  CONSTRAINT outreach_prospects_email_unique UNIQUE (email)
);
ALTER TABLE public.contractor_outreach_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON public.contractor_outreach_prospects
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admins full access" ON public.contractor_outreach_prospects
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_outreach_prospects_trade_city ON public.contractor_outreach_prospects(trade, city);
CREATE INDEX idx_outreach_prospects_email ON public.contractor_outreach_prospects(email) WHERE email IS NOT NULL;
```

**New edge functions:**
- `contractor-outreach-scrape` — wraps `contractor-prospector` output → writes to new table
- `contractor-outreach-enrich` — reuses the 6-stage enrichment waterfall
- `contractor-outreach-email-blast` — drafts AI email with lead teaser + Stripe `create-marketplace-lead-checkout` link, sends via Resend (CAN-SPAM compliant). Marks `email_sent_at` on the lead.
- `contractor-outreach-unsubscribe` — public endpoint for one-click unsub link

**New components:**
- `src/components/admin/ContractorLeadsInfoBox.tsx` — the explainer panel
- `src/components/admin/ContractorOutreachPanel.tsx` — the new sub-tab UI

**Modified:**
- `src/components/admin/AdminContractorLeads.tsx` — mount InfoBox + OutreachPanel + add Unlock button + Clear Demo button + DEMO badge

**Compliance guardrails baked in:**
- Every cold email gets `Unsubscribe: <mailto>` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers
- Footer: "Detroit Web Agency · [physical address] · Unsubscribe"
- SMS path checks `consent_for_sms=true` AND `unsubscribed_at IS NULL` before sending
- All sends logged to `system_comms_log` (existing audit table)
- Hard cap: 100 cold emails/day to stay under Resend reputation thresholds

---

## What This Does NOT Do
- Does NOT cold-SMS contractors without consent (illegal + carrier-suicide).
- Does NOT touch demo data automatically — you click "Clear Demo Leads" when ready.
- Does NOT auto-charge contractors — they still click the Stripe buy-link in the email.

Approve and I'll build it.