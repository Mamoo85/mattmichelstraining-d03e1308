
Goal: lower AI spend on simple extraction and decide whether replacing Firecrawl is actually worth it without breaking the scraping layer.

What I found
- `parse-workout-text` is already using `google/gemini-2.5-flash-lite`, so that one is already optimized.
- Shared helper `supabase/functions/_shared/ai.ts` already defaults to `google/gemini-2.5-flash-lite`, but many high-volume functions bypass it and call models directly.
- `candidate-deep-enrich` still uses:
  - `perplexity/sonar-pro` for OSINT search
  - `google/gemini-2.5-flash` for dossier synthesis
  - regex JSON parsing in multiple places
- `hire-alert-scanner` already uses the shared AI helper for some work, but still has direct OpenRouter + Firecrawl usage for search/scrape paths.
- Scraping is not centralized today:
  - `_shared/stealth-scrape.ts` wraps Firecrawl v2
  - at least dozens of other functions still hit Firecrawl v1/v2 directly
- That means a Firecrawl swap is not one edit; it needs an adapter layer rollout.

Recommended implementation

1. Create a shared “cheap extraction” helper
- Add one shared backend helper for structured extraction/classification tasks only.
- Default model: `google/gemini-2.5-flash-lite` via Lovable AI.
- Optional secondary provider: OpenRouter cheap model fallback.
- Use tool-calling / schema-driven output instead of regex-parsing JSON from free text.
- Include explicit routing by task type, e.g.:
  - `name_parse`
  - `address_parse`
  - `company_vs_person_classification`
  - `contact_field_normalization`
  - `simple_record_extraction`

2. Move only the cheap/high-volume stages first
First migration targets:
- `candidate-deep-enrich`
  - cheap model for any simple extraction/cleanup/classification
  - keep Sonar only for true web-search OSINT
- `enrich-postcard-addresses`
  - keep search/discovery on OpenRouter if needed
  - move final address normalization/field extraction to cheap helper
- any other text-to-structured parsers using direct `gemini-2.5-flash` where the job is simple extraction, not reasoning

3. Keep expensive models only where they add real value
Do not downgrade:
- live web search / OSINT discovery
- dossier writing that depends on nuanced synthesis
- anything needing citations or broader reasoning
This preserves Talent Radar quality while cutting waste on parsing tasks.

4. Add measurement before and after
I’d add provider-level metrics to the existing enrichment logs so we can see:
- task type
- model/provider used
- success/failure
- rough token/cost bucket
- fallback usage
That gives you a real “which APIs are worth it” report instead of guessing.

Firecrawl vs Crawl4AI evaluation

Reality in this stack
- Crawl4AI is Python-based and would need to run outside this project.
- This project’s backend runtime is Deno edge functions, so we cannot host Crawl4AI natively here.
- A real swap means:
  - host Crawl4AI elsewhere
  - call it from edge functions through a provider adapter
  - migrate existing direct Firecrawl calls gradually

Best migration shape
1. Create a single shared scraper adapter:
   - `scrape(url, opts)`
   - `search(query, opts)`
2. Put Firecrawl behind that adapter first.
3. Add Crawl4AI as a second provider later.
4. Migrate direct Firecrawl callers to the adapter.
5. Then switch provider by config instead of editing many functions.

My recommendation
- Do not “rip and replace” Firecrawl first.
- First centralize the scraping API.
- Then test a hybrid:
  - keep Firecrawl for JS-heavy / anti-bot sites
  - use Crawl4AI for lower-friction pages if it proves cheaper
This reduces risk and avoids breaking dozens of existing functions.

Important decision needed
Two names in your request need confirmation before implementation:
- “Gemini 3.1 Flash Lite” — the practical cheap Lovable AI option currently in this codebase is `google/gemini-2.5-flash-lite`
- “MiMo-V2-Pro” — I need the exact OpenRouter model ID you want, unless you want me to wire the helper so Lovable AI cheap-tier is the default and OpenRouter is only a configurable fallback

Implementation plan after approval
1. Add shared cheap-extraction helper with schema/tool-calling
2. Refactor `candidate-deep-enrich` to split:
   - cheap extraction/classification
   - premium OSINT/search only where needed
3. Refactor `enrich-postcard-addresses` to use cheap normalization after discovery
4. Add per-provider logging so we can measure exactly what each API contributes
5. Add shared scrape adapter in front of Firecrawl
6. Inventory and migrate the highest-impact direct Firecrawl callers to the adapter
7. Prepare Crawl4AI-ready adapter path so you can switch later without another big refactor

Expected outcome
- Lower AI cost on repetitive parsing/extraction tasks
- Cleaner structured output with fewer regex-JSON failures
- Better visibility into real API ROI
- Safer path to testing Crawl4AI without destabilizing current scraping flows
