# Business Audit + Customer Acquisition Plan — m2training / DWA / POD

## Context

Matt has built an enormous autonomous system (1,173 Supabase edge functions across two
projects, a 288-page React SPA, full POD pipeline, DWA radar products, cold-email/SEO/social/
ads infrastructure) but has **zero customers and zero sales**. He asked for: (1) a full business
audit, (2) 20 code-only, autonomous, <$10/day customer-acquisition improvements (auto-generated
ads welcome), (3) POD improvements, (4) a viability verdict, (5) 10 new autonomous business ideas.

### Hard numbers pulled live from the POD project (`zmyczlfuufhngzovkjdh`) on 2026-05-27
- **647 active Etsy listings**; 65 POD products `published`, 300 `pending`, 6 `error`.
- **Total favorites across all 647 listings: 50** (≈0.08/listing). Engagement is effectively zero.
- **Sales: 0** — Gumroad 0, Payhip 0, eBay 0, `pod_sales_metrics.units_last_30d` = 0.
- DWA side: paid prospecting APIs (Google Maps $1.50/day, Apollo $0.50/day) are intentionally
  disabled, so `techalert-prospect-hunter` / `outreach-prospect-replenisher` produce 0 rows.

### Diagnosis (the whole audit in one sentence)
**This is not a supply problem; it is a 100% distribution/demand problem.** The system is
optimized to *manufacture and publish* product autonomously, but almost nothing drives *qualified
traffic* to the listings or the DWA offers, and there is no closed-loop measurement telling the
system which of the 647 listings deserve more push. 647 listings / 50 favorites / 0 sales is the
signature of "published but invisible." Adding the 300 queued products makes this strictly worse
(more dilution, same zero traffic). The correct move is a hard pivot from *production* to
*distribution + measurement + concentration*.

---

## Strategic Reframe (read before the 20 levers)

1. **Stop adding net-new SKUs until traffic exists.** Pause the `pod-new-products` drain to ~1/day
   or 0. Redirect that compute to driving and measuring traffic. More listings ≠ more sales when
   per-listing traffic is ~0.
2. **You cannot improve what you cannot see.** There is no working analytics loop.
   `youtube-stats-collector` is 403'd by an API-key restriction; Etsy per-listing views aren't
   reliably available to a dev-tier app (use `num_favorers` + your own click logger instead).
   **Measurement is lever #1** — without it every other lever is guessing.
3. **Concentrate, don't spread.** Pick the 10–20 listings with the best objective viability score
   and the 2 best Shorts niches, and pour all distribution into those. A focused 20 beats a diluted 647.
4. **Free organic traffic before paid.** Pinterest + Shorts + Etsy-SEO are zero-marginal-cost and the
   pipeline already half-exists. Paid ads only make sense *after* you have a measured converting offer,
   otherwise <$10/day buys data you're not capturing.

---

## 20 Customer-Acquisition Levers (code-only, autonomous, <$10/day total)

Grouped by priority. "Have" = code already exists and needs fixing/wiring; "New" = small new function.

### Tier 0 — Measurement & Concentration (build first, $0)
1. **Fix the analytics loop (Have, blocked).** Un-restrict `YOUTUBE_API_KEY` and repair
   `youtube-stats-collector`; track `num_favorers` over time per listing. Build a single
   `growth-dashboard` read endpoint that shows daily: favorites trend, Shorts views by niche,
   click-throughs. **Nothing else on this list is trustworthy until this exists.**
2. **Listing viability scoring + auto-concentration (New, $0).** Use the already-spec'd
   `scoreListingViability()` from `SYSTEM_VIABILITY_AND_REMEDIATION_REPORT.md` to score all 647
   listings; auto-flag the bottom decile for `pod-listing-reaper` and the top 20 as "hero" listings
   that every distribution channel (Pinterest, Shorts, ads) promotes.
3. **UTM + conversion attribution everywhere (Have, partial).** Append
   `?utm_source=…&utm_campaign=[niche]&ref=…` to every bio link, Pinterest pin, and ad. Add a tiny
   `track-click` edge function + table so we can actually attribute a sale to a channel.
4. **Pause/throttle production (Have, config).** Reschedule `pod-new-products` from 5/day to ≤1/day
   via pg_cron until measured CTR > 0. Frees budget + reduces Etsy "stale shop" dilution signal.

