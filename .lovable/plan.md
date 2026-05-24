# GNG (Guilds & Grains) Growth Plan — 100 Ideas

Two sections. Section A uses connectors we already pay for / have keys in Supabase. Section B is pure code on top of our existing tables, edge functions, and Lovable AI Gateway.

Nothing here gets built yet — this is the brainstorm board. Once you greenlight a slice, we'll spec it properly.

---

## Market context (quick)

- **Etsy 2026 reality**: organic reach is collapsing; Etsy Ads ROAS is mediocre; winners are off-platform email/SMS lists, social, and SEO funnels that ship buyers TO Etsy with the listing URL pre-clicked (Etsy weights "off-site visit converts" heavily in search rank).
- **Printify reality**: margins are thin (often $2-6/unit); winning POD shops compete on niche + design velocity + bundles, not single SKUs.
- **Gumroad reality**: digital goods (PDFs, printables, presets, Notion templates) have ~95% margin, zero fulfillment, and pair beautifully with a POD shop as "free lead magnet → upsell physical."
- **What GNG has now**: ~280 Printify SKUs synced, 213 Etsy-only orphans (Lisa's hand-knit), 67 with price drift, 150 thin-margin, storefront at /gng, gift quiz at /gifts, single-product share pages at /gift/:id.

---

## SECTION A — 50 Ideas Using Already-Wired Tools

### Etsy API leverage (we have OAuth + full scopes)

1. **Auto-renew expiring listings** — Etsy listings expire every 4 months; cron renews active ones, pauses dead SKUs (uses `etsy-product-sync`).
2. **Daily winner re-rank** — extend `etsy-winner-prioritizer` to promote top-CTR SKUs to top of shop sections each morning.
3. **Auto-rotate shop announcement** — `etsy-announcement-rotator` already exists; feed it seasonal hooks from FRED (consumer sentiment), holidays, weather alerts.
4. **Variation A/B split** — duplicate top SKUs with different titles/tags, kill the loser after 14d of impressions.
5. **Tag rotation engine** — 13 tags/listing, rotate 3 per week based on Etsy search trend deltas (use `etsy-trend-scanner`).
6. **Auto-translate top 20 listings** — Lovable Gateway → Gemini Flash → push German/French/Spanish via Etsy multi-language API. Free expansion to EU buyers.
7. **Photo order optimizer** — for each listing pull `image_rank` from sales, reorder so highest-converting image is hero.
8. **"Made by GnG" badge automation** — auto-tag orphan_etsy SKUs (the 213 hand-knit) with provenance line + price premium ($5+).
9. **Coupon auto-creator** — Etsy Promotion API + first-time-buyer 10% coupon emailed via Resend on cart abandon webhook.
10. **Section auto-curation** — group SKUs into seasonal sections (Spring, Cozy, Gifts<$25) by attribute clustering nightly.

### Printify leverage

11. **Print provider failover** — `printify-auto-sync` already pulls catalog; auto-switch provider when one goes red (out of stock / price hike).
12. **Cost-shift alerts** — Printify webhook → SMS Matt when any product's wholesale cost rises >5% so prices can be re-floor'd.
13. **Bulk mockup regen** — push new lifestyle mockups via Printify Mockup API on the 50 highest-impression listings.
14. **New-blank auto-evaluator** — when Printify adds a new blank (e.g. new mug brand), AI scores it for fit and proposes 5 starter designs.
15. **Quality dispute auto-file** — when Stripe `dispute.created` or Etsy review ≤3★, draft Printify replacement ticket pre-filled.

### Stripe (direct-to-consumer funnel that skips Etsy's 6.5% fee)

16. **Direct-Stripe checkout at /gift/:id** — "Buy on Etsy" stays, but add "Buy direct (save $3)" with Stripe inline price_data → Printify order via API. ~10% margin lift.
17. **Gift card storefront upgrade** — `purchase-gift-card`/`redeem-gift-card` already exist; surface them on /gng as a $25/$50/$100 product line (zero COGS).
18. **Bundle SKUs** — Stripe checkout for "Cozy Sunday Bundle" (mug + socks + sticker) priced at 90% of sum, fulfilled as 3 Printify orders. Boosts AOV.
19. **Founding-customer 1k-buyer wall** — first 1k direct buyers get lifetime 10% off, name on a /wall-of-grains page. Stripe metadata flag.
20. **Subscribe-and-save** — Stripe subscription for "Sock of the Month" — auto-pulls a new SKU each month from top winners.

### Resend email

21. **Post-purchase review followup** — 14 days after Etsy/Stripe order → branded email asking for review with direct deep-link to review page.
22. **Abandoned-cart recovery** — visitor-identify already wired; if known email visits /gift/:id 2x without buying, fire 3-email drip.
23. **Weekly "new drops" newsletter** — auto-built from Printify products created in last 7d, sent every Friday to opt-in list.
24. **Birthday coupon** — `birthday-campaign-sender` already exists; clone for gift-buyers (use their recipient's birthday from gift-card flow).
25. **VIP early-access** — top 50 LTV customers get 24h preview window on new drops before public.

### Twilio SMS

26. `**gng-sms-inbound` upgrade** — Lisa texts a photo + caption → auto-creates Printify draft + Etsy listing.
27. **Restock-alert SMS** — buyer texts SKU keyword → opt-in for restock notification when Printify shows back in stock.
28. **VIP flash drops** — SMS list gets 1hr-only 15% codes on new releases.

### AI gateway (Opus / Haiku / Gemini / Nano Banana)

29. **AI listing writer** — Haiku rewrites title + 13 tags + description for every new Printify product before publish; A/B against human draft.
30. **Nano Banana mockup pipeline** — drop a flat design PNG → Gemini 2.5 Flash Image generates 6 lifestyle scenes (kitchen, gift box, flat-lay, etc.) automatically.
31. **AI gift quiz upgrade** — /gifts uses Gemini to score answers → personalized 5-SKU shortlist instead of static rules.
32. **AI review responder** — auto-draft (Lisa approves) replies to every Etsy review using `ai-google-qa-manager` pattern.
33. **AI title polish on rename** — when shop renames `Yarningforyoubylisa → GuildsAndGrains`, regenerate all 280 titles for brand voice consistency.
34. **AI SEO writer** — `ai-local-seo-writer` repurposed for /gng blog: 1 SEO post per week targeting Etsy long-tail keywords.
35. **AI message triage** — Etsy customer messages classified (refund/sizing/custom/spam) and auto-drafted reply.
36. **AI custom-order intake** — buyer fills /custom form → AI extracts spec, quotes price, sends Stripe payment link.
37. **AI competitor watch** — `ai-competitor-watch` extended: nightly scrape top 10 competitor Etsy shops for new SKUs, prices, sales velocity.
38. **AI trend-tag rotator** — Gemini reads Etsy Trend page + Pinterest predicts + Google Trends → outputs week's tag rotation set.

### Firecrawl

39. **Daily Etsy trends scrape** — scrape etsy.com/trending + category pages, feed into trend-scanner DB.
40. **Pinterest pin scraper** — Firecrawl pinterest.com/search results for top niches → reverse-image-search to find under-served SKU ideas.
41. **Reddit niche listening** — scrape r/RandomActsOfChristmas, r/Etsy, r/giftideas weekly for "I'm looking for…" posts → drop product link replies (manual approval).
42. **Competitor price tracker** — scrape 10 top-competitor product pages daily, alert on price drops/raises.
43. **Google Shopping SERP scrape** — for top 20 SKUs, see if we appear in Google Shopping organic + competitor rank.

### Apollo / Hunter / Snov (B2B angles for wholesale + gift biz)

44. **Wholesale buyer prospecting** — Apollo search for "gift shop owner" / "boutique buyer" in MI → cold email Lisa's curated 30-SKU wholesale catalog.
45. **Corporate gifting outreach** — Apollo "office manager" / "HR coordinator" 100-500 employees → "holiday client gift" pitch with bundle pricing.
46. **Wedding planner outreach** — Hunter find wedding-planner emails → "favors + bridesmaid socks" partnership pitch.

### HubSpot

47. **CRM sync** — every Etsy + Stripe customer pushed to HubSpot Contacts; segment by AOV, LTV, last-purchase, gifter-vs-self.
48. **Lifecycle stages** — auto-move contacts: Lead → Customer → Repeat (2+) → VIP (5+) → Lapsed (>180d) → Win-back drip.

### Lob / Sinch (memory says use these)

49. **Postcard thank-you** — Lob auto-mails handwritten-style postcard to every order >$50, includes 15% return coupon. (~$1.20/card, lifts repeat-rate ~3x.)
50. **B2B fax to gift shops** — Sinch fax wholesale linesheet PDF to 500 boutique owners (CSV from Apollo). Old-school but uncontested channel.

---

## SECTION B — 50 Pure-Code Enhancements

### Pricing & margin intelligence (we already have `gng_audit_runs`, `printify_products`)

51. **Dynamic price floor enforcer** — daily job: if Etsy price < cost × 2.4 + $4.50, auto-raise to floor, log adjustment.
52. **Demand-based surge pricing** — last-7d sales velocity > threshold → +$2; <threshold → -$1 (within floor).
53. **Holiday auto-markup** — Nov 15 → Dec 20 add +$2 across gift SKUs, revert Dec 21.
54. **Cross-SKU bundle discounts** — algorithmic "frequently bought together" detection from order history → auto-create bundle SKUs.
55. **Profit dashboard at /dwa-admin/gng** — net margin per SKU, per provider, per month, with sparklines.

### Catalog hygiene

56. **Dead-SKU sweeper** — listings with 0 views in 60d → auto-pause + email Lisa "kill or revive?"
57. **Duplicate detector** — image hash + title similarity → flag dupes before publish.
58. **Title-length linter** — Etsy caps at 140; auto-truncate intelligently preserving keywords.
59. **Tag overlap analyzer** — show which tags repeat across too many listings (cannibalization).
60. **Category misclassification scan** — AI checks each listing's Etsy category, suggests better one.

### Storefront UX (m2training routes)

61. **/gng homepage rebuild** — hero collection + bestsellers + new drops + "shop by mood" + reviews wall + email capture.
62. **Sticky gift-quiz CTA** — floating "Find the perfect gift in 30s" button on all GNG pages.
63. **Recently-viewed strip** — localStorage-tracked, shown in /gifts.
64. **Wishlist (no-auth)** — localStorage + share-by-link.
65. **Compare table** — pick 2-3 SKUs, side-by-side specs + price.
66. **Search with typo-tolerance** — Fuse.js over etsy_products, faceted by tag/price/color.
67. **Color/size filter chips** — pull variants from Printify raw json.
68. **Quick-view modal** — open product preview without leaving grid.
69. **"Made in Detroit" filter** — Lisa's hand-knits surface separately.
70. **Free-shipping threshold bar** — "$8 away from free shipping" sticky banner (drives AOV).

### SEO (memory rule: H1, meta, JSON-LD, alt, canonical)

71. **JSON-LD Product schema** on every /gift/:id (we have this; expand to /gng + collection pages).
72. **Sitemap auto-rebuild** — cron generates sitemap.xml from etsy_products nightly, pings Google.
73. **Programmatic landing pages** — /gifts/for-mom, /gifts/under-25, /gifts/coffee-lovers — 50+ pages auto-generated from tag combinations.
74. **Blog at /gng/blog** — weekly AI-written gift guides, internal-linked to product pages.
75. **Open Graph image generator** — per-SKU OG card with product photo + price for share previews.
76. **Pinterest-ready meta tags** — `og:rich_attachment` + Product Pin tags so Pinterest auto-creates rich pins.
77. **Breadcrumb schema** + visible breadcrumbs.
78. **Canonical chain** — /gift/:id canonicals to itself even when accessed via /gifts/:tag/:id deep links.

### Conversion & retention

79. **Exit-intent popup** — 10% off for email signup, fires on mouse-to-tab-bar.
80. **Social proof ticker** — "Sarah from Portland bought Cozy Mug 4min ago" (real Stripe/Etsy data, anonymized).
81. **Live review carousel** — pulls real Etsy reviews via API, rotates on /gng.
82. **Trust badges row** — handmade-in-USA, 30-day returns, secure checkout (just SVG icons + copy).
83. **Gift-message field** — capture custom note at checkout, prints on packing slip via Printify metadata.
84. **Gift wrapping toggle** — +$3 line item, flagged for Lisa's manual touch on orphan_etsy SKUs.
85. **Loyalty point ledger** — `gng_loyalty_points` table; 1pt/$1, 100pts = $5 off. Pure DB + cron, no external system.

### Analytics & ops

86. **First-party visitor analytics** — extend SiteRadar's visitor-identify to log /gng funnel; show drop-off per step in admin.
87. **Funnel attribution** — UTM-tagged links from email/SMS/social → match Stripe sessions → ROAS per channel.
88. **Cohort retention table** — admin view: % of Jan buyers who bought again in Feb/Mar/…
89. **Inventory-velocity alerts** — when a winner sells 5+ in a week, SMS Lisa "boost ads or duplicate."
90. **Refund-rate by SKU** — flag any SKU with refund rate >5%, auto-pause.

### Digital-goods / Gumroad-style expansion (zero COGS)

91. **Digital product table** — `digital_products` (id, title, price, file_url, downloads). Sell knitting patterns, printable gift tags, recipe cards.
92. **Stripe digital checkout** — pure-Stripe flow (no Printify), Resend emails signed S3 link post-payment.
93. **Free lead magnet** — "Free Knitting Starter Pack PDF" gates email signup, drips into store promos.
94. **Pattern bundle subscription** — $5/mo "new pattern every month" subscription, auto-emails on the 1st.
95. **Affiliate program** — `gng_affiliates` table, unique discount codes, Stripe metadata attribution, 15% commission auto-calculated.
96. **License-key generator** — for premium patterns, generate per-buyer keys to prevent sharing.
97. **Customer dashboard** — `/my-gng` shows past orders, downloads, loyalty points, wishlist, gift cards.
98. **Review-for-discount loop** — submit review → unlocks 10% next-order code (we verify via Etsy API).
99. **Referral engine** — share link → friend buys → both get $5 credit (loyalty-point table).
100. **B2B wholesale portal at /gng/wholesale** — gated by `has_role('wholesale_buyer')`, shows 40%-off linesheet, NET-30 invoicing via Stripe Invoices, minimum-order enforcement.

---

## Recommended first slice (if you say "go")

Highest leverage / lowest effort cluster:

- #51 Dynamic price floor enforcer (locks in margin TODAY across 150 thin SKUs)
- #21 Post-purchase review followup (compounds Etsy SEO rank)
- #29 AI listing writer (improves every new publish from now on)
- #61 /gng homepage rebuild + #79 exit-intent (lifts conversion immediately)
- #16 Direct-Stripe at /gift/:id (recaptures Etsy's 6.5% fee)
- #91-93 Digital products MVP (free lead magnet → email list → flywheel)

That's ~1 week of work and probably moves revenue more than the next 80 items combined.

Pick the ones you want and I'll spec the migrations + edge functions in the next plan. Do #6 for sure! Also only do the ones that doesn't require my intervention for now. Then you have to do full tests on every single one.