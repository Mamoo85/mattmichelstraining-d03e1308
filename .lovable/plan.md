

## Mega Feature: Enhanced Active Workout Zone + Post-Workout Summary + Social Sharing

This is a large, multi-part feature. Here is the full plan broken into phases.

---

### Phase 1: Attach "Start Workout" to Individual Workouts & Programs

**What changes:**
- Remove the global "Start Workout" button from `Dashboard.tsx` header
- Add a "Start Workout" button on each program card in `MyPrograms.tsx` (both interactive and custom programs)
- Add a "Start This Workout" button on each community workout card in `CommunityWorkoutBank.tsx`
- Pass the workout/program context (exercises, title, program ID) via `CustomEvent` detail into the Zone
- Update `ActiveWorkoutZone.tsx` to accept and auto-populate exercises from the passed context

**Files:** `Dashboard.tsx`, `MyPrograms.tsx`, `CommunityWorkoutBank.tsx`, `ActiveWorkoutZone.tsx`, `App.tsx`

---

### Phase 2: Full Feature Parity Inside The Zone

**What changes:**
- Bring all existing features into the Zone: ExerciseCard (video, "The Why", sets/reps/weight, notes, form-check video link, flag for coach), RecoveryInput, ExercisePicker, WorkoutScanner (OCR)
- Add voice-to-text notes using the browser's native `SpeechRecognition` API (whisper notes) — a mic button on notes fields that transcribes speech to text
- Include AskCoachMatt (AI chat) as a collapsible panel inside the Zone for Pro+ tiers
- All AI features (AiExerciseSubstitution, AiRecoveryAdvisor) accessible via buttons in the Zone

**Files:** `ActiveWorkoutZone.tsx` (major expansion), new `VoiceNoteButton.tsx` component, `ExerciseCard.tsx` (add mic button)

---

### Phase 3: Pause/Resume Workout

**What changes:**
- Add a "Pause" button to the Zone bottom bar that minimizes the Zone overlay and returns to the Dashboard
- Show a persistent "Resume Workout" banner at the top of Dashboard when a workout is paused
- Store in-progress workout state in `localStorage` so it survives navigation
- The Zone re-opens with all state intact when resumed

**Files:** `ActiveWorkoutZone.tsx`, `App.tsx`, `Dashboard.tsx`

---

### Phase 4: Finish Confirmation + Post-Workout Summary Page

**What changes:**
- "Finish & Exit" triggers a `ConfirmActionModal` ("Are you sure you want to finish this workout?")
- On confirm, save the workout to DB, then transition to a new `PostWorkoutSummary` component (still full-screen)
- Summary page shows:
  - Total volume, sets, reps, duration, PR detection
  - AI-generated analysis (via Lovable AI / Gemini) — performance insights, recovery suggestions
  - Editable session notes field
  - Flag for Matt toggle (per exercise or overall)
  - Recovery input if not already filled
  - Post-workout image upload (camera/gallery)
  - Social sharing buttons (Facebook, Instagram story link, X.com)
  - "Share to Community" button (+25 points)

**Files:** New `PostWorkoutSummary.tsx`, `ActiveWorkoutZone.tsx`, new edge function `ai-workout-analysis/index.ts`

---

### Phase 5: Database — Workout Sharing & Image Moderation

**New tables via migration:**

```sql
-- Shared workout results visible in community feed
CREATE TABLE public.shared_workout_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_log_id uuid REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  caption text DEFAULT '',
  image_url text,
  image_status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  stats jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_workout_results ENABLE ROW LEVEL SECURITY;
-- RLS: users insert own, everyone reads approved, admins manage all
```

- `image_status` defaults to `pending` — only `approved` images display publicly
- Admin approval UI added to existing admin panel (new tab or section in `AdminVideoReview`)
- AI pre-screens images via Gemini vision (flag inappropriate, auto-approve clean images) in an edge function

---

### Phase 6: Community Workout Feed + Streaks

**What changes:**
- New `SharedWorkoutFeed.tsx` component placed below the Monthly Challenge box on the Dashboard Home tab
- Shows cards with: athlete name, workout stats, optional image (if approved), timestamp, like button
- Clicking a card shows full workout details (exercises, sets, weights)
- Award 25 points for sharing via `award_points` RPC (new action `share_workout` added to `POINT_VALUES`)
- Add workout streak tracking: consecutive days with logged workouts, displayed on the summary page and profile. Use existing `weekly_streak` field or extend with a `current_streak` column on profiles

**Files:** New `SharedWorkoutFeed.tsx`, `DashboardHome.tsx`, `usePoints.tsx` (add `share_workout: 25`), `Profile.tsx`

---

### Phase 7: Social Sharing (External)

**What changes:**
- Share buttons on PostWorkoutSummary that generate shareable links/images:
  - **Facebook**: Open share dialog with workout stats text
  - **X.com**: Pre-filled tweet with stats + link back to the app
  - **Instagram**: Copy stats to clipboard + prompt to share as story (IG has no direct web share API)
- Use `navigator.share()` Web Share API as primary on mobile, fallback to individual platform URLs

**Files:** New `SocialShareButtons.tsx`, `PostWorkoutSummary.tsx`

---

### Summary of All New Files
| File | Purpose |
|------|---------|
| `src/components/workout/PostWorkoutSummary.tsx` | AI analysis + sharing after finishing |
| `src/components/workout/VoiceNoteButton.tsx` | Browser SpeechRecognition mic button |
| `src/components/workout/SharedWorkoutFeed.tsx` | Community feed of shared results |
| `src/components/workout/SocialShareButtons.tsx` | FB/X/IG share buttons |
| `supabase/functions/ai-workout-analysis/index.ts` | AI post-workout insights |
| `supabase/functions/moderate-image/index.ts` | AI image moderation |

### Key Files Modified
- `ActiveWorkoutZone.tsx` — major rewrite with context, pause, all features
- `App.tsx` — context passing, pause state
- `Dashboard.tsx` — remove global button, add resume banner
- `MyPrograms.tsx` — per-program Start Workout buttons
- `CommunityWorkoutBank.tsx` — per-workout Start button
- `ExerciseCard.tsx` — add voice note mic
- `DashboardHome.tsx` — add SharedWorkoutFeed
- `usePoints.tsx` — add `share_workout` action
- DB migration for `shared_workout_results` table