### Tier 1 — Free organic distribution (the real engine, $0)
5. **Pinterest auto-pinner at scale (Have: `pinterest-pinner`).** Pinterest is the #1 free traffic
   source for Etsy/POD. Auto-pin every hero listing's image with keyword-rich descriptions, 5–10
   pins/day across niche boards. This is the single highest-ROI free lever for POD.
6. **Shorts: double down on the proven format (Have).** Data already shows "reference poster/chart"
   framing got 200+ views vs 1–8 for lifestyle. Kill the losing formats, generate 1–2/day only in the
   winning format + winning niches, with the loop mechanic + pinned-CTA from `SHORTS_MONETIZATION_STRATEGY.md`.
7. **TikTok auto-poster (Have: `tiktok-auto-poster`).** Re-purpose the same Shorts MP4s to TikTok.
   Same asset, second free channel.
8. **Etsy SEO self-healing on hero listings (Have: `pod-seo-agent`).** Re-target it to refresh
   titles/tags on the top-viability listings (buyer-intent phrases), not random ones. Enforce 13 tags.
9. **Pinterest Idea Pins / multi-image (New, small).** Turn each Shorts MP4 into a Pinterest video pin
   (Pinterest favors video). Reuse existing MP4s.
10. **Auto-generated SEO landing pages → organic Google (Have: `generate-seo-page(s)`).** Programmatic
    "[niche] gift guide" pages that link to hero Etsy listings; sitemap already auto-pings Google/Bing.
11. **Cross-listing internal linking (New, small).** Add "you may also like" sections / shop-section
    curation so a visitor who lands on one listing sees the hero set — lifts pages/visit and Etsy rank.

### Tier 2 — Owned audience (compounding, $0)
12. **Email lead magnet + list (Have: `process-email-queue`, `send-email-campaign`).** Free PDF
    ("50 printable [niche] ideas") captured via a Carrd-style page → weekly product-drop blasts.
    Owned list is the only channel you fully control.
13. **Re-engagement / abandoned-view drip (Have).** Once `track-click` exists, drip email/SMS to
    anyone who clicked but didn't buy.
14. **Buyer → review → repeat loop (Have: `pod-coupon-sender`).** Already sends THANKYOU15; extend to
    request reviews (social proof lifts Etsy rank) and cross-sell the hero set.

### Tier 3 — DWA B2B (highest $/customer, currently dark)
15. **Re-enable outreach within budget (Have, disabled).** Turn `outreach-prospect-replenisher` +
    `techalert-prospect-hunter` back on but **hard-capped** at the existing $2/day API budget
    (`api-budget.ts` already enforces Google Maps $1.50 / Apollo $0.50). 50 prospects/day is plenty
    to test if the offer converts.
16. **Cold-email bandit, actually sending (Have: `cold-email-bandit-pick`, `cold-email-bulk-queue`).**
    Verify deliverability (`email-deliverability-check`, SPF/DKIM) then send proof-before-pitch emails
    with demo links to the 50 daily prospects. This is the cheapest path to a $1,499 web client.
17. **DWA B2B Shorts → booked calls (Have).** The "your competitor's site vs yours" Short format;
    one Short-sourced web client = 1,000× a $5 digital sale.
18. **Free value-first lead magnets (Have: `free-seo-health-check`, `free-meta-analyzer`).** Auto-run
    a free audit for a prospect's site and email the result as the opener — extremely high reply rate.

### Tier 4 — Paid, but only after Tiers 0–1 prove a converting offer ($5–8/day)
19. **Auto-generated Meta ads → draft campaigns (Have: `ad-creative-studio` v10 works; Meta token
    acquired Phase 89).** Build the missing `meta-ads-poster` to push `ad-creative-studio` images into
    a **draft/paused** campaign in `act_1969872620513768` at $5/day, targeting the single best hero
    product. Auto-generate creative; **leave final "go live" as a one-click gate** (recommended) or
    auto-launch within the $10 cap if Matt authorizes.
20. **Google Shopping free listings + keyword feed (Have: `google-shopping-feed`,
    `google-ads-keyword-builder`).** Submit the hero listings to Google Shopping's *free* surfaces
    first ($0); only escalate to paid Performance Max keywords if free traffic converts.

