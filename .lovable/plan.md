

## Smart "Start Workout" Button

### Problem
The "Start Workout" button currently always opens a blank quick workout zone, regardless of whether the user has programs, saved workouts, or is even a paying subscriber.

### New Behavior
When the user taps "Start Workout":

1. **Has active programs or saved community workouts** → Show a bottom sheet / modal listing their programs and saved workouts to pick from, plus a "Create New Workout" option (if paid)
2. **Is paid but has no programs/workouts yet** → Show the picker with just "Create New Workout"  
3. **Is free / no subscription and has nothing** → Navigate to `/pricing` (trial/subscription page)

### Files

| File | Action | Detail |
|---|---|---|
| `src/components/dashboard/DashboardHome.tsx` | **Edit** | Replace the static `Start Workout` button with a smart launcher that checks user state |
| `src/components/dashboard/WorkoutPickerModal.tsx` | **Create** | A dialog/sheet that lists the user's active programs and saved workouts, with a "Start from scratch" option |

### Technical Details

**WorkoutPickerModal.tsx**
- Queries `user_active_programs` (joined with program title) and `community_workouts` (where `user_id = current user`) 
- Each item is a button that dispatches `open-workout-zone` with the correct detail payload (matching existing patterns in `MyPrograms.tsx` and `CommunityWorkoutBank.tsx`)
- "Create New Workout" button dispatches `open-workout-zone` with empty exercises (current behavior)
- Uses existing `Dialog` or `Sheet` UI component

**DashboardHome.tsx changes**
- Accept `subscribed` and `isLegend` props (or use `useAuth` directly — component is already wrapped in auth context)
- On button click:
  - If not subscribed and no programs/workouts → `navigate("/pricing")`
  - Otherwise → open `WorkoutPickerModal`
- The `isNewUser` prop already tells us if they have zero programs and zero logs, which we can reuse

