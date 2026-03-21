

# "DO NOT PRESS" Easter Egg — Revised Plan

## Key Change from Previous Plan
Make the button **eye-catching and impossible to miss** — not buried or tiny. It should feel like reverse psychology marketing: obviously tempting, not actually hidden.

## New Files

### 1. `src/components/landing/DoNotPressButton.tsx`
A full-width section (not a tiny footer link) with:
- Black background strip with animated red/orange pulsing border
- Large text: **"⚠️ DO NOT PRESS THIS BUTTON ⚠️"**
- Animated glow effect, slight shake on hover
- Centered, padded, styled like a dare — users will absolutely press it
- Links to `/matrix`

### 2. `src/pages/MatrixEasterEgg.tsx`
Full-screen black page:
- **Phase 1**: Green cursor blinks 3 times
- **Phase 2**: Typewriter types "Congratulations, you have passed the test."
- **Phase 3** (2s after typing ends): CTA content fades in as a scrollable section

CTA content (Matrix black aesthetic, green + orange accents):
- **Matt's note**: "You weren't supposed to press that. But since you're clearly the rebellious type... respect. Here's what $12.99/mo actually gets you."
- **Tech showcase cards**: Exercise Library (200+), AI Nutrition Scanner, Posture Analysis, Fix It Recovery Library, Smart Workout Logger, Monthly Focus — each with icon and one-liner
- **Pain hook**: "Everybody's got something that hurts. A shoulder that clicks. A knee that's been lying to you for years. I've spent 20+ years fixing people — zero injuries, 50+ college athletes sent to the next level. This membership is your all-access pass to my playbook."
- **Primary CTA button**: "Start My 14-Day Free Trial" → `/auth?redirect=/trial-welcome`
- **Divider**: "Or just let me prove it."
- **Secondary CTA**: Big "SCHEDULE NOW" → `/schedule`
- **"← Back to safety"** link at top-right

## Modified Files

### 3. `src/App.tsx`
- Add lazy import + route: `/matrix` → `MatrixEasterEgg`

### 4. Add `<DoNotPressButton />` to these public pages
`Index.tsx`, `About.tsx`, `Pricing.tsx`, `Shop.tsx`, `ForParents.tsx`, `Schedule.tsx`, `Merch.tsx`, `Learn.tsx`, `TheEdge.tsx`, `Install.tsx`

Excluded: Auth, Dashboard, Profile, Progress, Nutrition, Admin, Coach, TrialWelcome, Welcome, NotFound

## Technical Details
- Typewriter: `setInterval` revealing one character at a time, monospace font, `#00FF41` green
- Cursor blink: CSS keyframes with `step-end`
- CTA fade-in: CSS opacity transition triggered by state
- Button glow: `box-shadow` animation with red/orange pulse, `@keyframes`
- Fully responsive single-column layout

