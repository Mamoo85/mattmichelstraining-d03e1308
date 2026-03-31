

# Zone Dashboard & Profile Overhaul — Hybrid Plan

## Problems Found

1. **Overlapping/clipping on 344px mobile**: AthleteStats uses 3 `flex-1` cards with dense content (day dots, progress ring) causing overflow. AthleteProfileCard adds extra `px-4` wrapper creating double padding. Quick Actions 4-col grid too tight.
2. **Quick-logged workouts show 0**: `ai-training-history` edge function counts only `workout_logs` table rows. QuickActivityLog saves to `activity_logs` + `community_workouts` — never `workout_logs`. Hannah's data is invisible to analytics.
3. **No notifications on workout log/activity log**: QuickActivityLog.handleSave and WorkoutLogger.handleSave never insert into `notifications`. Admin is not alerted when users log workouts.
4. **NotificationBell missing from Zone header**: ZoneDashboard header has logo + share + profile icons but no bell. Notifications exist but are hidden.
5. **Refer-a-friend is confusing**: Share button (UserPlus icon) in header is ambiguous. Moving to profile.
6. **User profile is hard to navigate**: 3 horizontal tabs (Profile, Training History, Data Center) with a massive Profile tab containing subscription, programs, lifts, challenges, gift cards, privacy, etc. Admin view is much simpler with 3 clean lateral tabs.

---

## Plan

### 1. Fix AthleteStats Mobile Layout (AthleteStats.tsx)
- Replace `flex gap-2` with `grid grid-cols-3 gap-2`
- Reduce day-dot size from `w-4 h-4` to `w-3.5 h-3.5`
- Reduce ProgressRing size from 54 to 48
- Remove motivation text (already in greeting)
- Keep level progress bar

### 2. Fix AthleteProfileCard Double Padding (AthleteProfileCard.tsx)
- Remove outer `px-4` wrapper — parent `main` already has `px-4`
- Reduce stats grid from `grid-cols-4` to `grid-cols-4` but with smaller icon sizes and font
- Truncate workout name with `max-w-[140px]` on the active workout banner

### 3. Add NotificationBell to Zone Header (ZoneDashboard.tsx)
- Import and add `NotificationBell` between logo area and profile button
- Remove the UserPlus (share/refer) button from header

### 4. Move Referral to Profile (Profile.tsx)
- Remove referral card from Zone dashboard
- Add a "Share / Invite" button in the Profile quick actions grid
- Use `navigator.share` or clipboard copy

### 5. Add Notifications on Workout Save
- **QuickActivityLog.tsx**: After successful save, insert a notification for all admins: "New activity logged: {activity_type}" with link to `/admin/view-user/{userId}`
- **WorkoutLogger.tsx / useWorkoutSave.tsx**: After successful save, insert admin notification: "Workout logged: {exerciseCount} exercises"
- **AdminDirectMessages.tsx** (coach reply): Already inserts `coach_reply` notification via `AdminCoachInbox` — verified working

### 6. Fix Training History Workout Count (ai-training-history edge function)
- Add `activity_logs` query alongside `workout_logs`
- Count unique days from both `workout_logs` dates