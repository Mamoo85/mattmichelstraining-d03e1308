# DWA Print-on-Demand (Etsy) — Revenue System Playbook
## Autonomous Revenue Stream | No Fulfillment | No Customer Service

---

## Overview

This is a fully automated print-on-demand business running on Etsy via Printify.
Zero inventory, zero shipping, zero customer service handled by us.
Printify handles production and fulfillment on every order.
Our job: generate designs, publish listings, collect revenue.

**Revenue model:**
| Product | Retail | Est. Production | Profit/Sale |
|---------|--------|-----------------|-------------|
| T-Shirt | $27–$30 | ~$12–14 | ~$14–17 |
| Hoodie | $44–$45 | ~$22–25 | ~$20–22 |
| Mug | $19–$20 | ~$7–8 | ~$11–12 |
| Poster | $17–$18 | ~$4–6 | ~$12–13 |

At 10 sales/month across all listings: **~$130–150/mo passive**
At 100 sales/month: **~$1,300–1,500/mo passive**
Scales linearly — more listings = more surface area = more sales.

---

## How the System Works

```
etsy-trend-scanner (cron, monthly)
    ↓ trending niches + keywords
printify-product-creator (triggered)
    ↓ DALL-E 3 generates designs
    ↓ uploads to Printify image library
    ↓ creates products with variants + pricing
    ↓ publishes directly to Etsy
```

**Functions involved:**
- `printify-product-creator` — main orchestrator, POST to trigger
- `etsy-trend-scanner` — reads Etsy trend data to feed niches
- `pod-publisher` — alternate publisher (uses hardcoded blueprint IDs)
- `pod-design-generator` — standalone design generator

---

## Running a New Product Batch

### Manual trigger:
```bash
curl -X POST https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/printify-product-creator
```

### What it does (10 products per run):
- 4 T-shirts (trending niches: cottagecore, mental health, cat/coffee, celestial)
- 2 Mugs (coffee humor, plant parent)
- 2 Posters (boho botanical, retro sunset)
- 2 Hoodies (outdoor/hiking, alt/quirky)

### Time to complete: ~3–5 minutes
### Cost per run: ~$0.40–0.60 in DALL-E 3 API fees

---

## Secrets Required

| Secret | Where to find |
|--------|---------------|
| `PRINTIFY_API_TOKEN` | printify.com → My Profile → Connections → API |
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `PRINTIFY_SHOP_ID` | Auto-fetched from API (not required as secret) |

---

## Monthly Automation (Recommended)

Wire a monthly cron that:
1. Runs `etsy-trend-scanner` to get current trending search terms
2. Passes top niches to `printify-product-creator`
3. Creates 10 new products with fresh designs

**Target cadence:** 1st of every month = 10 new products = 120 new listings/year

---

## What to Monitor (Quarterly)

- **Etsy shop stats** — views, favorites, conversion rate
- **Top sellers** — double down with color/size variants
- **Dead listings** — remove products with 0 views after 90 days
- **Seasonal trends** — run extra batches in Oct (Halloween), Nov (holiday gifts), Feb (Valentine's), May (Mother's Day)
- **Printify production issues** — check for supplier quality complaints in Etsy reviews

---

## Niche Strategy

**Always-green niches** (run year-round):
- Mental health / self-care
- Cat lovers / pet humor
- Coffee culture
- Outdoor / hiking / adventure
- Celestial / astrology / moon
- Plant parents / botanical

**Seasonal niches** (run 4–6 weeks before):
- Halloween: spooky cute, witchy, ghosts
- Christmas: ugly sweater designs, cozy vibes
- Mother's Day: mom humor, floral
- Valentine's Day: funny anti-Valentine's, love designs
- Back to School: teacher gifts, student life

**High-competition niches to avoid** (oversaturated):
- Generic "best dad ever" / "best mom ever"
- Plain state pride (Michigan map outlines, etc.)
- Sports teams (licensing issues)

---

## Pricing Rules

- T-shirts: $27.99–$29.99 retail (never below $24.99)
- Hoodies: $44.99–$49.99 retail (never below $39.99)
- Mugs: $18.99–$21.99 retail
- Posters: $16.99–$21.99 retail (size-dependent)

Etsy takes 6.5% transaction fee + $0.20 listing fee per item.
Printify takes production cost from each sale automatically.

---

## Connection to Core Business

This stream is **separate** from the B2B SaaS products (TechAlert, Demand Radar, FieldDesk).
It runs autonomously in the background and requires no sales effort.
Any revenue goes directly to operating costs / runway extension.

**Do not route B2B prospects here.** Different customer entirely (consumers, gift-buyers).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `PRINTIFY_API_TOKEN not set` | Add secret in Supabase dashboard → Settings → Edge Functions → Secrets |
| `No Printify shops found` | Connect Etsy to Printify at printify.com → Stores |
| `DALL-E error: billing` | Check OpenAI billing limits at platform.openai.com |
| `Publish to Etsy failed` | Verify Etsy OAuth connection in Printify dashboard |
| Products created but not showing on Etsy | Etsy can take 24–48h to index new listings |

---

*Last updated: May 2026 | System owner: automated (no human required)*
