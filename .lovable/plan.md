

# Plan: Rich Info Hubs + Restructured Grid + Collapsible Widgets + Logo Fix

All changes in **one file**: `src/pages/ZoneDashboard.tsx`

---

## 1. Fix Logo

Replace `m2-logo-official.png` import with `m2-logo-official.jpg` (same as rest of app uses `m2-logo.jpg`). Remove the forced `rounded-lg` and white-assuming background. Render with `object-cover` and no color manipulation.

## 2. Replace 3 Stat Cards → 3 Rich Info Hubs

Three full-width stacked horizontal cards (not square boxes), each with a colored left accent bar:

**Hub 1 — My Stats** (Orange `#f97316`)
- Shows: 🔥 Streak count, Points total + level badge (from `usePoints()`), Sessions this week
- Links: Profile pill, Refer a Friend pill

**Hub 2 — AI Insights** (Purple `#a855f7`)
- Shows: Current program name, recovery status icon
- Links: AI Recovery, Lift Insights, Body Avatar pills

**Hub 3 — Quick Launch** (Cyan `#00f0ff`)
- Shows: Coach Matt status (green pulse + "Available"), Submit PR
- Links: Interval Timer pill, Message Matt pill, Submit PR pill

Each hub is a compact ~65px tall glassmorphic rectangle with left colored border, icon + stats on left, pill buttons on right. Dense but clean.

## 3. Rename & Rewire 2x2 Action Grid

| Position | New Label | Icon | Accent | Action |
|----------|-----------|------|--------|--------|
| Top-left | **Compound Lifts** | BarChart3 | Orange | Switch to Lifts tab |
| Top-right | **Perfect Workout Generator** | Brain | Purple | Switch to Generate tab (workout mode) |
| Bottom-left | **Fix It Engine** | Wrench | Cyan | Switch to Generate tab (fixit mode) |
| Bottom-right | **Workouts & Programs** | Dumbbell | Orange | Switch to Train tab |

"Submit PR" moves to Hub 3 as a small pill button. "Workout Portal" dispatch removed from grid.

## 4. Collapsible Focus & Challenge Widgets

Between the action grid and tab pills, add two full-width `rounded-2xl` collapsible cards:

- **Monthly Focus** — Shows title bar when collapsed, expands `MonthlyFocusWidget` on tap
- **Challenge** — Shows title bar when collapsed, expands `DashboardChallengePreview` on tap

Both auto-collapse when any action grid button is tapped. Use `AnimatePresence` for smooth height transitions. Stay open until user taps to minimize.

## 5. Tab Hero Info Cards

- **Lifts tab**: Keep existing gradient-border "Log a Lift" hero card
- **Generate tab**: Show mode-specific hero card — "Perfect Workout Generator" (purple gradient) or "Fix It Engine" (cyan gradient) with subtitle about auto-timer
- **Train tab**: Add "Your Library" hero card with Dumbbell icon

## 6. Generate Tab State

Lift `generateView` state (`"menu" | "workout" | "fixit"`) to parent so action grid buttons can set it directly when switching to the Generate tab.

## 7. Imports

Add: `usePoints` hook, `useNavigate` from react-router-dom, `ChevronDown`/`ChevronUp` icons. Change logo import to `.jpg`.

---

## No other files modified

All existing components stay untouched — they inherit the Zone look through CSS variable overrides in the wrapper.

