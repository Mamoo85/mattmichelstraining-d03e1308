

## The Portal — Active Workout Architecture

### Overview
Two changes: update the homepage hero buttons, and create Portal isolation (hide nav, restructure bottom bar) when the Active Workout Zone is open.

### 1. Homepage Hero Buttons (`HeroSection.tsx`)
- **"Start Training"** button → route changes from `/shop` to `/schedule`, label stays or becomes "START TRAINING"
- **"Schedule"** button → rename to **"ENTER THE PORTAL"**, route to `/dashboard`, add glowing orange border hover effect (`border-orange-500 hover:shadow-[0_0_15px_rgba(249,115,22,0.5)] hover:border-orange-400`)
- Keep "Meet Matt" button as-is

### 2. Portal State Management (`useTimer.tsx`)
- Add `portalActive` boolean + `setPortalActive` setter to the existing `TimerContext`
- No new providers needed

### 3. Nav & Timer Hiding
- **`AppNavbar.tsx`**: consume `useTimer()`, return `null` when `portalActive === true`
- **`App.tsx` → `GlobalTimer`**: return `null` when `portalActive === true`
- **`App.tsx` → `ActiveWorkoutWrapper`**: call `setPortalActive(true)` when `zoneOpen` becomes true, `setPortalActive(false)` on finish/pause

### 4. Dashboard Button (`DashboardHome.tsx`)
- Rename "Start Workout" button to **"ENTER THE PORTAL"** with Portal-style glow styling

### 5. ActiveWorkoutZone Bottom Bar (`ActiveWorkoutZone.tsx`)
- Update main content area: ensure `pb-[120px]` for safe scrolling
- Restyle `<footer>` to: `fixed bottom-0 w-full z-50 bg-background/95 backdrop-blur-md border-t border-border`
- Restructure into 3 sections:
  - **Left**: Timer readout (existing tap-to-pause timer chip)
  - **Center**: "Add Exercise" button (always visible, primary style)
  - **Right**: "EXIT" button that triggers finish/save flow, replaces current "Finish" button label
- Remove standalone Pause button from the bar (pause is handled by tapping the timer)

### Files Modified

| File | Change |
|------|--------|
| `src/hooks/useTimer.tsx` | Add `portalActive` / `setPortalActive` |
| `src/App.tsx` | Sync `portalActive` with `zoneOpen`; guard `GlobalTimer` |
| `src/components/AppNavbar.tsx` | Hide when `portalActive` |
| `src/components/HeroSection.tsx` | Reroute buttons, rename Schedule → ENTER THE PORTAL |
| `src/components/dashboard/DashboardHome.tsx` | Rename Start Workout → ENTER THE PORTAL |
| `src/components/workout/ActiveWorkoutZone.tsx` | Restructure footer, add `pb-[120px]`, restyle fixed bar |

