

## Merge Postcard Ops + Postcards into one tab — and ship 4-product postcards

You have two postcard tabs doing half the job each:
- **Postcards** = real database (prospects, campaigns, send log via Lob, conversions)
- **Postcard Ops** = standalone HTML preview/print tool with no database tie-in

You also want supply-house targeting (for Demand Radar) baked into the same workflow, plus every postcard from now on offers all 4 products.

---

### A. Merge into one tab: **"Postcards"** (kill "Postcard Ops")

Single tab, 4 sub-tabs across the top:
1. **🎯 Find Prospects** — searches like Postcard Ops (audience + city/county) but writes to `postcard_prospects` DB. Uses existing `targeting-prospect-scraper` (already supports `supply_house`, `nursing_home`, `healthcare_staffing`, `trades_staffing`, `industrial_mfg`, `senior_care`). Search box: "Find supply houses in Oakland County" → 1 click → rows land in DB tagged with audience.
2. **📋 Prospects** — current grouped-by-county table with the new audience filter chip
3. **📮 Campaigns** — current send/track UI (Send Log, Diagnose, Resend Failed — already shipped last turn)
4. **🖨️ Print Preview** — the Postcard Ops HTML preview for QA before sending via Lob (kept as a sanity check)

Result: one workflow — search → prospects appear → generate copy → preview → send via Lob → track delivery. No more split brain.

---

### B. Multi-offer postcard design — **ONE QR code, not four**

**Recommendation: ONE QR code that lands on a multi-product offer page.** Here's why:

| 4 separate QR codes | 1 QR code → multi-offer page |
|---|---|
| Visually cluttered (4 boxes on a 6×4) | Clean — keeps the "Free X" hero offer prominent |
| Forces them to choose before they understand | Lets us upsell on the landing page where we have copy room |
| Can't change offers post-print | Landing page is editable forever |
| Attribution split 4 ways | All scans hit one URL with `?utm_campaign=` for clean attribution |

**New postcard layout (6×4 inches):**
- LEFT 4": Hero offer (matches their audience — e.g. "FREE 10 Verified Nurse Names" for nursing homes). Same as today.
- RIGHT 2": QR code + **"Plus 3 more free tools"** strip with 3 tiny icon+name rows: 🔧 FieldDesk · 📞 Missed Call Catch · 📡 SiteRadar (the 3 products that aren't the hero). Looks intentional, not cluttered.

**New landing page: `/postcard?audience=nursing_home&utm_campaign=...`**
- Top fold: Hero offer claim button (matches what they expected from the postcard)
- Below: 3 secondary offer cards for the other products
- Tracks `postcard_conversions` per offer clicked (`event = trial_signup_<product>`) so the digest tells us *which* secondary offers actually convert

This is the right call because (a) it lets us A/B test secondary offers without reprinting, (b) it keeps the postcard scannable from across a desk, and (c) attribution stays clean.

---

### C. Files touched

- `src/components/admin/AdminPostcardCampaigns.tsx` — add 4 sub-tabs: Find Prospects (search), Prospects, Campaigns, Print Preview
- `src/components/admin/AdminPostcardOps.tsx` — DELETE (folded into the merged tab)
- `src/pages/DWAAdmin.tsx` — remove "Postcard Ops" sidebar entry (sidebar shows just "Postcards")
- `supabase/functions/send-postcards/index.ts` — update QR builder to point at new `/postcard` landing page with `audience` + `utm_campaign` params; add small "+3 more" strip to right column
- `src/pages/PostcardLanding.tsx` (NEW, public, no auth) — multi-offer landing page; logs to `postcard_conversions` per click
- `src/App.tsx` — register `/postcard` route
- `supabase/functions/targeting-prospect-scraper/index.ts` — small tweak so search results write into `postcard_prospects` (not just `targeting_prospects`) when `mode='postcard'` is passed

---

### D. What this unlocks immediately

- **Search supply houses for Demand Radar**: type "Find supply houses in Macomb" → 1 click → prospects in DB → generate copy (already supports `supply-house` audience with Demand Radar pitch) → diagnose → send via Lob
- **Each postcard now sells the whole product line** without looking like a junk-mail brochure
- **One source of truth** for postcard work — no more flipping between two tabs

### E. What I will NOT change
- Lob send pipeline (already honest after last turn — no regressions)
- Send log / Diagnose / Resend buttons (working as built)
- Existing `postcard_campaigns` schema (just adds the landing page on the receive end)

### Risk
- Print Preview tab uses inline HTML; the live Lob send uses a slightly different HTML builder. I'll unify them into one shared template function so what you see in Preview is byte-identical to what Lob mails. If they drift, you'd be debugging a phantom — this prevents that.

