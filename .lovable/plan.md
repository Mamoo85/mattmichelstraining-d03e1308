## Plan: Pipeline Lead Delete + Visual Facelift (Training + Agency)

### Problem 1: Can't Delete Pipeline Leads

The Kanban cards in the Pipeline tab have no delete button. The `deleteLead` function exists but only works in the "All Leads" tab. Pipeline leads in `prospect_pipeline` table have no delete action.

**Fix:**
- Add `onDelete` prop to `KanbanCard` and `KanbanColumn` components
- Add a red trash icon button to each Kanban card's action row
- Create `deletePipelineLead()` function that deletes from `prospect_pipeline` by ID
- Add confirmation dialog before deleting
- Add batch delete: checkbox selection + "Delete Selected" button in Pipeline tab toolbar

---

### Problem 2: M² Training Hero Looks Dated

The current hero uses `m2-logo.jpg` with `mixBlendMode: "lighten"` which creates a grainy, pasted-on look. The layout feels like a basic mobile app card rather than a professional site.

**Fixes to `HeroSection.tsx`:**
- **Logo treatment**: Remove `mixBlendMode: "lighten"` — use the PNG version (`m2-logo-official.png`) which has proper transparency. Add subtle glow/shadow behind it instead of the grainy blend
- **Typography upgrade**: Use tighter letter-spacing, larger weight contrast between H1 and subtext. Make "Real strength. Zero gimmicks." more impactful with gradient or accent color treatment
- **Card container**: Replace the flat `bg-card/50 ring-1 ring-white/5` with a proper glassmorphism card — `backdrop-blur-xl`, subtle gradient border, refined shadow
- **Stats bar**: Cleaner spacing, subtle dividers between stats, mono-weight numbers
- **Testimonial cards**: Tighter design, subtle left-border accent instead of full border
- **CTA buttons**: More refined shadows, subtle hover animations
- **Overall**: Better vertical rhythm, more breathing room, fade-in animations via Intersection Observer

---

### Problem 3: Detroit Web Agency Landing Page — 2027 Facelift

Taking direct inspiration from HadoSEO's aesthetic (dark mode, monospace accents, clean card layouts, cyan/blue gradients, subtle grid patterns).

**Fixes to `AgencyHome.tsx` + agency components:**

#### Hero Section
- Add subtle animated grid/dot pattern background (like HadoSEO)
- Monospace font for the badge ("Detroit Web Agency") 
- Refined typography: larger H1 with tighter tracking, highlighted word gets a subtle background highlight (like HadoSEO's "visible" treatment)
- Add "Trusted by X Michigan businesses" social proof strip with avatar circles below CTAs
- Subtle gradient orb animations in background

#### Services Grid
- Numbered cards (01, 02, 03...) like HadoSEO's "How it works" section
- Monospace step numbers, cleaner card borders with hover glow
- Consistent icon sizing with subtle colored backgrounds

#### MissedRevenueCalculator
- Cleaner slider styling with custom thumb
- Card with subtle grid pattern background
- More dramatic red-to-green color transitions

#### TerminalAnimation
- Already good — minor polish: add scanline effect, subtle flicker on cursor

#### General Polish (all agency components)
- Replace inline `style={{}}` with Tailwind classes where possible for consistency
- Add subtle CSS grid pattern overlay on dark sections
- Refine all card borders: `border-white/[0.06]` instead of raw rgba
- Typography: use `font-mono` for technical elements, tighter tracking on headers
- Add smooth scroll-reveal animations (fade-up on enter)
- Footer: more substance — add quick links, contact info, social icons

---

### Files to Edit

| File | Change |
|---|---|
| `src/components/admin/AdminProspector.tsx` | Add delete to KanbanCard/KanbanColumn, add `deletePipelineLead()`, batch delete toolbar |
| `src/components/features/HeroSection.tsx` | Logo fix (PNG, no blend mode), glassmorphism card, typography upgrade, refined layout |
| `src/pages/AgencyHome.tsx` | Grid pattern background, numbered services, social proof strip, refined typography |
| `src/components/agency/MissedRevenueCalculator.tsx` | Cleaner slider, grid pattern accent |
| `src/components/agency/TerminalAnimation.tsx` | Minor polish (scanline, cursor) |
| `src/components/agency/HowItWorks.tsx` | Numbered step cards like HadoSEO |
| `src/components/agency/UptimeBar.tsx` | Refined footer bar |

### Zero Bleed
All agency changes stay within the agency domain conditional. Training hero changes only affect `HeroSection.tsx` which renders exclusively on the training side.
