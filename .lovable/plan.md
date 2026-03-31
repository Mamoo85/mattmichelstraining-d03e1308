

# Zone Dashboard Overhaul — Mobile-First Fixes

## Problems Identified (from screenshots)
1. **Hub grid text truncated** — Labels like "Library", "Challenges", "Progress", "Workouts" show as "L...", "C...", "P...", "W..." because cards are too small for the text at the current root font size (20px)
2. **Two broken buttons circled** — "Library" and "Workouts" hub items both navigate to `/dashboard` (same destination, redundant) and are non-functional/confusing
3. **TodayCard takes up prime real estate** — User wants a profile/stats card with last workout info there instead
4. **Bottom tab labels unreadable** — At 9px with 20px root, labels may clip; icons alone are ambiguous
5. **Browser back button doesn't work** — Overlay views (programs, challenge, generator) use state, not routes, so browser back does nothing
6. **No easy app install prompt** — `/install` page exists but isn't surfaced from the Zone dashboard

---

## Plan

### 1. Replace TodayCard with Athlete Profile + Stats Card
- Remove `TodayCard` from `ZoneDashboard.tsx`
- Create `AthleteProfileCard.tsx` — a full-width card that shows:
  - User avatar/initials + name + level badge
  - Key stats row: Total Workouts, PRs Hit, Current Streak, Best Streak
  - Last workout banner (name, date, duration) pulled from `workout_logs` or `progress_logs`
  - Coach notes/messages section — show latest 1-2 messages from `coach_direct_messages` or `activity_feed_notes` where sender is admin
  - Tap navigates to `/profile`
- Place this where TodayCard currently sits (after AthleteStats, before Quick Actions)
- Add a small "current workout" banner at the top of the card if user has an active program (condensed, not the full TodayCard)

### 2. Remove Broken Hub Items, Add Activity Button
- Remove "Library" and "Workouts" from `HUB_ITEMS` array (both route to `/dashboard`, redundant)
- This leaves 6 items in the hub grid which fits cleanly in a 2-col layout

### 3. Fix Hub Grid Text Truncation
- Increase minimum card width and allow text to wrap instead of truncate
- Use `text-xs` minimum per style guidelines (not `text-[10px]` or `text-[9px]`)
- Ensure label and description are fully visible at 344px viewport width

### 4. Fix Bottom Tab Bar Readability
- Increase label size from `text-[9px]` to `text-[10px]` minimum
- Ensure labels don't truncate — use short labels: "Home", "Portal", "Shop", "Schedule", "More"
- Add `whitespace-nowrap` to prevent wrapping

### 5. Browser Back Button Support
- When opening overlay views (generator, programs, challenge), push a hash route (e.g., `#programs`) to history via `window.history.pushState`
- Listen for `popstate` event to close overlays when user presses browser back
- This makes browser back = closing the overlay panel, matching user expectation

### 6. Surface App Install Prompt
- Add a small "Install App" banner or button in the Zone dashboard (after the hub grid)
- Link to `/install` page or trigger the PWA install prompt directly
- Show only when not already in standalone mode
- Use the existing `PwaInstallBanner` logic for detecting install eligibility

---

## Files to Create
- `src/components/dashboard/AthleteProfileCard.tsx`

## Files to Modify
- `src/pages/ZoneDashboard.tsx` — replace TodayCard, remove broken hub items, add popstate handler, add install prompt
- `src/components/layout/BottomTabBar.tsx` — fix label sizing
- `src/components/dashboard/AthleteStats.tsx` — fix font sizes below minimum

## Technical Details
- Overlay history management: `useEffect` with `popstate` listener, `pushState` on overlay open, `generatorView` state cleared on back
- AthleteProfileCard queries: `coach_direct_messages` (latest admin message), `workout_logs` (last workout), `profiles` (avatar)
- All font sizes enforced to `text-xs` minimum per style guidelines

