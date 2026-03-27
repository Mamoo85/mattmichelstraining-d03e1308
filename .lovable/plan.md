

# Revised Dashboard: Check-In + Prove It in Stats Banner, 2x2 Grid

## Layout Structure (top to bottom)

```text
┌─ HEADER (logo + name + timer + invite) ─────────┐
├─ STATS BANNER ──────────────────────────────────┤
│  [streak] [sessions] [level bar] [pts]  │ Avatar │
│  [program]                               │        │
│──────────────────┬───────────────────────│        │
│ 📍 Check-In      │  🏆 Prove It          │        │
└──────────────────┴───────────────────────┴────────┘
┌─ ACTION GRID (2×2) ─────────────────────────────┐
│ Main Lifts Log    │  Generator (split)           │
│ Challenges/Focus  │  Workout Library             │
└─────────────────────────────────────────────────┘
┌─ "What I Did Today" persistent button ──────────┐
┌─ Recovery & Mobility Tips banner ───────────────┐
┌─ TAB STRIP (Home, Generate, Train, Lifts) ──────┐
┌─ TAB CONTENT ───────────────────────────────────┘
```

## Changes

### 1. Logo Fix
Import the uploaded `pwa-512x512.png` as `m2-logo-zone.png` (copy the user-uploaded file to `src/assets/`). Remove all CSS `filter` chains. Use only a neon orange `drop-shadow` and `box-shadow` glow — the PNG itself has the correct colors already.

### 2. Stats Banner — Add Check-In + Prove It Strip
Replace the current single "Studio Check-In" strip at the bottom of the stats banner with a **two-button strip**:
- **Check-In** (left, cyan): Opens a popup asking "Matt's Gym" or "On Your Own". Greys out with checkmark after today's check-in.
- **Prove It** (right, orange): Dispatches `open-prove-it-zone` event.

Both sit inside the stats banner, separated by a vertical divider, with bold uppercase text and colored icons.

### 3. Action Grid → 2×2
Remove "Log Activity" and "Prove It" from grid (moved elsewhere). Remove "Matt's Brain". New grid:
- **Main Lifts Log** (orange) → navigates to `/progress`
- **Generator** (purple/cyan split) → opens Generate tab
- **Challenges & Focus** (green) → switches to Home tab
- **Workout Library** (cyan) → switches to Train tab

### 4. Persistent "What I Did Today"
Place the green quick-log button below the grid and above the tab strip. Always visible regardless of active tab.

### 5. Recovery & Mobility Tips Banner
A compact gradient strip (green → cyan) with Heart icon, linking to `/ai-insights`. Placed between "What I Did Today" and the tab strip.

### 6. Tab Order Swap
Change TABS from `[lifts, generate, train, home]` to `[home, generate, train, lifts]`. Default tab → `home`.

### 7. Lifts Tab Cleanup
Remove duplicate "What Did You Do Today" and "Main Lifts Log" buttons from inside the Lifts tab. Only show `ProgressCharts` and `OverloadCard`.

### 8. StudioCheckIn — "Matt's Gym or On Your Own" Popup
Modify `StudioCheckIn.tsx` to accept an optional `location` prop or add a choice modal before saving. Grey out button when `alreadyCheckedInToday` is true.

### 9. Condense ProgressCharts
Reduce font sizes and spacing for a more compact lift tracker view.

## Files Modified

| File | Action |
|------|--------|
| `src/assets/m2-logo-zone.png` | New — copy from uploaded `pwa-512x512.png` |
| `src/pages/ZoneDashboard.tsx` | Major edit — all layout changes |
| `src/components/sessions/StudioCheckIn.tsx` | Add location choice + grey-out logic |
| `src/components/features/ProgressCharts.tsx` | Condense spacing/fonts |

