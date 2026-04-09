

## Plan: Prospector Intelligence Upgrade + Lead Management + Product Audit

### Summary

Fix the broken OpenRouter gap analysis, add lead scoring (1-10), pipeline cleanup tools, simplified drip workflow with "Start Drip" / "Batch Drip" buttons, and answer HIBP/product/free-tools questions. Also complete the previously approved visual facelift plan.

---

### Problem 1: OpenRouter Gap Analysis Failing (CRITICAL)

**Root Cause confirmed**: `perplexity/sonar-reasoning` model returns 404 — it's been removed from OpenRouter. The function falls back to `sonar-pro` for business discovery (works), but `analyzeGap()` on line 215 still calls the dead `sonar-reasoning` model.

**Fix in `supabase/functions/hybrid-prospector/index.ts`**:
- Switch `analyzeGap()` to use the **Lovable AI Gateway** (`https://ai.gateway.lovable.dev/v1/chat/completions`) with `google/gemini-2.5-flash` and `LOVABLE_API_KEY`
- Keep OpenRouter `sonar-pro` as fallback for `sonarFindBusinesses()` (it works)
- Also update `openrouter-research` Edge Function the same way for deep research calls

---

### Problem 2: Lead Scoring System (1-10 Scale)

Add an AI-powered lead score to every pipeline lead. Score calculated during gap analysis or on-demand.

**Scoring criteria** (weighted):
- **Website quality** (0-3): No website = 3, outdated/broken = 2, modern = 0
- **Review count** (0-2): 50+ reviews = 2 (established, can afford), 10-49 = 1, <10 = 0
- **Email available** (0-1): Has email = 1, no email = 0
- **Industry fit** (0-2): Core M2 verticals (HVAC, roofing, plumbing, dental) = 2, adjacent = 1, unknown = 0
- **Location** (0-1): SE Michigan = 1, elsewhere = 0
- **Site flaw severity** (0-1): Specific flaw identified = 1, none = 0

Total: 0-10. The AI gap analysis will also return a `lead_score` field.

**Changes**:
- DB migration: Add `lead_score INTEGER` column to `prospect_pipeline`
- `hybrid-prospector/index.ts`: Include lead_score in gap analysis prompt, persist it
- `AdminProspector.tsx`: Display score badge (color-coded 1-10), add sort-by-score, filter by score range

---

### Problem 3: Pipeline Cleanup & Delete

415 leads currently in pipeline — needs cleanup tools.

**Changes in `AdminProspector.tsx`**:
- Add `Trash2` delete button on each Kanban card (with confirmation)
- Add `deletePipelineLead(id)` function targeting `prospect_pipeline`
- Add "Delete Selected" bulk action in Pipeline toolbar
- Add "Archive Old" button: moves leads older than 30 days with no activity to a hidden `archived` stage
- Add pipeline stage filter for `archived` to view/restore if needed
- Add "Clear Duplicates" button: finds leads with same `business_name` + `city`, keeps newest

---

### Problem 4: Simplified Drip Workflow

The drip system exists but the UX is confusing. Make it obvious.

**Changes in `AdminProspector.tsx`**:
- On each Kanban card with an email + gap analysis done: show a prominent **"Draft Email"** button
- Once drafted (`drip_status === "drafted"`): show **"Start Drip"** button (green, prominent)
- In Pipeline toolbar: **"Batch Draft"** button for all leads with email + gap analysis but no draft
- **"Batch Send Drafted"** button for all leads with `drip_status === "drafted"` — these are "custom ready" leads with personalized demos waiting
- Visual indicator: leads with drafts ready get a pulsing amber dot

---

### Problem 5: HIBP API Usage (Answer)

HIBP is currently used in **4 edge functions** — all for existing paid products, NOT for lead prospecting:
1. `dark-web-domain-scan` — Dark Web Monitor product ($19/mo)
2. `employee-credential-scan` — Employee Credential Audit product
3. `new-hire-breach-check` — New Hire Breach Screen product
4. `generate-sample-preview` — Sample preview generator

