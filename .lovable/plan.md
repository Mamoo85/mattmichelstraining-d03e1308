

## Fix: Postcard Campaigns Are Mismatched (HVAC copy on nursing-home campaign, mails to wrong businesses)

### Root cause (3 layered bugs)

1. **Prospects table has no `audience_type` column.** `postcard_prospects` only stores `county` + `source` (`lara_bpl`, `cms_nursing_home`, etc.). When you click *Confirm & Send*, `send-postcards` queries `WHERE county ILIKE 'macomb' AND postcard_sent_at IS NULL` — it does **not filter by audience**. So a nursing-home campaign in Macomb mails to every unsent Macomb prospect (HVAC, plumbers, contractors, supply houses — all of them).

2. **Recipient count uses the same unfiltered query** (`unsentByCounty(c.county)` on line 456 of `AdminPostcardCampaigns.tsx`). The "Will mail to 15 addresses" number is the wrong 15.

3. **AI-generated copy can mismatch the audience badge.** `generate-postcard-copy` writes the AI's `copy_front` text into the campaign row but uses the badge's `audience_type` — and the AI sometimes produces trades copy under a nursing-home prompt or vice versa. Combined with bug #1, you get the screenshot: badge says `nursing-home`, front copy says "HVAC, Plumbing, Electrical: 26 Hot Candidates", recipients are a random Macomb mix.

### The fix — 3 parts, no destructive migration

**Part 1 — Database (1 migration):**
- Add `audience_type TEXT` column to `postcard_prospects` (nullable, indexed).
- Backfill existing rows from `source`:
  - `cms_nursing_home` → `nursing-home`
  - `lara_bpl`, `lara_accela` → `contractor`
  - `healthcare_staffing` → `healthcare-agency`
  - `trades_staffing` → `trades-agency`
  - `supply_house` → `supply-house`
  - everything else stays NULL (won't be auto-mailed)
- Update `targeting-prospect-scraper` and `lara-business-scraper` / `lara-accela-scraper` / `enrich-postcard-addresses` to write `audience_type` on every insert going forward.

**Part 2 — `send-postcards` audience filter (the real safety fix):**
- Line 347 query becomes:
  ```ts
  prospectQuery = prospectQuery
    .ilike("county", campaign.county)
    .eq("audience_type", campaign.audience_type)  // ← NEW
    .is("postcard_sent_at", null)
    .limit(MAX_PER_RUN);
  ```
- If `campaign.audience_type` is NULL or no prospects match → fail loudly with the exact reason (so "draft mailed wrong people" can never happen again).
- `diagnose()` (`dry_run`) shows the same audience-filtered count.

**Part 3 — Admin UI clarity (`AdminPostcardCampaigns.tsx`):**
- `unsentByCounty` becomes `unsentForCampaign(c)` — filters by both `county` AND `audience_type`.
- Each campaign card header is rebuilt to make the mismatch visually impossible:
  ```
  ┌─────────────────────────────────────────────────────────┐
  │ 📮 NURSING-HOME · Macomb County · DRAFT                 │
  │ ─────────────────────────────────────────────────────── │
  │ Audience: Nursing Home / Facility (emerald)             │
  │ Will mail to: 8 nursing homes in Macomb                 │
  │ Cost: $6.80 · QR target: /postcard?audience=...         │
  │                                                          │
  │ FRONT COPY:                                              │
  │ "Struggling to Find Nurses? We Find Them First."        │
  │   ⚠️ Auto-flag if copy mentions HVAC/plumbing/electrical │
  │      while audience is nursing-home/healthcare           │
  │      → "Copy/audience mismatch — regenerate"             │
  │                                                          │
  │ [🔍 Diagnose] [✏️ Regenerate Copy] [Confirm & Send]     │
  └─────────────────────────────────────────────────────────┘
  ```
- Add a **Regenerate Copy** button that re-invokes `generate-postcard-copy` for that exact campaign (replaces front/back without creating a new draft).
- Add a **mismatch detector** (client-side string check: if audience is healthcare/nursing-home and `copy_front` contains "HVAC|Plumbing|Electrical|Tradespeople" — show an inline red warning + disable Send until regenerated).
- "Confirm & Send" button text becomes: `Send 8 postcards to nursing-homes in Macomb · $6.80` (audience name + count + cost together).
- Group the campaigns list by audience (collapsible sections: 🩺 Healthcare · 🔧 Trades · 🏥 Nursing Homes · 📦 Supply Houses) so you can see at a glance what's queued for each vertical.

### What won't change
- Cost guardrails, Lob send loop, send_log tracking, conversion tracking — all unchanged.
- Existing draft campaigns stay; after the migration runs, the audience filter will simply scope them to the right prospects (or fail fast with "0 nursing-home prospects in Macomb" if the pool is empty — at which point you click *Find Prospects* on the Find tab).

### Files touched
- **NEW migration**: `supabase/migrations/20260422XXXXXX_postcard_prospects_audience.sql`
- **EDITED**: `supabase/functions/send-postcards/index.ts` (audience filter on lines 342–348 + dry_run path)
- **EDITED**: `supabase/functions/targeting-prospect-scraper/index.ts`, `lara-business-scraper/index.ts`, `lara-accela-scraper/index.ts`, `enrich-postcard-addresses/index.ts` (write `audience_type` on insert/upsert)
- **EDITED**: `src/components/admin/AdminPostcardCampaigns.tsx` (filtered count, regenerate button, mismatch warning, grouped layout, clearer Send label)

No Stripe, no edge function config, no breaking changes to existing send_log rows.

