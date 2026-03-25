

# Plan: Community Features Visibility on Dashboard

## Overview
Three changes to make the dashboard feel more alive and social: a leaderboard preview on the home tab, a "Train with Someone" invite card with native share, and a community activity feed.

## Database Migration

Add two columns:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invite_card_dismissed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN DEFAULT FALSE;
```

## Change 1 — Challenge Leaderboard Preview on Dashboard Home

**New component: `src/components/dashboard/DashboardChallengePreview.tsx`**

- Fetches the active monthly challenge + top 3 public participants (reusing the same query pattern from ChallengeHub)
- Shows a compact card: challenge title, top 3 names/scores with rank medals (🏆🥈🥉), and a "View Full Leaderboard →" button that switches to the Challenge tab
- If no active challenge, renders nothing
- Receives `onViewChallenge` prop to switch tabs

**Modify `DashboardHome.tsx`**: Add `<DashboardChallengePreview />` after `<MonthlyFocusWidget />`, pass `onViewPoints` as the tab-switch callback.

## Change 2 — "Train with Someone" Invite Card

**Replace `DashboardReferralCard.tsx`** with upgraded version:

- Full card with title "Train with Someone You Know", body text about accountability, and "Send an Invite" button
- Button uses `navigator.share()` with fallback to clipboard copy
- Dismissible via X button → updates `profiles.invite_card_dismissed = true` in database
- When dismissed, renders a compact "Invite →" text link instead of the full card
- Fetches `invite_card_dismissed` from the profile on mount

**Position in `DashboardHome.tsx`**: Move above `<CustomProgramRequest />` (near top of dashboard, below empty state).

## Change 3 — Community Activity Feed

**New component: `src/components/dashboard/CommunityActivityFeed.tsx`**

- Queries last 3 `progress_logs` from other users who have `is_public_profile = true` in profiles, joined with profiles for name/alias
- Each entry: "[Name] logged [exercise_name] · [X hours ago]"
- Respects privacy: uses `random_alias` if `show_name` is false
- If no public logs, shows nothing (no empty state — avoids ghost town feel)
- Placed in `DashboardHome.tsx` after the invite card, before main content

## Files Changed

| File | Action |
|------|--------|
| Migration SQL | Add `invite_card_dismissed` and `is_public_profile` to profiles |
| `src/components/dashboard/DashboardChallengePreview.tsx` | Create — compact leaderboard card |
| `src/components/dashboard/CommunityActivityFeed.tsx` | Create — activity feed |
| `src/components/dashboard/DashboardReferralCard.tsx` | Rewrite — dismissible invite card with native share |
| `src/components/dashboard/DashboardHome.tsx` | Add new components, reorder layout |

## Technical Details

- No new RLS policies needed — profiles already has user-scoped RLS; the activity feed query joins `progress_logs` (which has public read for opted-in users) with profiles
- The `is_public_profile` column defaults to `false` — users opt in via their profile/privacy settings
- Challenge preview reuses the existing `challenge_participants` + `monthly_challenges` tables
- Native share API: `navigator.share({ title, text, url })` with `navigator.clipboard.writeText` fallback

