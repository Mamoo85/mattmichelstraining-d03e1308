

# OpenRouter + Perplexity Sonar Integration

## Summary

Create a centralized OpenRouter edge function using `perplexity/sonar` for live web research, then wire it into the Prospector pipeline, competitor tools, and market intel functions. Add a "Deep Research" button to the Prospector UI that returns real-time business intelligence.

---

## Technical Details

### 1. New Edge Function: `openrouter-research/index.ts`

Centralized utility that hits `https://openrouter.ai/api/v1/chat/completions` with model `perplexity/sonar`. Accepts `{ query, system_prompt?, max_tokens? }` and returns `{ content, citations }`. Uses existing `OPENROUTER_API_KEY` secret (already configured). Standard CORS headers. This becomes the single entry point for all live web research across the platform.

### 2. Upgrade `prospect-website-audit/index.ts`

Add a second research step: after the existing Firecrawl scrape + Lovable AI pain-point analysis, call `openrouter-research` internally (or inline the OpenRouter call) with the prompt: "Search the web for recent news, services, and business pain points for {business_name} in {industry}." Return both `pain_points` (existing) and new `deep_research` field (3-bullet live intel summary) in the response.

### 3. Upgrade `competitor-watch-weekly-sender/index.ts`

Before the existing Firecrawl scrape loop, add an OpenRouter Sonar call per competitor: "What are the latest changes, promotions, and news for {competitor_url}?" Prepend the live research results to `competitorData` so the final AI analysis is grounded in real-time web data rather than just scraped page content.

### 4. Upgrade `competitor-pricing-scan/index.ts`

After detecting a pricing page change, add an OpenRouter Sonar call: "What are {competitor_name}'s current publicly listed prices and any recent pricing announcements?" Append this live context to the Claude diff prompt for more accurate change analysis.

### 5. Upgrade `market-intel-sender/index.ts`

Replace or supplement the Firecrawl search step with an OpenRouter Sonar call: "Latest {industry} industry news and market developments in {location} this week." This gives factual, cited results instead of Firecrawl search (which is less reliable for news).

### 6. Upgrade `gov-contract-monitor/index.ts`

Add an optional OpenRouter enrichment step: after SAM.gov fetch, for the top 5 scored opportunities, call Sonar with "Recent news about {awarding_agency} {solicitation_title}" to add real-time context to the AI scoring prompt.

### 7. Frontend: AdminProspector.tsx — "Deep Research" Button

- Add a **"Deep Research"** toggle/button on each Kanban lead card (next to existing "Audit" button)
- When clicked: calls `openrouter-research` with the business name + industry + city
- Shows `Loader2` spinner with "Scouring the live web..." text
- Displays results as a new `deep_research` section on the card (below pain points)
- Add `deep_research` column to `prospect_pipeline` table (JSONB, nullable) via migration
- Include `deep_research` data in the n8n payload sent by `send-lead-to-n8n`

### 8. Update `send-lead-to-n8n/index.ts`

Add `deep_research` field to the JSON payload so n8n workflows receive the live intel alongside pain points for automated outreach.

---

## Database Migration

```sql
ALTER TABLE public.prospect_pipeline 
  ADD COLUMN IF NOT EXISTS deep_research JSONB;
```

## Files Changed

| File | Action |
|------|--------|
| `supabase/functions/openrouter-research/index.ts` | NEW — centralized Sonar utility |
| `supabase/functions/prospect-website-audit/index.ts` | Edit — add deep research call |
| `supabase/functions/competitor-watch-weekly-sender/index.ts` | Edit — add Sonar pre-research |
| `supabase/functions/competitor-pricing-scan/index.ts` | Edit — add Sonar enrichment |
| `supabase/functions/market-intel-sender/index.ts` | Edit — add Sonar news search |
| `supabase/functions/gov-contract-monitor/index.ts` | Edit — add Sonar context for top opps |
| `supabase/functions/send-lead-to-n8n/index.ts` | Edit — include deep_research in payload |
| `src/components/admin/AdminProspector.tsx` | Edit — add Deep Research button + UI |
| Migration: add `deep_research` column | NEW |

