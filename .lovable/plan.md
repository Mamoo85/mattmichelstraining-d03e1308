

# Fix: Workout Library Separation and Source Tracking

## Root Cause Analysis

**Why Patrick saw "Plantar Fasciitis Protocol"**: It was generated on your admin account (user `ce9217be...`) with `is_public = true`. The community bank shows ALL public workouts to ALL users. So Patrick (and every other user) sees it in their workout feed. It was never "placed in his inventory" — it just appeared because the feed merges everything public.

**Why workouts don't appear after creation**: The AI generator calls `onDone()` after save, which switches back to the bank view. The bank then re-fetches and shows the workout — but it's mixed in with everything else, easy to miss. If the user didn't hit Save, the workout was lost entirely.

**Why the share toggle is dangerous**: `is_public` defaults to `true` in the DB schema itself (`column_default: true`), so even when the UI defaults the toggle to off, the DB default can override if the value isn't explicitly sent.

---

## Plan

### 1. Migration: Add `source_type` column + fix defaults + backfill

Add `source_type TEXT NOT NULL DEFAULT 'manual'` with allowed values: `coach_seeded`, `manual`, `ai_workout`, `ai_fixit`.

Change `is_public` column default from `true` to `false`.

Backfill existing data:
- `creator_name = 'Coach Matt'` → `coach_seeded`
- `creator_name = 'Coach Matt AI'` + title contains rehab keywords → `ai_fixit`
- `creator_name = 'Coach Matt AI'` (rest) → `ai_workout`
- Everything else → `manual`

Also set `is_public = false` on all AI-generated rows (stops the bleeding — no AI content should auto-share).

Update RLS select policy for public workouts to also require `source_type = 'manual'` (only user-created manual workouts can be community-shared, not Fix It or AI programs).

### 2. AiWorkoutSuggest — tag source_type on save

When saving, pass `source_type`:
- If `path === "fixit"` → `source_type: "ai_fixit"`, force `is_public: false` (no share toggle shown)
- If `path === "workout"` → `source_type: "ai_workout"`, `is_public: false` default, no share toggle (AI workouts are personal)

Remove the share toggle from AI-generated results entirely. AI content is always private to the user.

### 3. WorkoutBuilder — tag source_type on save

Set `source_type: "manual"`. Keep the share toggle (only manual workouts are community-shareable). Ensure `is_public` is explicitly passed as `false` when toggle is off.

### 4. WorkoutsTab — split into 4 sub-tabs

Replace single bank view with tabbed layout:

| Tab | Query | Content |
|-----|-------|---------|
| **My Workouts** | `user_id in familyIds, source_type in (manual, coach_seeded)` | Welcome gifts + manually created workouts |
| **Generated** | `user_id in familyIds, source_type = ai_workout` | AI-generated workouts |
| **Fix It** | `user_id in familyIds, source_type = ai_fixit` | AI-generated rehab/corrective programs |
| **Community** | `is_public = true, source_type = manual` | Shared workouts from other users |

Smart Build and Manual Build buttons stay above the tabs. Default tab: **My Workouts**.

### 5. CommunityWorkoutBank — accept `mode` prop

Refactor to accept a `mode` prop that controls which query runs:
- `"my"` — own manual + coach_seeded workouts
- `"generated"` — own AI workouts
- `"fixit"` — own AI Fix It programs
- `"community"` — public manual workouts from others

The "Save Copy" button only appears in community mode. The share toggle only appears on own manual workouts. Fix It items never show a share option.

### 6. Edge function cleanup

Update `ai-workout-suggest/index.ts` — when saving the workout to the DB after generation, explicitly set `is_public: false`. The notification to admin stays.

---

## Files Modified

1. **Migration SQL** — add `source_type`, change `is_public` default, backfill, update RLS
2. `src/components/workout/AiWorkoutSuggest.tsx` — pass `source_type`, remove share toggle
3. `src/components/workout/WorkoutBuilder.tsx` — pass `source_type: 'manual'`
4. `src/components/dashboard/WorkoutsTab.tsx` — 4 sub-tabs
5. `src/components/workout/CommunityWorkoutBank.tsx` — mode-based queries
6. `supabase/functions/ai-workout-suggest/index.ts` — ensure `is_public: false`

