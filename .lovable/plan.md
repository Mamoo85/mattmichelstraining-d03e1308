

## Plan: Agency Brand Reskin + Free SEO Tools Suite

### Scope Assessment

**58 pages** still use orange branding (`#e8621a`, `orange-500/400/600`). Reskinning all 58 in one pass is feasible — most follow the same template pattern (hero badge, price, step circles, CTA button, footer links). The changes are mechanical find-and-replace operations per file.

**However**, not all 58 pages are agency pages. Many are standalone SaaS product pages (BedtimeStories, Nutrition, ParentView, AthleteBlueprint) that belong to the M2 Training brand and should KEEP orange. Only pages linked from or related to the agency domain should get the cyan treatment.

---

### Part 1: Classify Pages — Agency vs Training

**Agency pages to reskin (linked from agency landing or B2B products):**
- `Portfolio.tsx`, `ContractorSeoPage.tsx`, `RevenuePreventer.tsx`
- `SeoGuard.tsx`, `VisibilityScore.tsx`, `FreeBidReport.tsx`, `FreeComplianceScan.tsx`
- `SpeedToLead.tsx`, `ReviewAlerts.tsx`, `ReviewRequestSMS.tsx`
- `LinkedInOutreach.tsx`, `DirectMail.tsx`, `TestimonialHarvester.tsx`
- `SocialMediaAI.tsx`, `SocialConnect.tsx`, `LocalMarketing.tsx`
- `AISocialCaptionPack.tsx`, `AIBlogPostService.tsx`, `AIPressRelease.tsx`
- `AIProposalGenerator.tsx`, `AIWebsiteCopy.tsx`, `AdGbpPosts.tsx`
- `AdCompetitorReport.tsx`, `AdFreeAudit.tsx`, `AdWebsiteAudit.tsx`
- `ClientReportGenerator.tsx`, `BusinessDirectory.tsx`, `MicroSaasToolPage.tsx`
- `KPIEmail.tsx`, `WeeklyBusinessDigest.tsx`, `IndustrialNewsletter.tsx`
- `InsuranceFollowUpDrip.tsx`, `PodcastPitchService.tsx`
- `AbandonedCartRecovery.tsx`, `QuoteFollowupSMS.tsx`, `WinBackSMS.tsx`
- `WelcomeDrip.tsx`, `ReactivationEmails.tsx`, `HolidaySMSBlast.tsx`
- `TextMessageMarketing.tsx`, `WarrantyReminders.tsx`, `NewMoverMarketing.tsx`
- `PromoPlanner.tsx`, `SalesScripts.tsx`, `TradeShowFollowUp.tsx`
- `RestaurantMenuCopy.tsx`, `HiringAssistant.tsx`, `AnnualBusinessReview.tsx`
- `EmployeeCredentialAudit.tsx`, `NewHireCheck.tsx`, `PermitWatch.tsx`
- `CommunicationsCenter.tsx`, `GetStarted.tsx`, `ProposalStewartDental.tsx`
- `ReferralPage.tsx`

**Training pages to KEEP orange:**
- `Nutrition.tsx`, `ParentView.tsx`, `AthleteBlueprint.tsx`, `BedtimeStories.tsx`

---

### Part 2: Mechanical Reskin (Per File)

Each file gets the same set of replacements:
| Find | Replace |
|---|---|
| `#e8621a` | `#22d3ee` |
| `#d4570f` / `#d45a17` | `#06b6d4` |
| `orange-500` | `cyan-500` |
| `orange-400` | `cyan-400` |
| `orange-600` | `cyan-600` |
| `orange-300` | `cyan-300` |
| `bg-slate-900` (hero bg) | Keep or change to `bg-[#0a0a0f]` for consistency |
| `matt@mattmichelstraining.com` | `matt@detroitwebagent.com` (on agency pages only) |
| `M² Development` / `M2 Development` | `Detroit Web Agency` |

This is ~54 files with purely mechanical color/text swaps.

---

### Part 3: Free SEO Tools Suite (`/free-tools`)

Build a hub page at `/free-tools` with 5 tool cards, each linking to a dedicated tool page. All tools capture email before showing results (lead magnet).

**Tools:**

1. **Site Speed Audit** (`/free-tools/speed`) — Already exists as `/free-site-scanner`. Wrap the existing `FreeSiteScanner` component or redirect.

2. **SEO Health Check** (`/free-tools/seo-health`) — New page + edge function `free-seo-health-check`. Calls DataForSEO On-Page API (`/v3/on_page/instant_pages`) for a single URL. Returns: title tag, meta description, H1 count, image alt coverage, word count, schema markup presence. Displays pass/fail scorecard.

3. **Domain Breach Scanner** (`/free-tools/breach-scan`) — New page + edge function `free-breach-scanner`. Calls HIBP API (`/api/v3/breaches?domain=`) to check if a domain has been in known data breaches. Returns breach names, dates, and compromised data types.

4. **Competitor Rank Checker** (`/free-tools/rank-check`) — New page + edge function `free-rank-checker`. Calls DataForSEO SERP API (`/v3/serp/google/organic/live/regular`) for a keyword + location. Returns top 10 results with positions.

5. **Meta Tag Analyzer** (`/free-tools/meta-tags`) — New page + edge function `free-meta-analyzer`. Calls DataForSEO On-Page API to extract and grade meta tags (title length, description length, OG tags, canonical, robots).

**Hub page design**: Matches agency obsidian theme. Each tool card has an icon, title, one-line description, and "Run Free Scan →" CTA. Header: "Free Digital Infrastructure Tools" with agency branding.

**Lead capture flow**: Email input required before results display. Email + URL stored in a `free_tool_leads` table for follow-up.

---

### Part 4: Link Audit

Verify all AgencyHome links route correctly (already audited — all confirmed working). Update Facebook link to actual business page or remove.

---

### Files Created/Modified

| Category | Count | Files |
|---|---|---|
| Reskin (orange → cyan) | ~54 | All agency product pages listed in Part 1 |
| New pages | 6 | `FreeToolsHub.tsx`, `FreeSpeedAudit.tsx` (redirect), `FreeSeoHealth.tsx`, `FreeBreachScanner.tsx`, `FreeRankChecker.tsx`, `FreeMetaAnalyzer.tsx` |
| New edge functions | 4 | `free-seo-health-check`, `free-breach-scanner`, `free-rank-checker`, `free-meta-analyzer` |
| Routes | 6 new | In `App.tsx` |
| DB migration | 1 | `free_tool_leads` table |

### Execution Order

1. Batch reskin all 54 agency pages (mechanical, no logic changes)
2. Create `free_tool_leads` table migration
3. Build 4 new edge functions
4. Build 6 new pages (hub + 5 tools)
5. Add routes to App.tsx

