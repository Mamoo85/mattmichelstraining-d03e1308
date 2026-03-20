

## Workout UI Revamp — Modern Fitness App Redesign

### What's Changing

The current workout zone UI uses flat, boxy cards with hard borders and a utilitarian feel. We're redesigning it to match the sleek, modern aesthetic of apps like Strong, Hevy, and JEFIT — with rounded containers, smooth surfaces, subtle gradients, and better visual hierarchy.

### Scope

**4 components getting redesigned:**

1. **ExerciseCard.tsx** — The core set-logging card
2. **ActiveWorkoutZone.tsx** — The full-screen workout container, header, and command bar
3. **RecoveryInput.tsx** — The "How do you feel?" section
4. **ProtocolTable.tsx** — The coach-assigned protocol view

### Design Direction

```text
Current                          →  New
─────────────────────────────────────────────────
Hard square borders              →  Rounded-xl containers with subtle shadows
Flat bg-card backgrounds         →  Gradient surfaces, glass-morphism footer
Tiny 10px uppercase labels       →  Clean hierarchy with weight on titles
Boxy grid inputs                 →  Pill-shaped inputs with larger tap targets
Flat checkmark buttons           →  Animated green fill on completion
Sharp border-l for coach flag    →  Subtle glow + colored pill badge
Cramped spacing                  →  Generous padding, breathing room
Static rest timer bar            →  Circular countdown overlay
Plain command bar                →  Frosted glass bar with rounded buttons
```

### Technical Details

**ExerciseCard.tsx:**
- Rounded-xl container with `shadow-lg` and subtle `bg-gradient-to-b`
- Exercise number as a colored circle badge instead of plain mono text
- Set rows: larger `h-12` inputs with `rounded-lg`, alternating subtle row backgrounds
- Ghost data shown as placeholder text inside inputs (not a separate column) to save width
- Completed sets get a green background wash + scale animation
- Coach notes panel uses a card-within-card with rounded corners and primary accent bar
- "Flag for Coach" becomes a sleek pill toggle at the bottom
- Add/remove set buttons become rounded pills with icons

**ActiveWorkoutZone.tsx:**
- Header: clean gradient from background to transparent, title centered, action icons as rounded icon buttons
- Rest timer: circular progress ring overlay instead of a flat bar
- Command bar footer: frosted glass (`backdrop-blur-xl`), rounded-2xl button group, workout timer as a prominent pill
- Empty state: larger icon, gradient text, more inviting CTA button with glow
- QuickLogBar: rounded-full input with integrated mic/send buttons

**RecoveryInput.tsx:**
- Rounded-xl container
- Scale selector buttons become rounded pills with emoji indicators instead of numbers
- Sleep input as a styled slider or rounded input
- Collapsed summary as colored pills

**ProtocolTable.tsx:**
- Replace rigid grid with stacked rounded cards per exercise
- Each exercise is a mini-card with the name prominent, sets/reps as a badge, notes below
- Weight input gets a rounded, centered design with "lbs" suffix label
- Log Session button: full-width rounded-xl with gradient and glow effect

### Files Modified
- `src/components/workout/ExerciseCard.tsx`
- `src/components/workout/ActiveWorkoutZone.tsx`
- `src/components/workout/RecoveryInput.tsx`
- `src/components/workout/QuickLogBar.tsx`
- `src/components/ProtocolTable.tsx`
- `src/components/workout/WorkoutTimer.tsx`

