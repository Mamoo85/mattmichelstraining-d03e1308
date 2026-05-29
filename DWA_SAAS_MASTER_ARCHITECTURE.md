# DWA SaaS Platform — Master Architecture
**Status:** Phase 1 built (2026-05-24 night) | Phase 2 (Pinterest) deferred to next session

---

## Vision

A proprietary B2B SaaS tool for Etsy sellers that combines three capabilities no single tool offers today:
1. **Competitor Intelligence** (replaces EverBee/eRank analytics)
2. **Ad Creative Generation** (replaces Canva + Bannerbear; free via `sharp`)
3. **Pinterest Auto-Syndication** (replaces Buffer/Tailwind for Pinterest)

**Competitive moat:** EverBee ($19–99/mo) and eRank ($9–29/mo) only do analytics. This does analytics + ad creatives + Pinterest posting — three tools in one.

---

## Pricing Tiers

| Tier     | Price/mo | Tracked Competitors | Ad Creatives/mo | Pinterest Auto-Post |
|----------|----------|---------------------|-----------------|---------------------|
| Starter  | $29      | 5                   | 50              | No                  |
| Pro      | $79      | 25                  | 200             | Yes (1 board)       |
| Agency   | $199     | Unlimited           | Unlimited       | Yes (all boards)    |

---

## Sales Channels

1. **`tools.detroitwebagency.com`** — dedicated landing page (new subdomain)
2. **DWA cold outreach pipeline** — `techalert-outreach` already targets e-commerce businesses; add Etsy seller vertical
3. **Etsy seller communities** — Reddit r/EtsySellers, r/Etsy; Facebook groups (Etsy Sellers Team, etc.); these communities pay for EverBee without hesitation
4. **YouTube Shorts** — Matt's existing channel; demo competitor revenue charts → direct-to-signup CTA
5. **Matt's own store first** — M2CreativeStudio gets full benefit before first paying customer

---

## System Architecture

### Target Supabase Project

**Secondary:** `zmyczlfuufhngzovkjdh`

Shares: `ETSY_API_KEY`, `etsy_oauth_tokens`, `agent_heartbeats`, `etsy_listings`

---

## Machine 1 — Competitor Espionage & Intelligence

**Status:** ✅ BUILT (2026-05-24)

**What it does:**
- Tracks review velocity for competitor shops daily
- Estimates sales/revenue using heuristic: `daily_sales = review_delta × 4.5`
- Two data sources: Etsy Public API (primary) → HTML scrape fallback
- Multi-tenant: each DWA customer tracks their own set of competitors
- Nightly run: 4:59am UTC (11:59pm EST)

**Algorithm:**
```
review_delta = today_reviews - yesterday_reviews
daily_sales  = review_delta × 4.5
daily_revenue = daily_sales × avg_listing_price
```

The 4.5× multiplier comes from industry research: roughly 1 in 4–5 buyers leaves a review. Calibrate over time by comparing to known Etsy seller revenue reports.

**Etsy Public API endpoints used (no OAuth, `x-api-key` only):**
```
GET https://openapi.etsy.com/v3/application/shops?shop_name={name}
→ review_count, listing_active_count

GET https://openapi.etsy.com/v3/application/shops/{shop_id}/listings?state=active&limit=25
→ avg price calculation
```

**HTML scrape fallback (when API returns nothing):**
- Rotating 6 user-agents to avoid 429s
- Regex patterns: `/(\d[\d,]+)\s+reviews?/i`, `/"reviewCount"\s*:\s*(\d+)/`
- Listing count: `/"listingCount"\s*:\s*(\d+)/`

**Database Schema:**

```sql
tracked_shops (
  id uuid PK,
  user_id uuid DEFAULT '00000000-0000-0000-0000-000000000001',  -- DWA sentinel for internal data
  shop_name text,
  shop_url text,
  etsy_shop_id text,
  vertical text,   -- 'pod' | 'gifts' | 'apparel' | 'drinkware' | 'digital' | '3dprint'
  active boolean,
  UNIQUE(user_id, shop_name)
)

shop_daily_metrics (
  id bigserial PK,
  shop_id uuid → tracked_shops,
  metric_date date,
  total_reviews int,
  active_listing_count int,
  avg_listing_price_cents int,
  review_delta int,
  estimated_daily_sales numeric(10,2),
  estimated_daily_revenue numeric(12,2),
  data_source text,   -- 'api' | 'scrape'
  raw_snapshot jsonb,
  UNIQUE(shop_id, metric_date)
)
```

