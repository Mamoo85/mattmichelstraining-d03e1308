

# ZoneDashboard Gen-Z Refactor: Instagram-Native UI

## What Changes

The entire `ZoneDashboard.tsx` main content area gets restructured from a dense, small-font layout into a clean, breathing, Instagram-inspired hierarchy with progressive disclosure.

## New Layout (top to bottom)

```text
┌─ HEADER (logo + name + timer + invite) ──────────┐  ← kept, fonts bumped
├──────────────────────────────────────────────────────┤
│  STATS ROW (3 big numbers: Streak / Sessions / Pts) │  ← text-2xl/3xl, clean
├──────────────────────────────────────────────────────┤
│  HERO CARD (glassmorphism, gradient border)          │
│  "Start Today's Workout: Upper Body Power"           │
│  [  BIG CTA BUTTON  ]                               │
├──────────────────────────────────────────────────────┤
│  AI TOOLBOX CAROUSEL (horizontal scroll, stories)    │
│  ◉ Generator  ◉ Fix It  ◉ Velocity  ◉ Scanner ...   │
│     snap-x, overflow-x-auto, hide-scrollbar          │
├──────────────────────────────────────────────────────┤
│  QUICK LOG CARD (big, breathing)                     │
├──────────────────────────────────────────────────────┤
│  CHECK-IN + PROVE IT (side-by-side buttons)          │
├──────────────────────────────────────────────────────┤
│  SECONDARY ACTIONS (vertical list, p-5/p-6 cards)    │
│   • Main Lifts Log                                   │
│   • My Programs                                      │
│   • Custom Program Request                           │
│   • Recovery & Mobility                              │
│   • Message Coach Matt                               │
├──────────────────────────────────────────────────────┤
│  TAB STRIP (Home / Lifts / Generate / Train)         │
│  TAB CONTENT (unchanged logic)                       │
└──────────────────────────────────────────────────────┘
```

## Specific Changes in `ZoneDashboard.tsx`

### 1. Typography Purge
- Remove every `text-[8px]`, `text-[9px]`, `text-[10px]` — minimum is `text-xs`
- Stat numbers become `text-3xl font-black`
- Body/description text becomes `text-sm`
- Labels become `text-xs font-bold uppercase`

### 2. Hero Card (replaces 2x2 grid + stats banner)
- Full-width glassmorphism card with gradient border (`p-[1px]` wrapper)
- Inner dark card with program name, workout title, duration
- Large orange CTA button "Start Training →"
- Replaces the old stats banner's training info

### 3. Stats Row (replaces old dense stats banner)
- Simple 3-column grid above hero card
- Each stat: big number (`text-3xl`), label below (`text-xs`), minimal decoration
- Streak (fire icon), Sessions this week, Points/Level
- Profile avatar moved to header area or removed from stats

### 4. AI Toolbox → Horizontal Carousel
- Remove the collapsible accordion `AiToolbox` component
- Replace with a horizontal scroll row of circular/rounded icon buttons
- Each tool: 56x56 rounded-2xl icon container + label below
- `overflow-x-auto scrollbar-hide snap-x snap-mandatory` with `scroll-padding`
- Tools: Generator, Fix It, Velocity, Scanner, Recovery, Timer, Bar Path

### 5. Secondary Actions → Vertical Card List
- Remove 2x2 grid entirely
- Vertical stack of full-width cards with `p-5`, `rounded-2xl`
- Each card: icon left, title + subtitle, chevron right
- Items: Main Lifts Log, My Programs, Custom Request, Recovery & Mobility, Coach Chat

### 6. Spacing & Breathing
- Main container `space-y-6` (up from `space-y-4`)
- Cards use `p-5` or `p-6` minimum
- `gap-4` between elements inside cards

### 7. Internal Components Updated
- `GenerateTabContent`: bump all `text-[11px]` → `text-sm`, `text-[9px]`/`text-[10px]` → `text-xs`
- `AiToolbox` accordion: replaced by carousel (inline in main render)
- `OverloadCard`: bump font sizes similarly
- `TrainTabContent`, `HomeTab`: same font size fixes

### 8. Tab strip font fix
- Tab labels: `text-xs` (up from `text-[10px]`)

## Files Modified

| File | Action |
|------|--------|
| `src/pages/ZoneDashboard.tsx` | Major rewrite of layout structure and all font sizes |

