

# Prompt 108: God Mode Periodization Engine & Batch Assignment

## Overview
Overhaul the Biomechanics scanner to add pre-generation parameter controls, an upgraded AI system prompt with strict S&C programming rules, a fully editable exercise-level results UI, and dual save actions (single client assign + master template batch assign).

## Database Changes

### New table: `master_templates`
```sql
CREATE TABLE public.master_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  experience_level TEXT NOT NULL,
  program_duration TEXT NOT NULL,
  primary_focus TEXT NOT NULL,
  equipment TEXT[] NOT NULL DEFAULT '{}',
  ai_findings JSONB,
  program JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.master_templates ENABLE ROW LEVEL SECURITY;
-- Admin-only access
CREATE POLICY "Admins can manage master_templates"
  ON public.master_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

No other schema changes needed — `client_assessments` already has `draft_program` JSONB which can store the richer program structure.

## Edge Function Changes (`analyze-biomechanics/index.ts`)

1. **Accept new parameters** from request body: `experienceLevel`, `programDuration`, `primaryFocus`, `equipment[]`
2. **Build a dynamic system prompt** that injects the four strict rules:
   - Rule 1 (Autogenic Inhibition): For every overactive muscle, prescribe PNF/ischemic compression in daily prep
   - Rule 2 (Ground-Up Protocol): Always include foot/ankle health work (short-foot holds, loaded dorsiflexion)
   - Rule 3 (Experience Level Logic): Conditional programming based on level (linear progression vs wave loading vs Russian volume)
   - Rule 4 (The Math): Exact week-by-week progressive overload percentages (e.g., Week 1: 6x6 @ 70%)
3. **Update tool-calling schema** to include `intensity_percent` and `tempo` fields on exercises, and `weekly_progression` array on each phase
4. **Store the parameters** alongside the assessment in `client_assessments` (add to the insert payload as part of `draft_program` metadata)

## Admin UI Changes (`AdminBiomechanics.tsx`)

### Pre-Generation Control Panel
Add four controls between the client selector and the drop zone:
- **Experience Level**: Select dropdown — Beginner, Intermediate, Experienced, Advanced
- **Program Duration**: Select dropdown — 2-Week Rapid Corrective, 4-Week Volume Accumulation, 8-Week Full Mesocycle
- **Primary Focus**: Select dropdown — Corrective/Mobility, Hypertrophy, Raw Strength, Athletic Power
- **Equipment**: Multi-select checkboxes — Full Gym, Dumbbells/Kettlebells Only, Bodyweight/Bands

Pass these parameters to the edge function call.

### Fully Editable Results UI
Replace the current JSON textarea editor with a structured exercise-level editor:
- Each phase rendered as an accordion/card
- Each exercise row shows editable fields: name, sets, reps, intensity %, tempo, notes
- Add/remove exercise buttons per phase
- Inline editing without switching to "edit mode"

### Dual Save Actions (replacing single approve button)
- **Action A: "Assign to Single Client"** — saves to `client_assessments` with status "approved" (current behavior)
- **Action B: "Save as Master Template & Batch Assign"** — opens a dialog/modal:
  1. Saves program to `master_templates` table
  2. Shows a multi-select list of clients + teams
  3. On confirm, creates `client_assessments` records for each selected user with the template program

## Files to Create/Edit

| File | Action |
|------|--------|
| `supabase/functions/analyze-biomechanics/index.ts` | Rewrite system prompt builder + updated tool schema |
| `src/components/admin/AdminBiomechanics.tsx` | Add control panel, editable exercise UI, dual actions |
| Migration SQL | Create `master_templates` table with RLS |

## Technical Notes
- Equipment multi-select will use checkbox group (not a Select component) since multiple values are needed
- The batch assign modal will query both `profiles` and `team_rosters` + `team_members` for team-level assignment
- Experience level logic is injected into the system prompt dynamically, not hardcoded in the tool schema

