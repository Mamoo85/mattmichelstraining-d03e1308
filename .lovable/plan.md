## What's broken right now

Clicking **Cold Email** on a Growth Signal opens **3 raw `window.prompt()` boxes** and asks you to type in:
1. The supply-house company name
2. The buyer's email address
3. The buyer's contact name

That's why it feels useless — it's making **you** do the prospecting work. There's no list, no suggestions, and the dossier is **not attached** to the email that goes out. The current pitch just *mentions* a free dossier exists.

## What the Dossier actually is (and why it matters)

The **Dossier** is a 1-page printable intelligence brief on the target manufacturer (e.g. Randazzo Mechanical) — it shows: company name + address, exact hiring detail (9x Electrical Permits), predicted spend window (30-day), predicted needs (HVAC equipment, electrical supplies, building materials), and confidence score. Today it opens in a new tab and triggers print.

**Strategic role**: it's the *bait*. The cold email tells a supply-house branch manager "Randazzo is about to spend money on your category — here's the proof, free" and the **dossier IS the proof**. Right now the email *promises* the dossier but never sends it. We'll fix that.

## The Plan — "Cold Email" becomes a one-click Buyer Outreach Modal

### 1. Replace the 3 prompt boxes with a real Buyer Picker dialog

When you click **Cold Email** on Randazzo Mechanical, open a modal that:

- Auto-detects the relevant **vertical buyers** based on the signal's `predicted_needs` (HVAC equipment → HVAC supply houses; Electrical supplies → electrical distributors; Building materials → building product distributors).
- Shows a pre-loaded list of **15–25 real Metro Detroit supply-house contacts** for that vertical, each with: company name, branch manager name, email, city. Sources we already have:
  - `prospect_pool` table (already populated by Apollo + waterfall enrichment)
  - `agency_clients` (existing prospects we've enriched)
  - A new seed list of the top 30 Metro Detroit industrial supply houses per vertical (Granger, Kendall Electric, Madison Electric, Stoneco, R.E. Leggette, etc. — one-time SQL seed)
- Each row has a **checkbox** + **"Send Dossier" button**.
- **Bulk action**: "Send to all selected (N)" — fans out one email per buyer, each personalized to their company name, all queued via the existing 10-min ghost-delay (you still get one consolidated SMS preview + cancel link).

This kills the prompt boxes entirely. You go from "what's the email?" to "send to these 8 HVAC distributors → SMS preview in your pocket".

### 2. Actually attach the Dossier PDF to the email

Update `dossier-cold-outreach`:
- Before queuing the email, call `generate-signal-dossier` for the signal and convert the HTML to a PDF (Browserless API — already in our secrets; the `marketplace-generate-dossier-pdf` function shows the working pattern).
- Store the PDF in Supabase Storage (`dossier-pdfs` bucket, signed URL valid 30 days).
- Inject the signed link into the email body: *"Free dossier on Randazzo Mechanical attached: [Download PDF]"*.
- Now the lead magnet is real — recipient clicks, sees the proof, replies YES → you sell the $50/5-pack.

### 3. Tighten the 4-sentence email so it sells the upgrade

The email body stays 4 sentences (current contract), but lines 3 and 4 get sharper:

> Sentence 3: "I attached the full one-page dossier on Randazzo — name, address, hiring detail, predicted 30-day spend window, all from public records."
> Sentence 4: "If it's useful, $50 unlocks 5 more like this in your vertical this month — just reply YES."

This makes the dossier do the heavy lifting. The email is the hook, the PDF is the tease, the $50 pack is the close.

### 4. Show buyer-suggestion badge on the signal card

On each Growth Signal card, under the action buttons, add a small line:
> *"📧 8 HVAC + Electrical buyers ready to pitch"*

So at a glance you know how many warm targets exist before clicking.

## Volume per click

With this in place, one click on **Cold Email → Send to all** for a Randazzo-class signal will queue **8–25 personalized emails** (one per relevant supply-house buyer), each carrying the same dossier PDF, all cancellable with one tap from the SMS preview. That matches your "20–50 per scan" target across the day.

## Technical changes

**New files**
- `src/components/admin/BuyerOutreachDialog.tsx` — modal with vertical-filtered buyer list + checkboxes + bulk send
- `supabase/migrations/<ts>_seed_industrial_supply_buyers.sql` — seed table `industrial_supply_buyers` (vertical, company, contact, email, city) with ~150 Metro Detroit supply-house contacts split across HVAC, electrical, plumbing, building materials, welding/CNC consumables
- `supabase/functions/dossier-cold-outreach-bulk/index.ts` — accepts `{ signal_id, buyer_ids: [] }`, fans out to existing `dossier-cold-outreach` logic per buyer, returns aggregate result

**Modified files**
- `src/components/admin/AdminGrowthSignals.tsx` — replace `window.prompt()` block (lines 419–438) with `<BuyerOutreachDialog />` trigger; add buyer-count badge under each signal card
- `supabase/functions/dossier-cold-outreach/index.ts` — generate dossier PDF, upload to storage, signed URL injected into email body; keep ghost-delay + dedup unchanged
- `supabase/config.toml` — register `dossier-cold-outreach-bulk` with `verify_jwt = false` (admin-gated by service role check inside)

**Storage**
- Create `dossier-pdfs` bucket (private, signed URL access only)

## What this does NOT change

- Ghost delay (10 min cancel window) — kept
- 30-day dedup per recipient email — kept
- SMS preview to your phone — kept (becomes "8 emails queued, all cancellable")
- TCPA / manual-only outbound rules — kept
- Dossier remains free as the lead magnet; $50/5-pack remains the upsell

After approval, I'll build it in default mode.