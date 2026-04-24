

# Plan — Fix the 7 broken things across Outreach Command Center, LO Outreach, and Contractor Leads

You showed me 7 screens. Every one of them has a real, reproducible bug. Here is exactly what's wrong and what I'll do.

---

## 1. "NMLS refresh: 0 new prospects added" (LO Outreach)

**Why it's broken**: `find-lo-prospects` only calls Apollo with a very narrow query (`person_titles: ["Mortgage Loan Originator","MLO","Loan Officer","Mortgage Banker"]` + `q_organization_locations: ["Michigan, US"]`). Apollo's free tier returns 0 for that combination almost every time, and there's no fallback. Result: button always says "0 added."

**Fix**:
- Broaden Apollo query (drop strict org-location, add `person_locations: ["Michigan"]` as fallback, page through up to 3 pages of 25)
- If Apollo returns 0 OR no `APOLLO_API_KEY`, seed from a deterministic Michigan MLO sample list (top 50 MI mortgage companies by AUM — pulled from public NMLS company registry, baked in as static JSON) so the button is never useless
- Toast becomes `Apollo: X · Seed: Y · Total inserted: Z` so you see exactly what happened

---

## 2. "I selected leads but can't send them anywhere — and need to enrich from here" (LO Outreach Campaign Builder)

**Why it's broken**: The Campaign Builder middle column says "No prospects. Refresh from NMLS first" because #1 above always returns 0. Once #1 is fixed, prospects appear. But there's no per-row Enrich button in the campaign builder — only on the Prospects tab.

**Fix**:
- Add a small `🔄` enrich button to each prospect row inside the Campaign Builder column (calls existing `enrich-lo-prospect`)
- Add "Enrich all visible" button at the top of the prospect column
- After enrich, refetch and show warmth score updates inline

---

## 3. "Click test every single thing on the LO Outreach page" (entire page audit)

**What I'll verify in order**:
- `Refresh from NMLS` → fixed in #1
- Prospects tab `Enrich` button → already wired to `enrich-lo-prospect`, will sanity-test
- Campaign Builder send → confirm `marketplace-outreach-blast` returns and history populates
- History tab → confirm rows render after a send
- Each channel radio (Postcard / Fax / Email) → cost calc updates correctly

Anything that fails gets patched in the same ship.

---

## 4. "Filtered Has-Fax → clicked Fax button → Active Campaigns → Fax Campaigns is empty" (Outreach Command Center)

**Why it's broken (this is the worst one)**: The bulk Fax button at line 578 of `OutreachCommandCenter.tsx` only does:
```
UPDATE prospect_pool SET status = 'queued_fax' WHERE id IN (...)
```
It **never creates a row in `fax_campaigns`**. So your toast says "Queued 17 for fax campaign — visit Active Campaigns to send" but Active Campaigns reads from `fax_campaigns` and `postcard_campaigns` tables, which stay empty forever.

Same bug for Email Campaign, Postcard, and Call Sheet buttons — all four are dead ends.

**Fix** — make each bulk button actually create a real campaign:
- **Fax**: insert row in `fax_campaigns` (name = `manual_${audience}_${date}`, status `draft`, target_segment = list of prospect IDs) → toast becomes `Created fax campaign #X with 17 targets — Open in Active Campaigns →` with a clickable link
- **Postcard**: same shape against `postcard_campaigns`
- **Email**: insert into `email_campaigns` (already exists) and link to the campaign
- **Call Sheet**: this is just a CSV download — re-route to download a printable call sheet with names/phones/scripts (no DB write needed)
- Then in Active Campaigns, add a `Send →` button on each draft row that calls `send-fax-phaxio` / `send-postcard-lob` / etc.

---

## 5. "What are these dashboards? How do I get leads? Help me sell leads à la carte" (Contractor Leads admin page)

**Why it's confusing**: The page mixes 5 things with no clear hierarchy:
1. Test Dashboards (red-circled bar) → these are *demo* dashboards that simulate what a paying contractor sees. They're for **showing prospects on a sales call**, not for managing your own leads. Currently unlabeled.
2. Territory grid — your inventory of trade/city slots you can sell ($399/mo each)
3. FB Page ID inputs — where you wire each territory's Facebook lead-form to the right contractor
4. Live Lead Feed — actual homeowner leads coming in
5. Action Queue — your daily to-do list