---

## POD-Specific Improvements (make existing product more attractive)

- **Quality gate before publish, not after (Have spec).** Wire `scoreListingViability()` into
  `pod-new-products` so nothing publishes below 70/100 (title, 13 tags, free shipping, ≥200-char
  description, image contrast ≥3). Stops adding invisible listings.
- **Mockup-in-context images.** Buyers convert on lifestyle mockups, not flat art. Use the existing
  image pipeline to generate "product on a real wall / in a real kitchen" hero images for the top 20.
- **Bundles + higher AOV SKUs.** Add $14.99 3-packs and $29.99 kits (already recommended in Shorts doc)
  — same assets, higher order value, better ad math.
- **Free shipping enforced daily, not weekly (Have spec).** Etsy ranking factor; flip
  `etsy-free-shipping-enforcer` cron to daily.
- **Reap the dead weight.** Auto-retire the bottom-decile zero-view listings so the shop's aggregate
  quality signal rises.
- **Digital-first focus.** Zero-COGS digital downloads (wall art, checklists, coloring/sticker packs,
  KDP) are the best Shorts/Pinterest funnel — push these as the hero set first.

---

## Viability Verdict — "Is this all viable?"

- **POD as currently run: not yet viable** — not because the tech is bad, but because there is no
  distribution or measurement. With Tiers 0–1 wired up (analytics + Pinterest + focused Shorts +
  concentration), it becomes a plausible $500–2k/mo passive channel within 60–90 days. **Honest
  caveat:** even with perfect distribution, generic AI-generated POD is a thin-margin, crowded market;
  the realistic ceiling is modest. The digital-download SKUs (zero COGS) are the most viable slice.
- **DWA B2B is the higher-EV business by far** — one client is $499–1,499 + $49–99/mo. The acquisition
  machinery exists; it's just turned off. Re-enabling capped outreach + verified cold email is the
  fastest credible path to *real* revenue. Recommend prioritizing DWA over POD for $ outcomes.
- **Fully autonomous? Mostly.** A few one-time human unlocks remain (un-restrict YouTube API key,
  authorize ad spend, eBay W-9). Everything else can run on cron.

---

## 10 New Autonomous Business Ideas (ranked; reuse existing code)

1. **Done-for-you local SEO audits as a paid product (reuse `free-seo-health-check`, `seo-audit-report`).**
   Auto-generate a paid $49 PDF audit for any local business; upsell DWA. Near-zero marginal cost.
2. **AI faceless Shorts/Reels as a service (reuse `youtube-shorts-now`, `ad-creative-studio`).** Sell
   "30 niche Shorts/mo" to other small businesses — you already produce these autonomously.
3. **Programmatic micro-SaaS: "Radar" verticals you haven't filled (reuse radar scanner pattern).**
   The trade/mortgage/talent radar engine generalizes — spin up new daily-signal niches (e.g.
   restaurant-permit radar, new-mover real-estate radar) as new $49/mo products.
4. **Etsy/Printify digital template shop (reuse `etsy-digital-product-creator`, `gpt-image-1`).**
   Canva templates, printables, planners — zero COGS, evergreen Pinterest traffic.
5. **KDP low-content books at scale (reuse existing KDP/STL/coloring pipelines).** Puzzle/coloring/journal
   books; $0 to list, $3–7 royalty; Shorts as the demo.
6. **Lead-gen marketplace (reuse `marketplace-*` + `omni-lead-engine`).** Sell scored local leads à la
   carte (`sell-lead-alacarte` already exists) to contractors/agents.
7. **AI cold-email-as-a-service (reuse `cold-email-*` bandit stack).** Managed outbound for other
   service businesses — the deliverability + bandit infra is already built.
8. **Reputation/review automation product (reuse review-text + `ai-google-qa-manager`).** "Get more
   Google reviews on autopilot" — recurring $29–49/mo, included free in DWA but sellable standalone.
9. **Gumroad/Whop digital communities (reuse `whop-product-publisher`, Whop integration).** Gated niche
   communities ($4.99–9.99/mo) seeded by your Shorts audiences.
10. **AI headshots / image-gen micro-product (reuse `ai-headshots-generator`).** One-off $9–19 image
    products with instant fulfillment — pure software margin.