**Can we use HIBP for leads?** Yes — we could add a "Breach Check" enrichment step to the prospector. If a lead's domain has been breached, that's a powerful sales angle ("Your employee data was exposed in 3 breaches. We can help secure your digital presence."). This would be a new column in `prospect_pipeline` and an optional enrichment button.

**Implementation**: Add `checkLeadBreach(domain)` function in `hybrid-prospector` that calls HIBP breached domain API. Add `breach_count` column to pipeline. Display as a red security badge on Kanban cards.

---

### Problem 6: Product Viability Audit

You have 64+ products across 5 waves. A full audit would:
1. Query every `*_clients` table for active subscriber counts
2. Check if the corresponding Edge Function exists and deploys
3. Check if the Stripe checkout flow works
4. Flag products with 0 subscribers as candidates for sunsetting

**Implementation**: This is best done as a one-time script (not a UI feature). I'll run a SQL query across all product tables and generate a report showing: product name, active clients, edge function status, and recommendation (keep/sunset/merge).

---

### Problem 7: Free SEO Tools (HadoSEO Reference)

The screenshot shows HadoSEO offering 15+ free tools. **Can we do this?**

**Yes, partially.** We already have the APIs:
- DataForSEO can power: Meta Tag checker, PageSpeed/CWV audit, SERP position checker, competitor analysis
- Lovable AI Gateway can power: Content gap analysis, SEO recommendations
- HIBP can power: Domain breach checker

**What we CAN'T easily do** (would need additional APIs or significant engineering):
- Bot detection/Dynamic rendering checks (need headless browser infrastructure)
- SPA-specific audits (need Puppeteer/Playwright — not available in Edge Functions)
- Framework detection (needs deep HTML parsing)

**Recommendation**: Build 5-6 high-value free tools that leverage our existing APIs, hosted at `/free-tools`. Each tool captures email before showing results (lead magnet). Start with:
1. **Site Speed Audit** (DataForSEO PageSpeed) — already have `/free-site-scanner`
2. **SEO Health Check** (DataForSEO On-Page)
3. **Domain Breach Scanner** (HIBP)
4. **Competitor Rank Checker** (DataForSEO SERP)
5. **Meta Tag Analyzer** (DataForSEO On-Page)

This is a separate follow-up project — not part of this immediate implementation.

---

### Previous Plan Items (Still Pending)

These carry forward from the approved but unimplemented plan:

1. **Kanban delete buttons** — covered above in Problem 3
2. **HeroSection.tsx facelift** — Logo PNG fix, glassmorphism, typography
3. **AgencyHome.tsx 2027 upgrade** — Grid patterns, numbered services, social proof
4. **TerminalAnimation.tsx** — Scanline effect
5. **MissedRevenueCalculator.tsx** — Slider polish
6. **HowItWorks.tsx** — Numbered step cards

---

### Files to Create/Edit

| File | Change |
|---|---|
| `supabase/functions/hybrid-prospector/index.ts` | Switch `analyzeGap()` to Lovable AI Gateway, add lead_score to prompt |
| `supabase/functions/openrouter-research/index.ts` | Same gateway fix for deep research |
| `src/components/admin/AdminProspector.tsx` | Delete buttons, lead score display, simplified drip UX, archive/cleanup tools |
| `src/components/features/HeroSection.tsx` | Logo fix, glassmorphism, typography (from previous plan) |
| `src/pages/AgencyHome.tsx` | 2027 visual upgrade (from previous plan) |
| `src/components/agency/HowItWorks.tsx` | Numbered step cards (from previous plan) |
| `src/components/agency/MissedRevenueCalculator.tsx` | Slider polish (from previous plan) |
| `src/components/agency/TerminalAnimation.tsx` | Scanline effect (from previous plan) |
| DB migration | Add `lead_score` and `breach_count` columns to `prospect_pipeline` |

### Execution Order

1. Fix hybrid-prospector (unblocks everything)
2. DB migration (lead_score column)
3. AdminProspector upgrades (delete, score, drip UX)
4. Visual facelifts (Hero + Agency)
5. Product audit script (one-time run)

