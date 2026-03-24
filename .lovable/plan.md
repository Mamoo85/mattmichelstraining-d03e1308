

## AI Brain Simulator — Implementation Plan

### What We're Building
A self-running animated demo component (`AIBrainSimulator`) that showcases two AI features via a mock chat interface with typing animations, processing states, and generated output — placed prominently on TheEdge.tsx between the hero/CTA and the quick nav.

### Files to Change

#### 1. New: `src/components/landing/AIBrainSimulator.tsx`
A large, self-contained component with two tabs: **The Fix It Engine** and **The Smart Garage Gym**.

**Core mechanics:**
- `useEffect` timer chain drives a 3-phase animation: Input → Processing → Output
- Phase state machine: `idle` → `typing` → `processing` → `output`
- Resets and replays when switching tabs
- All content is hardcoded (no API calls)

**Tab 1 — The Fix It Engine:**
- Mock chat input bar with a typing animation (character-by-character reveal via `setInterval`) displaying: *"My right shoulder hurts when I put on my shirt in the morning."*
- Processing overlay with sequential status lines: "Cross-referencing injury history..." → "Scanning 85+ rehab protocols..." → "Building corrective program..."
- Output: A styled card titled **"Anterior Shoulder Impingement Protocol"** with 3 phases (Tissue Release, Mobility, Isometric Loading) — each with 2-3 exercises
- Action bar with two mock buttons: `[+ Save to My Library]` and `[Print PDF]`

**Tab 2 — The Smart Garage Gym:**
- Mock image upload thumbnail (a placeholder/gradient representing a garage gym with equipment labels: Barbell, Flat Bench, 300lb Plates)
- System context badge: "Advanced (4+ years) · No injuries · Goal: Raw Strength"
- Processing lines: "Analyzing equipment..." → "Scaling wave-loading percentages..." → "Generating 3-day split..."
- Output: A 3-day heavy split (Day 1: Squat/Press, Day 2: Deadlift/Row, Day 3: Bench/Accessories) using only barbell + bench + plates

**Styling:**
- Framer Motion `AnimatePresence` for all phase transitions
- Dark card with `synth-bg` background, glowing cyan/pink accents
- Tab switcher styled as pill toggles with `synth-cyan` active indicator
- Mock chat window chrome (dots in top-left corner, title bar)
- Typing cursor blink animation via CSS

#### 2. Edit: `src/pages/TheEdge.tsx`
- Lazy import `AIBrainSimulator`
- Insert `<Suspense><AIBrainSimulator /></Suspense>` between the Top CTA block and the Quick Nav section (around line 327)
- Add a small heading above it: "See the AI in Action" with Brain icon

### Technical Notes
- No database queries, no auth — purely visual/animated
- The typing effect uses a `useEffect` + `setInterval` incrementing a character index
- Processing phase uses staggered `setTimeout` for each status line
- Component auto-plays on mount; tab switch resets the animation
- Uses existing design tokens (`synth-cyan`, `synth-pink`, `synth-orange`, `synth-bg`)

