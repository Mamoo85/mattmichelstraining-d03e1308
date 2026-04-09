

## Plan: Deep Research Upgrade + Custom Demo Email Framework + UI Enhancement

### What We're Building

Transform the prospector from a generic "you need a website" pitch into a hyper-personalized outreach system that extracts structured intel (core service, specific site flaw, recent activity) and generates emails that reference a custom-built demo site for each lead.

---

### Step 1: Database Migration — Add Structured Research Columns

Add three new columns to `prospect_pipeline`:
- `core_service` (text) — their main money-maker
- `specific_site_flaw` (text) — exact technical/UX failure
- `recent_activity` (text) — recent blog post, project, or review

These will be populated by the upgraded gap analysis and displayed in the UI.

---

### Step 2: Upgrade `hybrid-prospector` Gap Analysis

Replace the current `analyzeGap()` function that returns a single sentence with a structured JSON extraction using `perplexity/sonar-reasoning` (upgraded from `sonar-pro`).

**Current**: Returns 1 sentence like "No chat widget — lost leads after 5pm."

**New**: Returns structured JSON:
```json
{
  "core_service": "Emergency Plumbing",
  "specific_site_flaw": "Contact form buried on 3rd page, no click-to-call on mobile",
  "recent_activity": "Posted a 5-star Google review response about a kitchen remodel 2 weeks ago",
  "gap_summary": "No chat widget or after-hours contact — every visitor after 5pm is lost"
}
```

The `HybridResult` interface will be extended with these new fields. The `gap_analysis` field will continue to hold `gap_summary` for backward compatibility, and the three new fields will be returned alongside it.

---

### Step 3: Update `pipeline-drip-send` Email Generation Prompt

Replace the current AI prompt with the "Custom Demo" email framework:

1. **Hook** — Compliment/observation referencing `recent_activity` or `core_service`
2. **The Problem** — Casually mention `specific_site_flaw`
3. **The Unreasonable Offer** — "I actually went ahead and built a live demo of a new, automated site specifically for [Business Name]. It fixes that [specific_site_flaw] and includes a 24/7 lead-routing engine."
4. **CTA** — "Do you have 2 minutes for me to send the private link over so you can see it?"

Tone: Matt Michels, Lead Web Agent at Detroit Web Agency. Under 5 sentences. No jargon, no AI buzzwords.

The prompt will receive the structured research JSON so the AI has rich context for personalization.

---

### Step 4: Update `addToPipeline()` to Store New Fields

When hybrid results are added to the pipeline, persist `core_service`, `specific_site_flaw`, and `recent_activity` from the structured gap analysis response.

---

### Step 5: UI — Display New Intel Columns

In `AdminProspector.tsx`:

**Hybrid Results table**: Add `Core Service` and `Site Flaw` columns alongside the existing `Gap Analysis` column.

**Pipeline tab**: When viewing lead details/preview, show the structured research fields so Matt can review the AI's research before approving the email.

---

### Technical Details

| File | Change |
|---|---|
| DB Migration | Add `core_service`, `specific_site_flaw`, `recent_activity` columns to `prospect_pipeline` |
| `supabase/functions/hybrid-prospector/index.ts` | Upgrade `analyzeGap()` to use `sonar-reasoning`, return structured JSON |
| `supabase/functions/pipeline-drip-send/index.ts` | Rewrite AI prompt with Custom Demo framework using structured fields |
| `src/components/admin/AdminProspector.tsx` | Display new columns in hybrid results + pipeline views |

### Demo Spin-Up Strategy

Yes — using Lovable to clone a master "Industrial Template" is the right play. You can maintain 5-6 industry master templates (roofing, dental, plumbing, HVAC, landscaping, general contractor) and clone + customize them in under 5 minutes per lead when someone replies. This can be a follow-up task once the outreach system is generating replies.

