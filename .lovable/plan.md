
# Fix: Workout Library Separation and Source Tracking

## Status: ✅ Implemented

### 1. Migration: source_type + is_public fix — ✅ Done
- Added `source_type` column (`coach_seeded`, `manual`, `ai_workout`, `ai_fixit`)
- Changed `is_public` default from `true` to `false`
- Backfilled existing data by creator_name + title keywords
- Set all AI-generated rows to `is_public = false`
- Updated RLS: community view restricted to `source_type = 'manual'` only

### 2. WorkoutsTab 4-tab layout — ✅ Done
- My Workouts, Generated, Fix It, Community tabs
- Smart Build, Fix It, and Manual create buttons above tabs
- AI paths route to correct tabs after save

### 3. CommunityWorkoutBank mode-based queries — ✅ Done
- Accepts `mode` prop: my, generated, fixit, community
- Each mode runs its own filtered query
- Save Copy only in community mode
- Delete only on own workouts outside community tab
- Fix It items show "Rehab" badge and "Start Protocol" label

### 4. AiWorkoutSuggest source_type tagging — ✅ Done
- Workout path → `source_type: 'ai_workout'`
- Fix It path → `source_type: 'ai_fixit'`
- Share toggle removed — AI content always private
- Toast messages reflect correct destination tab

### 5. WorkoutBuilder source_type — ✅ Done
- Explicitly sets `source_type: 'manual'` on save
