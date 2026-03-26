

# Plan: Account Merge, iCloud Auth Investigation, Pricing Feature Table Cleanup, Bottom Bar Audit

## Summary

Four distinct tasks: (1) Build an admin "Merge Accounts" tool, (2) investigate and mitigate the iCloud email sign-in problem, (3) curate and reformat the "What You Get" comparison table on the Pricing page, (4) confirm bottom bar behavior.

---

## 1. Admin Account Merge Tool

**Problem:** Users like Harry create duplicate accounts (e.g., one iCloud, one Gmail). Admin needs to combine them into one.

**Approach:**

- **New edge function action** in `admin-user-manage/index.ts`: `merge_accounts`
  - Accepts `keepUserId` (the account to keep) and `mergeUserId` (the account to absorb)
  - Migrates all data from merge → keep across every user-linked table (workout_logs, progress_logs, logged_exercises, coach_notes, notifications, point_transactions, challenge_entries, session_bookings, community_workouts, user_active_programs, purchased_programs, etc.)
  - Updates all `user_id` foreign keys from mergeUserId → keepUserId
  - Copies any non-null profile fields from the merged account if the keep account has them null (e.g., athlete_name)
  - Stores the merged email as a linked identity (see below)
  - Deletes the merged profile row and auth user
  - Returns success with a summary of migrated records

- **New `user_linked_emails` table**: Stores secondary emails for a user
  - Columns: `id`, `user_id` (FK to auth.users), `email`, `created_at`
  - RLS: users can read their own, admins can read/write all
  - This allows a user to have multiple emails on record

- **Admin UI** in `AdminClientList.tsx`: Add a "Merge Accounts" button inside the user control modal
  - Shows a search field to pick the second account
  - Displays a side-by-side comparison (name, email, stats)
  - Requires confirmation via `ConfirmActionModal`
  - After merge, refreshes the client list

## 2. iCloud Email Sign-In Investigation & Fix

**Analysis:** The likely issue is that iCloud/Apple Mail's link prefetching consumes the email verification token before the user clicks it. When the user taps the link, the token is already used/expired, so they can't verify → can't log in → make a new Google account.

**Fix:**
- Add an **interstitial confirmation page** to the email verification flow. Instead of a direct auth callback link, the email links to a page that says "Click to confirm your email" with a button that then hits the real verification endpoint. This prevents prefetch bots from consuming the token.
- This requires modifying the auth email templates (if configured) or adding a client-side handler on the `/auth` route that detects the verification token in the URL hash and shows a "Confirm" button before calling `supabase.auth.verifyOtp()`.
- Additionally, the existing `navigateFallbackDenylist` in the service worker already handles token fragments — we'll verify this covers iCloud relay scenarios.

**Pragmatic alternative (simpler):** Since magic links already exist, add a prominent "Trouble signing in?" helper on the login screen that offers to send a magic link. This gives iCloud users an immediate workaround. We'll also surface the linked emails from the new table so logging in with either email works.

## 3. Pricing "What You Get" Table — Curate & Add Show More

**Problem:** The tier_features table has 30 rows. Many are filler ("Gift Sessions", "Voice Notes", "Referral Program"). The world-class features (Exercise Library, Fix It Library, AI Generator, Posture Analysis) get lost in the noise.

**Approach:**
- Reorder and categorize features via `sort_order` updates in the database:
  - **Top tier (always visible, first 8):** Exercise Library, Fix It Library, AI Workout Generator (need to add), Posture Analysis, Video Analysis, Workout Scanner, Live Form Tracker, Custom Programming
  - **Hidden behind "Show More" button:** Workout Logger, Progress Tracking, Monthly Challenges, Recovery Advisor, Coach Messaging, Points & Leaderboard, Community Workouts, Nutrition Scanner, etc.
  - **Remove entirely:** Gift Sessions (not a real perk), Referral Program, Voice Notes, Velocity Tracker, Flag for Coach (internal feature)
- Update `TierComparisonTable` component in `Pricing.tsx`:
  - Show first 8 features by default
  - Add a "Show More" / "Show Less" toggle button below
  - Style the premium features (Posture Capture, Custom Programming, Form Check Videos) with a subtle highlight since they differentiate tiers