**Files:**
- `supabase/migrations/20260525010000_competitor_intelligence.sql`
- `supabase/migrations/20260525020000_competitor_cron.sql`
- `supabase/migrations/20260525030000_seed_tracked_shops.sql`
- `supabase/functions/shop-intelligence/index.ts`
- `scripts/calibrate-intelligence.ts`

**Seed cohort (20 shops, DWA internal):**
PersonalizationMall, CaitlynMinimalist, ModParty, TheCrownPrints, PiperLouCollection, Mugsby, ZoeysAttic, TheCreativeRaccoon, TheSaltyHustle, PlannerKate, Shop3D, DesignMakers, NicheGiftCo, SimplyNameIt, ILYBDesigns, Frostbeard, BellaAndCanvasTees, PrintAndClay, LittleWeeShop, TheMugBoutique

**Local calibration:**
```bash
deno run --allow-net --allow-env --allow-read scripts/calibrate-intelligence.ts
```

---

## Machine 2 — Ad Creative Generator

**Status:** ✅ BUILT (2026-05-24)

**What it does:**
- Takes an Etsy listing → generates branded ad creatives for Facebook, Instagram, Pinterest, Google
- Downloads product image → composites onto template background → adds price/headline text overlay
- Uploads finished JPEGs to Supabase Storage (`ad-creatives/` bucket)
- 10 starter templates included (placeholder configs); Matt replaces with real Canva/Photoshop PNGs

**Tech stack:**
- `npm:sharp@0.33.4` — industry-standard Node.js image processing library (Deno-compatible)
- Supabase Storage — `templates/` bucket (template PNGs), `ad-creatives/` bucket (generated output)
- Zero API costs (vs. Bannerbear: $49–149/mo)

**Template system:**
```json
{
  "width": 1080,
  "height": 1080,
  "product_zone": { "left": 80, "top": 80, "width": 700, "height": 700 },
  "text_zones": [
    { "label": "price",    "x": 840, "y": 900, "size": 54, "color": "#FFF", "align": "center" },
    { "label": "headline", "x": 540, "y": 980, "size": 32, "color": "#EEE", "align": "center" }
  ]
}
```

Matt's template workflow:
1. Open Canva or Photoshop
2. Create 1080×1080 background design (leave product area clear)
3. Export as PNG
4. Upload to Supabase Storage → `templates/{template_id}.png`
5. The function auto-detects and uses the real design next run

**API:**
```
POST /functions/v1/ad-creative-generator
Body: {
  "listing_id": "1234567890",
  "template_ids": ["sq-navy-price", "story-white"],  // optional; omit for all 10
  "dry_run": false
}

Response: {
  "listing_id": "1234567890",
  "generated": 8,
  "assets": [
    { "template_id": "sq-navy-price", "url": "https://...", "dimensions": { "width": 1080, "height": 1080 } }
  ],
  "errors": []
}
```

**Database Schema:**
```sql
mockup_templates (
  id text PK,         -- slug e.g. 'sq-navy-price'
  name text,
  platform text,      -- 'facebook' | 'instagram' | 'pinterest' | 'google' | 'all'
  aspect_ratio text,  -- '1:1' | '9:16' | '4:5' | '1.91:1'
  background_url text,
  config jsonb,
  active boolean
)

ad_creative_assets (
  id bigserial PK,
  user_id uuid,
  listing_id text,
  template_id text → mockup_templates,
  asset_url text,
  storage_path text,
  dimensions jsonb,
  UNIQUE(listing_id, template_id)
)
```

**Files:**
- `supabase/migrations/20260525040000_ad_creatives.sql`
- `supabase/functions/ad-creative-generator/index.ts`

**Generate creatives for all M2 listings:**
```bash
# Get listing IDs from DB, then POST each
curl -X POST https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ad-creative-generator \
  -H "Content-Type: application/json" \
  -d '{ "listing_id": "LISTING_ID_HERE" }'
```

---

## Machine 3 — Pinterest Auto-Syndication

**Status:** ⏳ DEFERRED (next session)

Already exists as `pinterest-pinner` function — connects to `pinterest_pins` table, `pod_listings`, `etsy_digital_listings`.

