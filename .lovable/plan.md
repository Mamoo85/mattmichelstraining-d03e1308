

# Combined Implementation Plan: Revenue Suite + Prospector Overhaul

This merges the previously approved P0-A through P1 work with Matt's new "Lead Generation & Pipeline Manager" overhaul of the Prospector tool.

---

## Section 1: Previously Approved Work (unchanged)

### P0-A: Fix AdminSandbox.tsx
- Fix GBP Post Pack price $49 → $19
- Remove 15 non-deliverable products
- Add "Requires Setup" badges to GBP SaaS, Social Media AI, Missed Call, Social Connect
- Add "Fire Now" button for GBP SaaS

### P0-B: Pricing Fixes
- GBP subscription: $49 → $199/mo
- Social Media: Standard $99→$199, Pro $149→$299, Trainer stays $79

### P0-C: Revenue Suite Bundle
- New landing page at `/revenue-suite`
- New checkout edge function ($299/mo)
- Webhook handler upserts into all 8 SMS product tables
- Route added to App.tsx

### P0-D: Navbar "For Business" Dropdown
- Links to All Services, Revenue Suite, Digital Foundation, Website Audit

### P1: Agent Updates (5 markdown files)
- selma.md, tom-autonomous.md, nova.md, upsell.md, scarlett.md

---

## Section 2: Prospector Overhaul — "Lead Generation & Pipeline Manager"

### 2A: New Database Table — `prospect_pipeline`

Migration to create a Kanban pipeline table:

```sql
CREATE TABLE public.prospect_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  city TEXT,
  state TEXT,
  industry TEXT,
  google_rating NUMERIC(2,1),
  review_count INTEGER,
  gbp_claimed BOOLEAN,
  google_place_id TEXT,
  pipeline_stage TEXT NOT NULL DEFAULT 'new_lead',
  pain_points JSONB,
  n8n_sent_at TIMESTAMPTZ,
  source TEXT DEFAULT 'dataforseo',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prospect_pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.prospect_pipeline FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_pipeline_stage ON public.prospect_pipeline(pipeline_stage);
CREATE INDEX idx_pipeline_industry ON public.prospect_pipeline(industry);
```

Pipeline stages: `new_lead` → `website_audited` → `outreach_sent` → `call_booked`

### 2B: Edge Function — `dataforseo-maps-search`

New edge function: `supabase/functions/dataforseo-maps-search/index.ts`

- Accepts: `{ industry, location, limit }` (location = city name or zip code)
- Calls DataForSEO Google Maps SERP API (`/v3/serp/google/maps/live/advanced`)
- Uses existing `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` secrets (already configured)
- Returns: array of `{ title, rating, reviews, address, phone, website, category, place_id, claimed }` 
- Cost: ~$3/1000 requests — extremely cheap

### 2C: Edge Function — `prospect-website-audit`

New edge function: `supabase/functions/prospect-website-audit/index.ts`

- Accepts: `{ url, business_name, industry }`
- Step 1: Calls existing Firecrawl scrape endpoint (reuse `FIRECRAWL_API_KEY`) to get homepage markdown
- Step 2: Passes markdown to Lovable AI Gateway (gemini-2.5-flash-lite) with prompt: "You are a web design sales consultant. Analyze this business website and return exactly 3 specific pain points that would cost them customers. Be specific — reference actual missing elements." 
- Returns: `{ pain_points: string[] }`
- Cost: Firecrawl free tier (500 credits) + Lovable AI Gateway (no additional cost)

### 2D: Edge Function — `send-lead-to-n8n`

New edge function: `supabase/functions/send-lead-to-n8n/index.ts`

- Accepts: `{ lead, pain_points }`
- Reads `N8N_MCP_URL` from env (already configured)
- POSTs JSON payload to n8n webhook URL with: business name, contact info, Google rating, review count, pain points array
- Updates `prospect_pipeline.n8n_sent_at` timestamp
- Returns success/failure

### 2E: Rebuild AdminProspector.tsx (~800 lines → ~1200 lines)

Complete overhaul of `src/components/admin/AdminProspector.tsx`:

**Tab Structure** (replaces current tabs):
1. **Search** — DataForSEO Maps search + results table
2. **Pipeline** — Kanban board
3. **All Leads** — existing unified lead catalog (preserved)

**Search Tab:**
- Searchable industry dropdown with 50+ categories (HVAC, Plumbing, Electrical, Roofing, Landscaping, Medical Spas, Dental Clinics, Law Firms, Industrial Automation, etc.)
- City/Zip input field
- Results displayed in sortable data table: Business Name, Rating (stars), Reviews, Phone, Website, Claimed (Y/N)
- "Add to Pipeline" button on each row → inserts into `prospect_pipeline` with stage `new_lead`
- Bulk select + "Add Selected" for batch pipeline insertion

**Pipeline Tab (Kanban Board):**
- Install `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop
- 4 columns: New Lead | Website Audited | Outreach Sent | Call Booked
- Lead cards show: name, industry, rating, review count, city
- Each card has 3 action buttons:
  - **Analyze Website** → calls `prospect-website-audit`, displays 3 pain points on card, moves to "Website Audited"
  - **Send to n8n** → calls `send-lead-to-n8n` with lead data + pain points, shows green success toast, moves to "Outreach Sent"
  - **Mark Booked** → moves to "Call Booked"
- Drag-and-drop between columns to manually move leads
- Card count badges on each column header

**All Leads Tab:**
- Preserves the existing unified lead catalog with all 14 source tables, filters, sorting, edit/delete/email actions — no changes to this functionality

### 2F: Dependencies

- `@dnd-kit/core` and `@dnd-kit/sortable` — lightweight drag-and-drop library (~15kb gzipped)

---

## Files Changed (Complete List)

| File | Action | Section |
|------|--------|---------|
| `src/components/admin/AdminSandbox.tsx` | Edit | P0-A |
| `supabase/functions/create-gbp-subscription/index.ts` | Edit | P0-B |
| `supabase/functions/create-social-media-checkout/index.ts` | Edit | P0-B |
| `src/pages/BundleRevenueSuite.tsx` | NEW | P0-C |
| `supabase/functions/create-bundle-revenue-suite-checkout/index.ts` | NEW | P0-C |
| `src/App.tsx` | Edit | P0-C + P0-D |
| `supabase/functions/stripe-webhook/index.ts` | Edit | P0-C |
| `src/components/layout/AppNavbar.tsx` | Edit | P0-D |
| `.claude/agents/selma.md` | Edit | P1 |
| `.claude/agents/tom-autonomous.md` | Edit | P1 |
| `.claude/agents/nova.md` | Edit | P1 |
| `.claude/agents/upsell.md` | Edit | P1 |
| `.claude/agents/scarlett.md` | Edit | P1 |
| Migration: `prospect_pipeline` table | NEW | 2A |
| `supabase/functions/dataforseo-maps-search/index.ts` | NEW | 2B |
| `supabase/functions/prospect-website-audit/index.ts` | NEW | 2C |
| `supabase/functions/send-lead-to-n8n/index.ts` | NEW | 2D |
| `src/components/admin/AdminProspector.tsx` | Rebuild | 2E |
| `package.json` | Edit (add dnd-kit) | 2F |

---

## Cost Summary

| Service | Usage | Cost |
|---------|-------|------|
| DataForSEO Maps | ~$3 per 1,000 searches | Already configured |
| Firecrawl | 500 free credits/mo | Already configured |
| Lovable AI Gateway | Website audits | No additional cost |
| n8n | Webhook trigger | Already configured |
| dnd-kit | Kanban UI library | Free/open source |

