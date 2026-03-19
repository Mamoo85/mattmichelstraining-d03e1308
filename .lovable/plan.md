

## Plan: Workout Builder for All Tiers + "Start Workout" Button Additions

### Current State
- **WorkoutBuilder** already exists — users pick exercises from the library, set sets/reps/notes, save, and optionally share to the community bank. It's exactly the "workout maker" you described.
- **However**, it's gated to Foundation+ tiers and Legends only. Basic members cannot access it.
- **After saving**, there is no "Start Workout" button — users have to find it in the community bank afterward.
- **AI Workout Generator** exists only as an **admin tool** (`AdminBatchGenerator`). There is no user-facing AI generator.
- **"Start Workout" buttons** currently exist on: individual programs in MyPrograms, and expanded community workouts in CommunityWorkoutBank.

### What This Plan Does

**1. Open WorkoutBuilder to ALL tiers (including Basic/Free)**
- Remove the tier gate in `WorkoutsTab.tsx` so any authenticated user can create workouts
- Basic members get the manual template builder (pick exercises, set sets/reps, save)

**2. Add "Start Workout" button after creating a workout in WorkoutBuilder**
- After a successful save, show a prominent "Start This Workout" button that dispatches `open-workout-zone` with the just-created exercises
- This means the flow is: Build → Save → Immediately Train

**3. Add "Start Workout" buttons in additional spots**

Before implementing, I'd like to confirm these placement ideas with you:

| Location | Proposed Placement |
|---|---|
| **Exercise Library page** | Small "Start Quick Workout" button in the header — opens the Zone with an empty state so users can add exercises on the fly |
| **DashboardHome "Quick Log" card** | Add a "Start Workout" button next to the existing OCR scanner |
| **Welcome page** | Change "Start Your First Workout" link to actually open the Zone (for returning users who have a protocol assigned) |

**4. Ensure all Zone features apply universally**
- Voice notes, AI features, recovery input, pause/resume, post-workout summary — all already wired into `ActiveWorkoutZone.tsx`. No changes needed; any workout entering the Zone gets the full feature set.

### Files to Edit
| File | Change |
|---|---|
| `src/components/dashboard/WorkoutsTab.tsx` | Remove tier gate on `canCreate` — all users can build |
| `src/components/workout/WorkoutBuilder.tsx` | Add "Start Workout" button after successful save |
| `src/components/dashboard/DashboardHome.tsx` | Add "Start Workout" button in Quick Log card |

### Question for You
Should I add small "Start Workout" entry points to the **Exercise Library page** and/or the **Welcome page** as well? Or keep it limited to the Dashboard and Workouts tab?

