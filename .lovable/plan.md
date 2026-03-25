
Goal: clean up the portal UI, remove the unwanted floating widget, make Chat/Timer access intentional, reorganize Programs/Workouts, and fix the Active Workout Zone so “Exit Workout” is unmistakable and always tappable.

1. Remove the global Dual FAB and replace it with restrained portal-only chat access
- Remove `DualFab`/`DualFabWrapper` from `App.tsx` so the draggable floating widget is gone everywhere.
- Keep the existing structured `AskCoachMatt` flow where it already makes sense:
  - `ActiveProgramView`
  - `CoachCheckIn`
- Add one lightweight general “Chat with Matt” entry point inside the portal only, instead of a floating button everywhere.
- Best fit: put a small portal action in the dashboard/home area and optionally a secondary access point inside the workout/program context where users may actually need help.
- Do not place it on public pages.

2. Restore the top-left header timer behavior in the portal
- Update `AppNavbar` so on portal/authenticated workout-related screens, the top-left control becomes the Interval Timer trigger instead of the logo link.
- Keep the logo behavior on public marketing pages so branding/navigation there stays intact.
- Reuse the existing timer state from `useTimer()` rather than inventing a second timer flow.

3. Fix the mobile “More” button so tapping it again closes it
- In `BottomTabBar`, change the More button from “always open” to true toggle behavior.
- Current behavior is one-way (`setMoreOpen(true)`); update it to open/close on repeated taps.
- Preserve close-on-navigation and close-on-action behavior.

4. Reorganize Programs and Workouts so they don’t eat the whole screen
Programs
- Refactor `MyPrograms` into a clearer hierarchy:
  - Continue / Current
  - Recent
  - Archive / Older
- Promote the current active program and make it the most compact, high-priority card.
- Collapse older content behind “Show more” instead of dumping full lists immediately.
- Keep print/start/log actions, but compress row height and metadata.

Workouts
- Refactor `WorkoutsTab` + `CommunityWorkoutBank` so the user first sees:
  - Continue last workout/protocol (if there is a paused session or recent launch)
  - Recent workouts
  - Full library / older items below
- Reduce vertical sprawl by using denser list rows and expandable details only when needed.
- Use existing local state/local storage patterns for “last used” instead of introducing unnecessary backend complexity unless existing data clearly supports it.

5. Give the Active Workout Zone a real modern upgrade while preserving current functionality
Observed issue
- The zone already has Exit buttons in two places, but the bottom stack (`QuickLogBar` + footer + browser chrome) is likely making it hard to see/reach on mobile.
- The zone is also carrying many good features, but they are visually scattered.

Upgrade plan
- Rebuild the zone layout around a stronger top command header:
  - clear workout title
  - visible timer access
  - compact utility actions
  - large, unmistakable destructive “Exit Workout” control pinned top-right
- Keep the bottom area focused on logging and add-exercise actions instead of putting critical exit behavior there.
- Compress/modernize the content structure:
  - summary strip at top (elapsed time, exercise count, readiness adjustment if present)
  - collapsible utility sections for recovery, notes, and button key
  - tighter exercise cards with better default collapsed/expanded behavior
  - current-tech features surfaced more intentionally: quick log, voice notes, live form tracker, readiness adjustments, adapt-to-equipment, interval timer, circuit mode, PR flow, post-workout summary
- Reduce visual clutter and dead space so more of the actual workout fits on screen.

6. Fix the Exit Workout issue so it cannot be missed again
- Make the top-right Exit control the primary, always-available escape hatch.
- Increase its visual priority and tap target.
- Ensure it sits above all internal content and is not dependent on bottom safe-area visibility.
- Keep the secondary bottom action only if it still adds value after the redesign; otherwise remove duplication to avoid confusion.
- Verify it remains visible with:
  - mobile browser chrome expanded
  - long exercise lists
  - quick log visible
  - keyboard open
  - timer modal interactions

Implementation order
1. Remove DualFab and wire intentional portal-only chat entry.
2. Restore top-left header timer behavior on portal screens.
3. Fix More-button toggle.
4. Reorganize Programs and Workouts into continue/recent/archive patterns.
5. Redesign Active Workout Zone header/footer/content structure.
6. Specifically harden and verify Exit Workout visibility/tap behavior.

Technical notes
- Files likely affected:
  - `src/App.tsx`
  - `src/components/layout/AppNavbar.tsx`
  - `src/components/layout/BottomTabBar.tsx`
  - `src/components/dashboard/CoachChatPanel.tsx`
  - `src/components/dashboard/DashboardHome.tsx`
  - `src/components/features/MyPrograms.tsx`
  - `src/components/dashboard/WorkoutsTab.tsx`
  - `src/components/workout/CommunityWorkoutBank.tsx`
  - `src/components/workout/ActiveWorkoutZone.tsx`
  - possibly `src/components/workout/QuickLogBar.tsx`
- No backend change appears necessary for the navigation/chat/timer/zone fixes.
- For “last used” organization, I’d prefer a lightweight client-side persistence approach first unless an existing timestamp/state source already cleanly supports it.
- I will preserve current portal functionality and only modernize structure/layout/entry points rather than removing any of the newer workout tech you’ve added.
