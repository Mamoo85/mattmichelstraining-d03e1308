

# Comprehensive Plan: Facebook Lead Webhook + SEO Completion + Service Verification

## What's Actually Happening (3 Workstreams)

### Workstream 1: Facebook Lead Ads Webhook (Real Lead Generation)

The other AI's research is solid. Facebook Lead Ads at $20-55 CPL is the most viable paid channel for contractor leads at $399/mo pricing. The key technical win: Facebook's native lead forms auto-fill name/phone/email from the user's profile and POST to a webhook in real-time. Zero manual work after setup.

**Database Migration:**
- Add `source TEXT DEFAULT 'direct'` to `contractor_leads` table
- Add `facebook_page_id TEXT` to `contractor_lead_sites` table

**New Edge Function: `facebook-lead-webhook/index.ts`**
- **GET handler**: Facebook webhook verification — responds to `hub.verify_token` challenge using a `FACEBOOK_LEAD_VERIFY_TOKEN` secret
- **POST handler**: Receives Facebook's `{entry: [{changes: [{value: {leadgen_id, page_id}}]}]}` payload → fetches full lead data from Graph API (`GET /{leadgen_id}?access_token={META_ACCESS_TOKEN}&fields=field_data`) → maps `full_name`, `phone_number`, `email` → looks up `contractor_lead_sites` by `facebook_page_id` → inserts into `contractor_leads` with `source = 'facebook'` → triggers the same Matt + contractor notification emails already in `contractor-lead-capture`
- Reuses `META_ACCESS_TOKEN` (already configured) for Graph API calls
- Needs one new secret: `FACEBOOK_LEAD_VERIFY_TOKEN` (a random string Matt picks and enters in Facebook Developer dashboard)

**Update: `contractor-lead-capture/index.ts`**
- Accept optional `source` param in request body
- Pass through to INSERT: `source: source || 'direct'`

**What Matt Does After Deploy (not automated):**
1. Create Facebook Pages per territory (e.g., "Detroit Roofing Estimates") — 10 min each
2. Run Facebook Lead Ads targeting homeowners in those cities
3. In Facebook Developer dashboard: register webhook URL → `https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/facebook-lead-webhook`
4. Update `facebook_page_id` on each `contractor_lead_sites` row to link territories to pages

---

### Workstream 2: Finish SEO Page Generation (240 done → 2,000 target)

**Current state:** 240 contractor pages generated. Missing ~1,760 pages across all 4 categories.

**Remaining generation:**
- Contractor trades: ~560 more (20 niches × 40 cities = 800 total, minus ~240 done)
- Web Design: 600 pages (15 industry niches × 40 cities)
- Personal Training: 400 pages (10 niches × 40 cities)
- Coaching: 200 pages (5 niches × 40 cities)

**Execution:** Run batch generation script using `gemini-2.5-flash-lite` via Lovable AI Gateway with 4 distinct system prompts per category. Process in batches of ~300 to avoid timeouts. Each prompt includes city-specific references (neighborhoods, landmarks, climate) to ensure content diversity.

**Frontend:** `ContractorSeoPage.tsx` already handles all 4 categories with dynamic "Why Choose Us" cards and category-specific CTAs. No frontend changes needed.

---

### Workstream 3: Verify All A La Carte Services Still Work

**Confirm these remain independently purchasable — no removals:**

All 12 add-ons in `src/lib/addons.ts` stay as-is:
- Google Ads Management ($99/mo)
- Monthly Content Package ($79/mo)
- GBP Management ($49/mo)
- Local SEO Landing Pages ($299 one-time)
- Website Audit ($49 one-time)
- AI Review Response ($49/mo) — has Stripe price_id
- Website Refresh ($199 one-time)
- Missed-Call Text-Back ($99/mo) — has Stripe price_id
- AI Job Posting Writer ($29/mo) — has Stripe price_id
- Quote Follow-Up ($49/mo) — has Stripe price_id
- Competitor Intel ($69/mo) — has Stripe price_id
- AI Chatbot Widget ($149/mo)

**Standalone service pages (unchanged):**
- `/contractor-leads`, `/social-media-ai`, `/local-marketing`, `/field-rep-tools`, `/b2b-leads`, `/newsletter`, `/web-design-services`

No services are being removed. The client portal simply cross-sells these same services.

---

## Files Changed/Created

| File | Action | What |
|------|--------|------|
| Migration SQL | **Create** | Add `source` to `contractor_leads`, `facebook_page_id` to `contractor_lead_sites` |
| `supabase/functions/facebook-lead-webhook/index.ts` | **Create** | FB webhook verification + lead ingestion + notification emails |
| `supabase/functions/contractor-lead-capture/index.ts` | **Edit** | Accept optional `source` param, pass to INSERT |
| SEO batch script | **Run** | Generate remaining ~1,760 pages across 4 categories |

## New Secret Needed
- `FACEBOOK_LEAD_VERIFY_TOKEN` — a random string Matt chooses and enters in Facebook Developer dashboard for webhook verification

## Execution Order
1. Database migration (add columns)
2. Request `FACEBOOK_LEAD_VERIFY_TOKEN` secret from Matt
3. Deploy `facebook-lead-webhook` edge function
4. Update `contractor-lead-capture` to accept `source`
5. Run SEO batch generation (batches of ~300, ~45 min total)
6. Quick audit of all add-on checkout flows to confirm nothing broke

