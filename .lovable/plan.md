

## The Intercept Gateway — Workout Selection Inside The Portal

### Overview
Replace the existing `WorkoutPickerModal` bottom-sheet (which fires *before* entering The Portal) with an **Intercept Menu** that renders *inside* The Portal as a new phase. When the user clicks "ENTER THE PORTAL", the zone opens immediately but lands on a full-screen selection screen before the timer starts.

### Flow Change

```text
Current:  Dashboard → WorkoutPickerModal (Sheet) → open-workout-zone event → ActiveWorkoutZone
New:      Dashboard → open-workout-zone (no context) → ActiveWorkoutZone phase="intercept" → user picks → phase="readiness"/"active"
```

### 1. New Phase in ActiveWorkoutZone (`ActiveWorkoutZone.tsx`)

Add `"intercept"` to the phase state: `"intercept" | "readiness" | "active" | "summary"`.

- Default phase becomes `"intercept"` (instead of `"readiness"`) unless `initialContext` has exercises or is resumed.
- Timer does NOT start until the user selects a workout (timer starts when phase transitions to `"active"`).

### 2. The Intercept Menu Component (`src/components/workout/InterceptGateway.tsx`)

A new full-screen component rendered when `phase === "intercept"`. Displays:

**Header**: "What are we executing today?" in bold uppercase Portal style.

**Top Option**: "Freestyle Session" button — starts a blank log (no exercises, transitions to active phase).

**Data Banks** (fetched on mount):

| Bank | Source | Query |
|------|--------|-------|
| Active Program | `user_active_programs` joined with `training_programs` | User's active program with today's workout block |
| Personal Bank | `community_workouts` where `user_id = user.id` | User's own saved routines |
| M2 Master Templates | `community_workouts` where `is_public = true AND user_id != user.id` | Public library workouts from other users / admin |

**The Paywall**: M2 Master Templates section checks `useTierAccess("master_templates")` or `useMinTier("foundation")`. If user lacks access, template cards render with a lock icon overlay and `opacity-50`. Clicking triggers a toast with "Upgrade to unlock" and navigates to `/pricing`.

### 3. The Handoff

When the user clicks any workout card, the `InterceptGateway` calls `onSelect(context: WorkoutZoneContext)` which:
- Sets `exercises` state with the mapped exercise data
- Sets `workoutTitle` 
- Transitions phase from `"intercept"` → `"readiness"` (if auto-regulate enabled) or `"active"`

### 4. Dashboard Simplification (`DashboardHome.tsx`)

The "ENTER THE PORTAL" button now fires `open-workout-zone` with **no context** (empty detail). The `WorkoutPickerModal` is no longer opened — selection happens inside The Portal.

### Files

| File | Change |
|------|--------|
| `src/components/workout/InterceptGateway.tsx` | **New** — full-screen selection UI with 3 data banks + freestyle + paywall |
| `src/components/workout/ActiveWorkoutZone.tsx` | Add `"intercept"` phase, render `InterceptGateway` when in that phase, delay timer start |
| `src/components/dashboard/DashboardHome.tsx` | Simplify button to fire `open-workout-zone` directly (remove WorkoutPickerModal usage) |

### Technical Notes
- Reuses the same data-fetching logic from `WorkoutPickerModal` but moves it into `InterceptGateway`
- The `WorkoutPickerModal` file remains for backward compatibility but is no longer the primary entry point
- Timer (`timerRunning`) initialized as `false`, set to `true` only when phase transitions to `"active"`
- Paywall uses existing `useMinTier("foundation")` hook — no new tier features table entries needed

