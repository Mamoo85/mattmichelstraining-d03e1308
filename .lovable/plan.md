

# Fix Plan: BlurGate Stall, Duration Buttons, PR Celebration

## Problem 1: BlurGate Blocking Dashboard for Logged-In Subscribers
The `BlurGate` component wraps `/dashboard` and `/zone-dashboard`. For logged-in, subscribed users it should pass through — but the `useAuth` hook's `loading` state or `subscribed` check may briefly show the blur overlay, causing a flash/stall. The fix: skip the blur entirely for authenticated+subscribed users and add a loading state that shows nothing instead of the blur while auth is resolving.

**Files**: `src/components/layout/BlurGate.tsx`
- While `loading` is true, render `children` with no overlay (not the blur)
- Only show blur after loading resolves and user is missing auth/sub

## Problem 2: Duration Buttons Not Appearing After Intensity Selection
The `sendMessage` callback (line 170) has `[messages, streaming]` as dependencies — it captures a stale `intensityAnswered` value. When the AI response finishes and we check `intensityAnswered` at line 154, it may still be `false` in the closure.

**Files**: `src/components/dashboard/QuickActivityLog.tsx`
- Add `intensityAnswered` to the `sendMessage` dependency array
- Also: the AI prompt (edge function) says "How long did that take?" which asks for free text. But the UI shows bubble buttons. The AI's question and the button prompt need alignment. Update the system prompt to say "Got it. How long?" so the UI buttons appear alongside.

**Files**: `supabase/functions/log-activity-chat/index.ts`
- Update prompt line 6 to tell AI: after intensity, just say "Got it." (short) — the UI will show duration buttons automatically. Don't ask an open-ended question about time.

## Problem 3: PR Celebration System for Quick Activity Log
Currently, PR detection only exists in `QuickLogBar` (inside ActiveWorkoutZone). The `QuickActivityLog` (the main "Log Activity" button) has zero PR detection. When someone says "bench 225" and that's higher than their record, nothing happens.

**Implementation**:

1. **Create `src/components/gamification/PRCelebration.tsx`** — A full-screen confetti + trophy celebration modal
   - Shows exercise name, new weight, improvement over previous best
   - "Share Your PR" button that uses `PRShareCard` + `html2canvas` to generate a shareable image
   - Awards M² Points (+50 for a PR)
   - Auto-dismisses after 8 seconds or on tap

2. **Add PR detection to `QuickActivityLog.tsx`** — After `handleSave` completes:
   - Check `summary.workout_sheet` for exercises that match `ALL_LIFTS`
   - Query `progress_logs` for user's previous best on each matched lift
   - If any weight exceeds previous best → insert new PR into `progress_logs` + show `PRCelebration`
   - Award points via `usePoints` hook

3. **Also trigger from `QuickLogBar`** — After `handlePRConfirm` succeeds, show `PRCelebration` instead of just a toast

**New file**: `src/components/gamification/PRCelebration.tsx`
- Confetti animation (CSS keyframes, no library needed)
- Trophy icon + "NEW PR!" header
- Exercise name + weight + improvement
- Share button + dismiss
- Points award display (+50 pts)

**Modified files**:
- `src/components/dashboard/QuickActivityLog.tsx` — Add PR check after save
- `src/components/workout/QuickLogBar.tsx` — Show PRCelebration after confirm
- `src/components/workout/QuickLogPRConfirm.tsx` — No changes needed (this is the "is this correct?" step; celebration comes after)

## Execution Order
1. Fix BlurGate (quick, unblocks dashboard)
2. Fix duration buttons (dependency array + prompt tweak)
3. Build PRCelebration component
4. Wire PR detection into QuickActivityLog and QuickLogBar

