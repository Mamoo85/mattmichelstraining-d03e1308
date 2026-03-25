

## Plan: Name Prompt, Anonymous Mode with Random Names, and Admin "View as User"

### Summary
Four interconnected features: (1) prompt users missing a name to enter it, (2) add a `show_name` privacy toggle defaulting to public, (3) generate fun random display names for anonymous users on leaderboards, and (4) add a "View as User" button in the admin client panel.

---

### 1. Database Migration

Add a `show_name` column to `user_privacy_settings`:

```sql
ALTER TABLE public.user_privacy_settings
ADD COLUMN show_name boolean NOT NULL DEFAULT true;
```

Add a `random_alias` column to `profiles` for persistent random names:

```sql
ALTER TABLE public.profiles
ADD COLUMN random_alias text;
```

Update `check_user_visibility` function to support `show_name`:

```sql
CREATE OR REPLACE FUNCTION public.check_user_visibility(...)
-- Add WHEN 'show_name' clause
```

Add a trigger on `profiles` insert to auto-generate a random alias (e.g., "SteelWolf42", "IronHawk77").

---

### 2. Name Prompt Modal (`NamePromptModal.tsx`)

- New component shown on Dashboard when `profile.full_name` is empty/null
- Clean modal with:
  - Heading: "Let's get you set up"
  - Explanation: "Matt needs your name to keep things organized and personalize your training. Your name is private if you want it to be."
  - First Name + Last Name inputs (required)
  - Toggle: "Keep my name private from other users" (controls `show_name` in `user_privacy_settings`, defaults OFF = name is public)
  - Save button that updates `profiles.full_name` and `user_privacy_settings.show_name`
- Cannot be dismissed without entering a name (no X button, no backdrop close)

---

### 3. Privacy Toggle in Profile Settings

- Add "Name" toggle to `PrivacySettingsCard.tsx` at the top of the list
- Label: "Name", desc: "Your real name visible to other athletes (Matt always sees it)"

---

### 4. Leaderboard Display Name Logic

Update all places that render user names on leaderboards (9 files identified):
- `PointsLeaderboard.tsx`, `ChallengeLeaderboard.tsx`, `ChallengeHub.tsx`, `MonthlyFocusWidget.tsx`, `AdminPointsManager.tsx`, etc.
- Current pattern: `entry.athlete_name || entry.full_name || "Athlete"`
- New pattern: If user has `show_name === false`, display `random_alias` instead
- The `usePoints` hook leaderboard query will join `user_privacy_settings.show_name` and `profiles.random_alias`
- Admin views always show real names

---

### 5. Random Alias Generator

- Database trigger on `profiles` INSERT: generate a random alias like "TitanFox23", "StealthBear91"
- Two word lists (adjectives + animals/nouns) + random 2-digit number
- Stored in `profiles.random_alias` so it's persistent and consistent

---

### 6. Admin "View as User" Button

- Add a button in `AdminClientList.tsx` user control modal: "View as User"
- Opens the user's Dashboard/Progress/Profile in a new route like `/admin/view-user/:userId`
- This page renders the same `ProgressCharts`, `LogHistory`, lift data, AI insights — but fetches data for the target user ID instead of `auth.uid()`
- Read-only view showing exactly what the athlete sees: their lifts, history, AI recommendations, programs

---

### Technical Details

**Files to create:**
- `src/components/dashboard/NamePromptModal.tsx` — the name collection modal
- `src/pages/AdminViewUser.tsx` — admin impersonation view page

**Files to modify:**
- `src/pages/Dashboard.tsx` — add NamePromptModal check
- `src/hooks/usePoints.tsx` — leaderboard query joins privacy + alias
- `src/components/gamification/PointsLeaderboard.tsx` — use alias when hidden
- `src/components/gamification/ChallengeLeaderboard.tsx` — same
- `src/components/dashboard/ChallengeHub.tsx` — same
- `src/components/features/MonthlyFocusWidget.tsx` — same
- `src/components/features/PrivacySettingsCard.tsx` — add show_name toggle
- `src/components/admin/AdminClientList.tsx` — add "View as User" button
- `src/App.tsx` — add admin view-user route

**Migration:**
- Add `show_name` to `user_privacy_settings`
- Add `random_alias` to `profiles`
- Create trigger to auto-generate aliases on profile creation
- Backfill existing profiles with random aliases
- Update `check_user_visibility` RPC