**Next session work:**
- Connect ad_creative_assets to Pinterest — use generated JPEGs as pin images instead of Unsplash placeholders
- Add Pinterest cron for new competitor-inspired products
- Pinterest board creation guide for themed boards

---

## Machine 4 — Trend → Queue Pipeline

**Status:** ⏳ Future (Phase 2+)

Uses Machine 1 intelligence to:
1. Find competitor listings with high `review_delta` (fast-selling)
2. Identify the design/niche/keyword pattern
3. Auto-generate near-replica listing and push to `pod_product_queue`
4. Effectively creates a closed-loop: spy → copy winning trends → auto-produce → auto-pin

---

## Multi-Tenant Architecture

**Isolation model:** Row Level Security on all tables via `user_id` column.

| user_id | Meaning |
|---------|---------|
| `00000000-0000-0000-0000-000000000001` | DWA internal sentinel — Matt's own calibration cohort. Visible to all authenticated users. |
| Auth user UUID | Individual SaaS customer data — visible only to that customer. |

**Customer onboarding flow (future):**
1. Sign up at `tools.detroitwebagency.com`
2. Stripe checkout → webhook creates `profiles` row with tier
3. Customer adds their competitor shop names via UI
4. `shop-intelligence` runs nightly and populates their dashboard
5. Customer clicks any listing → `ad-creative-generator` runs and delivers ZIP

---

## API Keys Required

| Secret | Where | Purpose |
|--------|-------|---------|
| `ETSY_API_KEY` | Secondary project Supabase secrets | Etsy Public API (no OAuth, public shop data only) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided in Edge Function runtime | DB writes |
| `PINTEREST_ACCESS_TOKEN` | Secondary project Supabase secrets | Pinterest pin creation (Machine 3) |
| `PINTEREST_BOARD_IDS` | Secondary project Supabase secrets | JSON map of category → board ID (Machine 3) |

**Already set in secondary project:** `ETSY_API_KEY`, `ETSY_SHOP_ID`

---

## Cron Schedule (secondary project)

| UTC Time | Function | Purpose |
|----------|----------|---------|
| 4:59am daily | `shop-intelligence` | Competitor intelligence scrape |
| 12pm daily | `pinterest-pinner` | Pinterest syndication (Machine 3) |
| 6am 1st/mo | `pod-listing-reaper` | Auto-retire 90d+ zero-sales listings |

---

## Phase Roadmap

| Phase | System | Status |
|-------|--------|--------|
| Phase 76 Tonight | Machine 1 (Competitor Intelligence) + Machine 2 (Ad Creatives) | ✅ Code built |
| Next Session | Machine 3 (Pinterest + real product images) | ⏳ |
| Phase 2 | SaaS customer dashboard at tools.detroitwebagency.com | ⏳ |
| Phase 2 | Stripe integration for SaaS billing | ⏳ |
| Phase 3 | Machine 4 (Trend → Queue pipeline) | ⏳ |
| Phase 3 | Keyword Opportunity Machine (find underserved niches) | ⏳ |

---

## Quick-Start Verification

After migrations applied and functions deployed to secondary project:

```sql
-- 1. Verify 20 seed shops loaded
SELECT shop_name, vertical, active
FROM tracked_shops
ORDER BY shop_name;
-- Expected: 20 rows, all active=true

-- 2. Run intelligence dry-run (no DB writes)
-- POST https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/shop-intelligence
-- Body: { "dry_run": true }

-- 3. Run real intelligence collection
-- POST https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/shop-intelligence
-- Body: {}

-- 4. View revenue ranking after first real run
SELECT
  t.shop_name,
  t.vertical,
  m.total_reviews,
  m.review_delta,
  m.estimated_daily_sales,
  m.estimated_daily_revenue,
  m.avg_listing_price_cents / 100.0 AS avg_price_usd,
  m.data_source
FROM shop_daily_metrics m
JOIN tracked_shops t ON t.id = m.shop_id
WHERE m.metric_date = CURRENT_DATE
ORDER BY m.estimated_daily_revenue DESC NULLS LAST;

-- 5. Test ad creative generator (dry run)
-- POST https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ad-creative-generator
-- Body: { "listing_id": "YOUR_LISTING_ID", "dry_run": true }
```