**Fix**:
- Rename the Test Dashboards section to **"🎬 Demo Dashboards (for sales calls)"** with a one-line tooltip: *"Open these on a Zoom screen-share to show prospects what they'd get."*
- Add a "**📍 How leads come in**" explainer card at the top of the page:
  > Leads arrive 3 ways: (1) homeowner fills `/contractor-leads/[trade-city]` SEO page, (2) homeowner clicks your Facebook lead ad (requires FB Page ID wired below), (3) you manually enter via "Add Lead" button. Each lead auto-SMSes the contractor who owns that territory.
- Add a new section **"💰 Sell Leads À La Carte"** (this is the new one you're asking for): for any unclaimed lead in the Live Feed, show a **`💵 Sell this lead`** button that:
  - Generates a one-time Stripe payment link ($39 / $59 / $99 — you pick at click time)
  - Pulls the 3 closest unwired contractors in that trade from your `prospect_pool` (must have phone or email)
  - Lets you pick one or all → fires SMS or email with: *"Got a [trade] lead in [city]: [project description]. $XX to claim, first one to pay gets the homeowner's contact. [stripe link]"*
  - First payment locks the lead, refunds the others automatically (uses existing `claim_lead_soft_lock` RPC pattern)
- Sticky toolbar at the top of Live Feed: `📤 Sell selected (3)` for bulk

---

## 6. "FB Page ID inputs — what's this for?" (red circles in screenshot)

**What it is**: When a contractor wires their Facebook Lead Form to your territory, you paste their FB Page ID here so incoming Facebook leads route to them. Without it, Facebook leads land in a generic bucket.

**Fix**:
- Add a **`?`** icon next to the heading that opens a modal with: *"Paste the contractor's Facebook Page ID (find it at facebook.com/[their-page]/about → Page Transparency). This routes Facebook lead-form submissions for [city]/[trade] to their phone/email automatically."*
- Add a "Don't have one yet?" link → opens `runProspector` to find a contractor for that territory

---

## 7. End-to-end test before declaring done

After patching, I'll run with curls + the Lovable browser tool:
1. Click `Refresh from NMLS` → expect ≥10 prospects
2. Filter Has-Fax → select 5 → click Fax → expect a `fax_campaigns` row + clickable link in toast → open Active Campaigns → see the draft → click Send → confirm `send-fax-phaxio` fires
3. Same for Email and Postcard
4. On Contractor Leads page, click "💵 Sell this lead" on a stuck lead → expect Stripe link + SMS sent
5. Verify FB Page ID save still works

---

## Files to edit

| File | Change |
|---|---|
| `supabase/functions/find-lo-prospects/index.ts` | Broaden Apollo query, add MI MLO seed-list fallback, return per-source counts |
| `src/components/dwa-admin/LeadSalesOutreachHub.tsx` | Per-row Enrich + "Enrich all visible" in Campaign Builder column |
| `src/components/dwa-admin/OutreachCommandCenter.tsx` | Bulk Email/Postcard/Fax/Call buttons actually create campaign rows + return navigable links |
| `src/components/admin/AdminContractorLeads.tsx` | Demo Dashboards label + tooltip, "How leads come in" card, FB Page ID `?` modal, "💵 Sell this lead" buttons + bulk |
| `supabase/functions/sell-lead-alacarte/index.ts` | **New** — generates Stripe one-time link, pulls candidate contractors, fires SMS/email, locks on first payment |
| `supabase/migrations/<ts>_alacarte_lead_sales.sql` | **New** — `lead_alacarte_offers` table (lead_id, prospect_ids, price, stripe_session_id, claimed_by, status), `claim_alacarte_lead()` RPC |

## Honest scope

~2 hours. One ship. Every button on every screen you sent me will do what its label says, plus you get a new revenue lever (à la carte lead sales) for the leads that fall through your subscription network.

## Not touching
- The shared enrichment waterfall (already correct from last ship)
- The Stripe webhook self-healing logic (already shipped)
- The DWA defensive protocol (already locked into mem://)

