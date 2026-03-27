

# Plan: Quick Log, Check-In, Prove It, & AI Insights Hub

## What You Asked For (Summary)
1. **Check-In button** back on the Zone Dashboard
2. **"What I Did Today" quick-log** — voice or text AI conversation that logs non-lift workouts (cardio, circuits, etc.) into the user's training history with AI follow-up questions
3. **Prove It box** visible on the dashboard (currently missing from the default Lifts tab view)
4. **"My AI Insights" page** — a dedicated page showing all AI-generated tips, recovery recommendations, mobility suggestions, and lift analysis for the user
5. **Learning pop-up** for the new quick-log feature
6. All above the profile avatar box, Instagram-style

---

## Technical Plan

### 1. New Edge Function: `log-activity-chat` 
**File**: `supabase/functions/log-activity-chat/index.ts`

A conversational AI endpoint that:
- Receives the user's natural language description + conversation history
- Uses Lovable AI (gemini-3-flash-preview) to classify activity type (endurance, cardio, power, strength, mobility, mixed) and extract details
- Asks follow-up questions (intensity, weight level, duration) when info is missing
- When enough info is gathered, returns a structured `{ready: true, summary: {...}}` payload
- The client then saves the final summary to a new `activity_logs` table

### 2. New Database Table: `activity_logs`
**Migration**: Create table to store non-lift workout activities

```sql
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'mixed', -- endurance, cardio, power, strength, mobility, mixed
  intensity TEXT DEFAULT 'moderate', -- easy, moderate, hard, max
  weight_level TEXT, -- none, light, medium, heavy
  duration_minutes INTEGER,
  exercises_mentioned TEXT[],
  ai_summary TEXT,
  ai_recovery_tips TEXT,
  logged_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own activity logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own activity logs" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all activity logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### 3. New Component: `QuickActivityLog`
**File**: `src/components/dashboard/QuickActivityLog.tsx`

Instagram-style bottom sheet / modal with:
- Voice dictation button (Web Speech API, same pattern as existing `VoiceNoteButton`)
- Text input for typing
- Chat-style conversation with the AI (streaming responses)
- Once AI has enough info, shows a summary card with a "Save" button
- Saves to `activity_logs` table
- Rounded edges, dark glassmorphic style matching the dashboard

### 4. New Page: AI Insights Hub
**File**: `src/pages/AiInsights.tsx`

A dedicated page accessible from the dashboard showing:
- **Recovery recommendations** based on recent activity_logs + progress_logs
- **Mobility suggestions** tied to exercises the user has done
- **Lift tips** from the AI training history analysis
- **Rolling/stretching protocols** based on their logged activities
- Uses the existing `ai-athlete-stream` or `ai-training-history` edge functions
- Instagram-style card layout with sections

**Route**: Add `/ai-insights` to `App.tsx`

### 5. Dashboard Updates
**File**: `src/pages/ZoneDashboard.tsx`

Above the Stats Banner (profile avatar box), add three new action cards in order:

1. **"What I Did Today"** — tappable card with mic icon, opens `QuickActivityLog` modal. Gradient card with conversational prompt text like "Tell us about your workout"
2. **Studio Check-In** — compact version of the existing `StudioCheckIn` component (just the check-in button, not the full milestones view)
3. **Prove It — Submit a PR** — card linking to the Prove It zone (already exists as an event dispatch but needs a visible card above the tabs, not just in the Lifts tab)
4. **"AI Insights"** button — small card that navigates to `/ai-insights`

### 6. Learning Pop-Up for Quick Activity Log
**File**: `src/components/dashboard/featureTips.tsx`

Add a `QUICK_ACTIVITY_TIP` with bullets explaining:
- Voice or text — just tell us what you did
- AI asks smart follow-up questions
- Logs cardio, circuits, mobility — anything beyond your main lifts
- Helps Coach Matt understand your full training load

Triggered on first open of the Quick Activity Log modal.

---

## Files Changed/Created

| File | Action |
|------|--------|
| `supabase/functions/log-activity-chat/index.ts` | Create |
| `src/components/dashboard/QuickActivityLog.tsx` | Create |
| `src/pages/AiInsights.tsx` | Create |
| `src/pages/ZoneDashboard.tsx` | Edit — add check-in, quick-log, prove it card, AI insights button above stats |
| `src/components/dashboard/featureTips.tsx` | Edit — add QUICK_ACTIVITY_TIP |
| `src/App.tsx` | Edit — add `/ai-insights` route |
| Database migration | Create `activity_logs` table |

No changes to existing edge functions or auth flows. All new features require authentication.

