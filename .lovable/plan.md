

# Implementation Plan: Dashboard Overhaul + Exercise Image Integration

Two approved plans combined into one implementation pass across ~10 files.

---

## Plan 1: Dashboard UI, AI Toolbox, Learning Modals, Workout AI Access, Admin Fix

### 1. ZoneDashboard Tab Strip Fix + AI Toolbox + Learning Modals
**File**: `src/pages/ZoneDashboard.tsx`

- **Tab strip**: Reduce to `text-[10px]`, add `truncate overflow-hidden` to each tab button
- **AI Toolbox**: Add collapsible "AI Toolbox" section in GenerateTabContent below the two generator cards. Contains rounded-2xl buttons for: Bar Path Tracker, Velocity Tracker, Workout Scanner, Recovery Advisor, Exercise Substitution, Interval Timer. Each opens in an overlay.
- **Learning modals**: On each tab's first visit, check `safeLocalStorage` for `m2-tip-zone-{tab}-v1`. If absent, show `FeatureLearningModal`. "Don't show again" saves key. Add lazy imports for the modals.
- **Submit PR button**: Remove from lifts tab quick actions, fold into the MoreHorizontal popover or stats banner

### 2. FeatureLearningModal — Support Gradient Fallback
**File**: `src/components/dashboard/FeatureLearningModal.tsx`

- Accept optional `fallbackIcon` prop. When `tip.image` is empty/missing, render a gradient hero div with the icon centered instead of `<img>`.

### 3. Feature Tips — Add Zone Tab Tips
**File**: `src/components/dashboard/featureTips.tsx`

- Add 4 new exports: `ZONE_LIFTS_TIP`, `ZONE_GENERATE_TIP`, `ZONE_TRAIN_TIP`, `ZONE_HOME_TIP`
- Use empty `image` with `fallbackIcon` for gradient-based heroes (no new image assets needed)

### 4. Active Workout Camera → AI Tool Popover
**File**: `src/components/workout/ActiveWorkoutZone.tsx`

- Replace the Camera button's direct "Adapt to Equipment" behavior with a Popover offering 3 options: Adapt to Equipment, Bar Path Tracker, Velocity Tracker
- Add state for showing LiveFormTracker and VelocityTracker overlays

### 5. ExerciseCard Fixes
**File**: `src/components/workout/ExerciseCard.tsx`

- **Target button**: Show "No coach notes" message when toggled and no video/theWhy exist
- **Popover z-index**: Add `z-[120]` to PopoverContent so it renders above the ActiveWorkoutZone command pill

### 6. Admin AI Command Center — Fix Search Clipping
**File**: `src/components/admin/AdminAiCommandCenter.tsx`

- Change `overflow-hidden` on the hero container (line 425) to `overflow-visible` so the SuggestionPopup isn't clipped

---

## Plan 2: Exercise Reference Images + Description Formatting

### 7. AnatomyHologram — Show Reference Image
**File**: `src/components/workout/AnatomyHologram.tsx`

- Fetch `image_url` from `exercise_library` using `exerciseId` or title match
- If image exists, render it inside the hologram area (with scan-line overlay preserved) instead of the Activity icon
- Fallback to Activity icon if no image

### 8. ExerciseCard — Show Thumbnail
**File**: `src/components/workout/ExerciseCard.tsx` (same file as #5)

- Fetch `image_url` from `exercise_library` by `exerciseId`
- Show 40×40 rounded thumbnail next to exercise title in the header
- Show full image in coach notes expanded panel
- Add `onError` handler to hide broken images

### 9. ProtocolTable — Library Image Fallback
**File**: `src/components/features/ProtocolTable.tsx`

- For exercises without `image_url`, attempt lookup from `exercise_library` by matching exercise name
- Display library reference images same as coach-uploaded ones

### 10. Description Formatting
**Files**: `src/components/features/ExerciseLibrary.tsx`, `src/components/features/FixItLibrary.tsx`

- Add `whitespace-pre-line break-words` to `the_why` text blocks
- Add `onError` handler to all `<img>` tags

---

## Files Modified (Summary)
1. `src/pages/ZoneDashboard.tsx` — Tab fixes, AI Toolbox, learning modals
2. `src/components/dashboard/FeatureLearningModal.tsx` — Gradient fallback
3. `src/components/dashboard/featureTips.tsx` — 4 new tab tips
4. `src/components/workout/ActiveWorkoutZone.tsx` — Camera popover
5. `src/components/workout/ExerciseCard.tsx` — Target fix, z-index, image thumbnail
6. `src/components/admin/AdminAiCommandCenter.tsx` — overflow fix
7. `src/components/workout/AnatomyHologram.tsx` — Reference image display
8. `src/components/features/ProtocolTable.tsx` — Library image fallback
9. `src/components/features/ExerciseLibrary.tsx` — Formatting
10. `src/components/features/FixItLibrary.tsx` — Formatting

No database migrations needed. All image data already exists in `exercise_library`.

