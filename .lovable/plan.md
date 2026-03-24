

## AI Generator Simplification — Implementation Plan

### What We're Building
Replace the dropdown-heavy generator UI with a clean two-path interface ("Build a Workout" / "Fix a Pain Point"), each leading to a single textarea + optional image upload. Update the edge function to accept unstructured natural language and infer all parameters.

### Files to Change

#### 1. Edit: `src/pages/FreeAiGenerator.tsx`
**Remove:** All `Select` dropdowns, `EXPERIENCE`, `GOALS`, `DAYS`, `EQUIPMENT` constants, and their state variables (`experience`, `goal`, `daysPerWeek`, `equipment`).

**Add — Fork UI (initial state):**
- New state: `path: null | "workout" | "fixit"` and `userText: string`
- When `path === null`, render two large styled buttons side by side:
  - `🏋️‍♂️ Build a Workout` → sets path to "workout"
  - `🩹 Fix a Pain Point` → sets path to "fixit"
- Styled as large cards with icons, dark bg, primary border on hover, framer-motion entrance

**Path A — "workout":**
- `<GymPhotoUpload />` with label "Snap a picture of your gym equipment (or skip)"
- Single `<Textarea>` — placeholder: "Tell me about yourself. (e.g., I'm 35, been lifting for a year, want to get stronger, and I only have 3 days a week)."
- Giant "Generate Program" button
- Validation: require `userText` to be non-empty

**Path B — "fixit":**
- Single `<Textarea>` — placeholder: "Where does it hurt and when does it happen? (e.g., My lower back tightens up during heavy squats)."
- Giant "Generate Rehab Protocol" button
- No image upload
- Validation: require `userText` to be non-empty

**handleGenerate update:**
- Send `{ path, userText, gymImageBase64 }` instead of old structured fields
- Keep all existing result rendering, rate limiting, email modal logic unchanged

**Back button:** Small "← Back" link to return to fork from either path

#### 2. Edit: `supabase/functions/free-workout-generator/index.ts`
**Input handling:**
- Accept new fields: `{ path, userText, gymImageBase64 }` alongside legacy fields for backward compatibility
- Remove strict validation for `experience`, `goal`, `daysPerWeek` when `path` + `userText` are provided

**System prompt — Path "workout":**
- Instruct AI to infer experience level, goals, training days, and equipment from the user's natural language input
- Keep existing 5-phase structure, compound movement rules, exercise library context
- If image provided, keep existing vision mode clause
- Default to 3 days/week if not mentioned

**System prompt — Path "fixit":**
- New rehab-focused prompt: infer the injury/pain pattern from natural language
- Output a corrective protocol with phases: Tissue Release, Mobility, Isometric/Corrective Loading
- Same JSON output structure (title, description, days) but days represent protocol phases instead

**Tool call schema:** Keep identical `create_program` schema — works for both paths

### Styling Notes
- Fork buttons: `bg-card border-2 border-border hover:border-primary` with large icon, bold label, subtle description
- Textarea: taller (h-28), dark bg, clean border
- Generate button: full-width, h-14, primary bg, uppercase tracking
- Add a subtle "← Choose different path" back link above the textarea

### Technical Notes
- GymPhotoUpload component reused as-is
- All rate limiting, email modal, upsell CTA, TechShowcaseMarketing remain unchanged
- Edge function maintains backward compatibility with old structured fields