> Recommendation among these: **#1, #2, and #4** are the easiest, highest-margin, and reuse the most
> existing code with the least new human setup. #3 has the best recurring-revenue ceiling.

---

## Advertising Verdict — "Should I start advertising right now?"

**No. Not yet. Advertising today would be lighting money on fire — exactly what you want to stop.**

Reasoning, plainly: ads *amplify* a proven offer. You have no proof anything converts. 647 live
listings have produced **50 total favorites and 0 sales** — that's the market already telling you, for
free, that the current listings/offers don't grab people. Paid traffic doesn't fix a weak offer; it
just makes you pay to discover the same "no." At $10/day that's ~$300/mo to learn what free Pinterest
and Shorts traffic will tell you for $0.

**The gate for turning ads on (all three must be true):**
1. Free traffic is flowing (Pinterest + Shorts driving measurable clicks to listings).
2. Those clicks produce favorites/add-to-carts, and ideally ≥1–3 organic sales.
3. You have click→sale attribution wired, so a $5/day test produces *readable* data.

Until then: **$0 on ads.** When the gate is met, start at $5/day on the **single best-converting
hero product only**, build creative automatically, and keep a human "go live" tap. The DWA side is
the exception worth a *tiny* spend sooner — but even there, capped organic outreach ($2/day API)
should prove the offer before any ad dollars.

## Execution Hand-off (Sprint plan)

Sprint sequencing reflects the choice to run all three tracks in parallel. Build order within each:

**Track A — POD measurement + free traffic ($0/day):**
1. Analytics loop: un-restrict `YOUTUBE_API_KEY`, repair `youtube-stats-collector`, track favorites
   over time, build a single `growth-dashboard` JSON endpoint (edge function on the SECONDARY project
   — not a React page; avoid cross-project client wiring).
2. `track-click` redirect+log function + `link_clicks(channel,campaign,listing_id,target_url,ts)` table;
   route all bio/pin links through it with UTM.
3. Implement `_shared/validate-listing.ts` (`scoreListingViability()` is already fully drafted in
   `SYSTEM_VIABILITY_AND_REMEDIATION_REPORT.md`); batch-score all 647; tag top-20 hero + bottom-decile reaper.
4. Extend `pinterest-pinner` to push 5–10 keyword-rich pins/day of the hero set via `track-click`.
5. Throttle `pod-new-products` cron to ≤1/day (pg_cron) to stop dilution and free budget.

**Track B — DWA B2B ($2/day cap):**
6. Re-enable `outreach-prospect-replenisher` + `techalert-prospect-hunter` under the existing
   `api-budget.ts` caps (50 prospects/day).
7. Verify deliverability (`email-deliverability-check`, SPF/DKIM) then send proof-before-pitch via
   `cold-email-bandit-pick` + `cold-email-bulk-queue`, leading with a free audit
   (`free-seo-health-check` / `free-meta-analyzer`).

**Track C — one new line (pick #1, #2, or #4 from the ideas list):**
8. Easiest/highest-margin reuse: paid $49 auto-SEO-audit product, faceless-Shorts-as-a-service, or a
   digital template shop. Reuses `seo-audit-report`, `youtube-shorts-now`/`ad-creative-studio`, or
   `etsy-digital-product-creator` respectively.

**Sprint 2 (gated):** `meta-ads-poster` (creative auto-built by `ad-creative-studio` v10, Meta token
already saved Phase 89, account `act_1969872620513768`) — build to *draft/paused* at $5/day, do NOT
auto-launch. Only flip live once the advertising gate above is met.

## How to know it's working (7/30/60-day checkpoints)
- **Day 7:** first non-zero `link_clicks`; favorites climbing on hero listings; Shorts views
  concentrating in the winning "reference poster/chart" format.
- **Day 30:** favorites trending up (from 50 baseline); first organic sale; ≥1 DWA cold-email reply.
- **Day 60:** repeatable sales on the hero set OR one DWA discovery call booked. *Then* consider ads.

## One-time human unlocks (not codeable)
- Un-restrict `YOUTUBE_API_KEY` in Google Cloud (blocks all Shorts analytics today).
- eBay W-9 (blocks new eBay listings).
- Authorize the eventual $5/day ad test (only after the gate is met).
