

# Plan: Elevate All 7 Demo Mockups to "WOW" Level

## Analysis

**Youngblood** (399 lines) is already strong — animated hero, smart header, marquee, 9 sections. The gap between it and their current site is dramatic. Minor polish needed.

**The other 6 demos** (185-221 lines each) are functional but generic. They share the same template feel: hero with stock photo overlay, basic stat grid, simple card grid, form footer. No animations beyond RevealSection fade-ins. No unique industry personality. A prospect would think "nice template" not "WOW."

## Strategy: Industry-Specific "Signature Elements"

Each demo gets a unique, profession-appropriate interactive/animated element that makes a prospect think "this person *gets* my industry." Plus universal upgrades across all 7.

---

## Universal Upgrades (All 7 Demos)

1. **"REDESIGN CONCEPT" badge** — Fixed pill (top-right on desktop, bottom on mobile) linking to `/detroit-web-design` with phone number. Currently only on Youngblood.
2. **Smart sticky header** — Hide-on-scroll-down, show-on-scroll-up (currently only Youngblood has this).
3. **Animated counter stats** — Numbers count up when scrolled into view instead of appearing static.
4. **Richer footer** — Multi-column layout with service links, hours, service area, plus the lead form. Currently all have single-column form-only footers.
5. **"Built by" attribution line** in footer linking to `/detroit-web-design`.

---

## Per-Demo Upgrades

### 1. Plumber (`PlumberMockup.tsx` — currently 211 lines)
- **Signature element**: Animated "water drip" CSS pulse behind the emergency badge, plus a live-updating "Average response time" counter that ticks
- **Add**: "Service Area" map placeholder section with neighborhood pills (Grosse Pointe, St. Clair Shores, Harper Woods, Warren, etc.)
- **Add**: "Our Process" 4-step horizontal timeline (Call → Dispatch → Fix → Guarantee)
- **Upgrade**: Before/after section gets slider-style labels ("BEFORE" / "AFTER" overlaid on images)
- **Add**: Emergency banner strip at very top: "PIPE BURST? CALL NOW" with pulsing red dot

### 2. Electrician (`ElectricianMockup.tsx` — currently 196 lines)
- **Signature element**: Animated electrical "arc" CSS effect — a glowing yellow line that traces across the caution stripe dividers
- **Add**: "Common Projects" visual grid with icons: Panel Upgrade, EV Charger, Generator, Recessed Lighting, Smart Home, Outdoor Lighting
- **Add**: "Licensed vs Unlicensed" comparison section (two columns showing risks of hiring unlicensed)
- **Upgrade**: Caution stripe becomes animated (subtle crawl animation)
- **Add**: Permit badge section with animated checkmark

### 3. Landscape (`LandscapeMockup.tsx` — currently 221 lines)
- **Signature element**: Seasonal color gradient that shifts as you scroll (spring green → summer gold → fall amber → winter blue-white)
- **Add**: "Project Gallery" section with before/after grid (patios, retaining walls, lawns)
- **Add**: "Service Area" neighborhood pills
- **Upgrade**: Season tabs become full-width cards with background color transitions
- **Add**: "Free Lawn Assessment" CTA banner between sections

### 4. Lawyer (`LawyerMockup.tsx` — currently 185 lines)
- **Signature element**: Animated gold "scales of justice" CSS illustration in the hero (balanced scales that gently sway)
- **Add**: "Our Approach" 3-step process: Consultation → Strategy → Resolution, with connecting gold lines
- **Add**: "Areas We Serve" section with courthouse-style pillar icons for each jurisdiction
- **Add**: "Attorney Profile" section with credentials, bar admissions, education
- **Upgrade**: Add a second testimonial and refine the gold rule animations with fade-in

### 5. Clinic/MedSpa (`ClinicMockup.tsx` — currently 203 lines)
- **Signature element**: Subtle particle/bokeh CSS animation in the hero background — floating light orbs suggesting luxury/serenity
- **Add**: "Pricing Transparency" section with treatment cards showing price ranges
- **Add**: "The Experience" 3-step visual: Book → Arrive → Glow, with elegant connecting dots
- **Upgrade**: Team section gets hover cards with credential reveals
- **Add**: "Before & After Gallery" placeholder section with privacy-respecting placeholders

### 6. Roofing (`RoofingMockup.tsx` — currently 192 lines)
- **Signature element**: Animated "shingle pattern" CSS background in hero — repeating diagonal lines suggesting roof tiles
- **Add**: "Insurance Claim Process" 5-step timeline (Storm → Inspection → Claim Filed → Approved → Installed)
- **Add**: "Materials We Use" partner/brand strip (GAF, Owens Corning, CertainTeed)
- **Add**: "Roof Types" visual grid: Asphalt Shingles, Metal, Flat/Commercial, Cedar Shake
- **Upgrade**: "$0 Out of Pocket" gets its own highlighted callout section with shield icon

### 7. Youngblood (`YoungbloodMockup.tsx` — currently 399 lines)
- **Minor tweaks only**: Add a "Resources" section stub (3D CAD library, product catalog, training), add SEO `<Helmet>` meta tags (missing vs all other demos have them), and add a subtle animated grid-dot pattern to the Industries section

---

## Files Changed

| File | Action |
|------|--------|
| `src/pages/PlumberMockup.tsx` | Major expansion: ~211 → ~380 lines |
| `src/pages/ElectricianMockup.tsx` | Major expansion: ~196 → ~370 lines |
| `src/pages/LandscapeMockup.tsx` | Major expansion: ~221 → ~400 lines |
| `src/pages/LawyerMockup.tsx` | Major expansion: ~185 → ~360 lines |
| `src/pages/ClinicMockup.tsx` | Major expansion: ~203 → ~380 lines |
| `src/pages/RoofingMockup.tsx` | Major expansion: ~192 → ~370 lines |
| `src/pages/YoungbloodMockup.tsx` | Minor polish: add Helmet SEO, Resources stub |

No database changes. No new dependencies. All animations are pure CSS keyframes injected via inline `<style>` blocks (same pattern as Youngblood).

