

# Mockup Pages Upgrade Plan

## Honest Assessment

As a senior design lead, these pages would not impress. They're functional but clearly templated — identical section order (Hero, 3-card grid, trust quote, form), emoji icons, no social proof, no sticky navigation, and no visual differentiation between a $50/hr plumber and a $500/visit MedSpa. A prospect would bounce.

## What Changes

Every page gets upgrades tailored to its audience, but all share these structural improvements:

### Universal Upgrades (All 5 Pages)
- **Sticky top bar**: Slim fixed header with brand name left, phone/CTA right — always accessible
- **Replace all emoji icons with proper SVG icons** from lucide-react (Wrench, Flame, Zap, Shield, etc.)
- **Social proof section**: Star ratings, review count, trust badges (Licensed, Insured, BBB, etc.)
- **Stat counters row**: "500+ Jobs Completed", "4.9 Google Rating", "24/7 Available" — hard numbers build trust
- **Scroll-based reveal animations**: Sections fade/slide in using CSS `@keyframes` + intersection observer pattern (lightweight, no library)
- **Better section rhythm**: Break the identical Hero → Cards → Quote → Form monotony with unique section ordering per page

### Blue Collar Pages (Plumber, Electrician, Landscaper)

**Plumber** — Emergency-first, urgency-driven:
- Animated red pulse glow on the entire hero CTA area, not just the button
- "Average Response Time: 38 Minutes" live-style counter badge
- Trust badges row: Licensed, Insured, 5-Star Google, BBB Accredited (shield icons)
- Service cards get a top colored accent bar instead of emoji
- Before/After visual section placeholder (split-view cards)

**Electrician** — Safety-authority positioning:
- Yellow caution-stripe accent pattern on section dividers (CSS repeating-linear-gradient)
- "Permit Pulled on Every Job" badge prominently displayed
- Service cards with icon left + text right (horizontal layout, feels more professional than stacked)
- Credentials row: Master Electrician badge, years in business, jobs completed

**Landscaper** — Clean, outdoor, seasonal:
- Full-bleed hero with a green-to-transparent gradient (more vibrant)
- Seasonal service tabs (Spring/Summer/Fall/Winter) instead of flat grid
- Photo gallery placeholder section with CSS grid masonry hint
- "Serving 12 Communities" map-style trust element

### High-End Pages (Lawyer, Clinic)

**Lawyer** — Gravitas and authority:
- Ultra-refined serif typography with generous letter-spacing
- Horizontal gold rule dividers between all sections
- Practice area cards: large Roman numeral or single-letter monogram instead of emoji
- "Exposed" credentials: "20+ Years | 1,000+ Cases | Macomb & Wayne County Bar"
- Testimonial block with anonymized client initials in gold circles
- Form gets a "Confidential — Attorney-Client Privilege Applies" notice with lock icon

**Clinic/MedSpa** — Luxury editorial feel:
- Add a thin top announcement bar: "Now Accepting New Patients — Limited Availability"
- Service cards become full-width horizontal cards with large placeholder image left, text right
- "Meet the Team" section with circular avatar placeholders and credentials
- Testimonial carousel with elegant quotation marks
- Footer gets a refined two-column layout: portal CTA left, contact info right
- Subtle background texture (CSS noise pattern) for depth

## Technical Approach

- All changes are CSS/JSX only — no new dependencies
- Icons from `lucide-react` (already installed)
- Scroll animations via a small `useInView` hook using `IntersectionObserver`
- Each page remains fully standalone with inline styles + Tailwind utilities
- Create a shared `useInView` hook in `src/hooks/useInView.tsx` to avoid duplication across all 5 pages
- Each page file is rewritten with the upgraded design

## Files Modified
1. `src/hooks/useInView.tsx` — new shared scroll-reveal hook
2. `src/pages/PlumberMockup.tsx` — full redesign
3. `src/pages/ElectricianMockup.tsx` — full redesign
4. `src/pages/LandscapeMockup.tsx` — full redesign
5. `src/pages/LawyerMockup.tsx` — full redesign
6. `src/pages/ClinicMockup.tsx` — full redesign