**Database changes:**
- Delete rows: Gift Sessions, Referral Program, Voice Notes, Velocity Tracker, Flag for Coach
- Add row: "AI Workout Generator" (all tiers true)
- Update sort_order to put the best features first
- Rename "Posture Analysis" → "AI Posture Analysis", "Video Analysis" → "AI Video Form Review"

## 4. Bottom Tab Bar — Confirm Mobile-Only

**Finding:** The bottom bar has `md:hidden` on line 118 of `BottomTabBar.tsx`, so it only shows on mobile (< 768px). On desktop, the `AppNavbar` handles navigation. This is correct and intentional — the screenshot confirms it's working as designed on mobile.

**Answer to user:** Yes, the bottom bar is mobile-only by design. Desktop users use the top navbar. No changes needed.

---

## Technical Details

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/admin-user-manage/index.ts` | Add `merge_accounts` action |
| `src/components/admin/AdminClientList.tsx` | Add merge UI in user modal |
| `src/pages/Pricing.tsx` | Add show more/less to TierComparisonTable |
| `src/pages/Auth.tsx` | Add "Trouble signing in?" magic link helper |
| New migration | Create `user_linked_emails` table, update tier_features rows |

### Database Migration

```sql
-- 1. user_linked_emails table
CREATE TABLE public.user_linked_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email)
);
ALTER TABLE public.user_linked_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own emails" ON public.user_linked_emails
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage all" ON public.user_linked_emails
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. Curate tier_features
DELETE FROM tier_features WHERE feature_label IN (
  'Gift Sessions', 'Referral Program', 'Voice Notes', 
  'Velocity Tracker', 'Flag for Coach'
);
INSERT INTO tier_features (feature_label, sort_order, tier_basic, tier_foundation, tier_custom, tier_team_elite)
VALUES ('AI Workout Generator', 3, true, true, true, true);
UPDATE tier_features SET sort_order = 1 WHERE feature_label = 'Exercise Library';
UPDATE tier_features SET feature_label = 'AI Posture Analysis', sort_order = 5 WHERE feature_label = 'Posture Analysis';
UPDATE tier_features SET feature_label = 'AI Video Form Review', sort_order = 6 WHERE feature_label = 'Video Analysis';
UPDATE tier_features SET sort_order = 7 WHERE feature_label = 'Live Form Tracker';
UPDATE tier_features SET sort_order = 2 WHERE feature_label = 'Fix It Library';
UPDATE tier_features SET sort_order = 4 WHERE feature_label = 'Workout Scanner';
-- Reorder remaining features 8+
UPDATE tier_features SET sort_order = 8 WHERE feature_label = 'Custom Programming';
UPDATE tier_features SET sort_order = 9 WHERE feature_label = 'Form Check Videos';
UPDATE tier_features SET sort_order = 10 WHERE feature_label = 'Posture Capture';
UPDATE tier_features SET sort_order = 11 WHERE feature_label = 'Progress Tracking';
UPDATE tier_features SET sort_order = 12 WHERE feature_label = 'Workout Logger';
UPDATE tier_features SET sort_order = 13 WHERE feature_label = 'Monthly Challenges';
UPDATE tier_features SET sort_order = 14 WHERE feature_label = 'Monthly Focus';
UPDATE tier_features SET sort_order = 15 WHERE feature_label = 'Coach Messaging';
UPDATE tier_features SET sort_order = 16 WHERE feature_label = 'Recovery Advisor';
UPDATE tier_features SET sort_order = 17 WHERE feature_label = 'Nutrition Scanner';
UPDATE tier_features SET sort_order = 18 WHERE feature_label = 'Community Workouts';
UPDATE tier_features SET sort_order = 19 WHERE feature_label = 'Workout Builder';
UPDATE tier_features SET sort_order = 20 WHERE feature_label = 'Points & Leaderboard';
UPDATE tier_features SET sort_order = 21 WHERE feature_label = 'Shared Feed';
UPDATE tier_features SET sort_order = 22 WHERE feature_label = 'Ask Coach Matt';
UPDATE tier_features SET sort_order = 23 WHERE feature_label = 'Interval Timer';
UPDATE tier_features SET sort_order = 24 WHERE feature_label = 'Lift Insights';
UPDATE tier_features SET sort_order = 25 WHERE feature_label = 'Session Booking';
UPDATE tier_features SET sort_order = 26 WHERE feature_label = 'Team Management';
```

