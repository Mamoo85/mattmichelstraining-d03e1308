
# Plan: Print PDF, Timed Circuits, and DualFab Restoration

## Status: ✅ Implemented

### 1. Print PDF from AI-Generated Workout — ✅ Done
- Added Print PDF button alongside Regenerate in results view
- Uses existing `printCommunityWorkout` utility

### 2. Timed Circuit Support — ✅ Done
- **Edge functions** (`ai-workout-suggest`, `free-workout-generator`): Updated tool schemas with `isTimedCircuit` and `timerConfig` fields; AI detects circuit requests from natural language
- **AiWorkoutSuggest**: Shows circuit badge with editable work/rest/rounds/prep controls; passes config to workout zone
- **ActiveWorkoutZone**: Auto-launches IntervalTimer in circuit mode when `isTimedCircuit` is true
- **IntervalTimer**: New circuit mode showing current exercise name inside the ring, "Next:" during rest, +/- round controls when paused
- **Share default changed to OFF** (privacy-first)

### 3. DualFab on Workout Pages — ✅ Done
- Added `DualFabWrapper` in App.tsx using `useLocation`
- Only renders on: `/dashboard`, `/progress`, `/coach`, `/nutrition`, `/profile`, `/schedule`
- Not shown on public, demo, or web design pages
