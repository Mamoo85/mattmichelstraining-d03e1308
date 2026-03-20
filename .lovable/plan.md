

## Print & Workout Zone Improvements

### Problem
1. **Printed workouts** don't enforce page boundaries — community workouts and program logs can overflow pages
2. **Program print** dumps all weeks/days continuously instead of one day per page
3. **Workout Zone** loads ALL exercises from every week/day of a program at once (100+ exercises), instead of letting the user pick a specific day

---

### Changes

#### 1. Print — Community Workouts Fit One Page (`printCommunityWorkout.ts`)
- Reduce log rows per exercise from `max(sets, 1)` extra rows to just 2 blank rows
- Shrink font sizes and padding slightly
- Add CSS: `html { height: 100%; }` and `body { max-height: 100vh; }` with `overflow: hidden` in `@media print` to hard-clip at one page
- Reduce header/footer spacing

#### 2. Print — Program Log: One Day Per Page (`printWorkoutLog.ts`)
- Change `page-break-inside: avoid` on `.day-block` to `page-break-before: always` (except first day)
- Add compact header (program title + week/day label) at top of each page
- Reduce log rows from 5 per exercise to 3
- Each day gets its own page with the M² header repeated via CSS `@page` or inline header per day block

#### 3. Workout Zone — Week/Day Picker for Programs (`InterceptGateway.tsx`)
- When user taps an active program (interactive), instead of loading all exercises immediately, show a **week/day selector step**
- Fetch distinct `week_number` and `day_number` values from `program_workouts` for that program
- Show week buttons → then day buttons → then load only that day's exercises into the workout zone
- This replaces the current `handleActiveProgram` which dumps everything in at once

### Files Modified

| File | Change |
|------|--------|
| `src/components/workout/printCommunityWorkout.ts` | Compact layout, enforce single-page print |
| `src/components/programs/printWorkoutLog.ts` | One day per page, reduce log rows to 3, repeat header per day |
| `src/components/workout/InterceptGateway.tsx` | Add week/day picker step before loading program exercises |

