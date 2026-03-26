

# Plan: Add Hang Clean, Overhaul Progress Tab, Increase Site-Wide Typography

## Summary

Three changes: (1) add Hang Clean to lift config, (2) completely overhaul the Progress tab with larger fonts, a Matrix/synthwave aesthetic, and a redesigned body avatar, (3) increase title and text sizes site-wide.

---

## 1. Add Hang Clean to Lift Config

**File:** `src/components/progress/liftConfig.ts`

- Add "Hang Clean" to the "Advanced · Olympic" category as a 1RM lift
- Muscles: quads, glutes, hamstrings, upperBack, shoulders, forearms (similar to Power Clean)

## 2. Progress Tab Overhaul — Matrix Aesthetic

The entire progress page gets a visual overhaul with dramatically larger typography, glowing neon effects, and a rebuilt avatar.

### 2a. SectionHeader (`src/components/shared/SectionHeader.tsx`)
- Title: `text-lg md:text-xl` → `text-2xl md:text-3xl`
- Subtitle/timestamp text bumped up proportionally
- NOTE: This is also a site-wide component, so this change covers the site-wide title increase requirement

### 2b. StatsRow (`src/components/progress/StatsRow.tsx`)
- Label text: `text-[10px]` → `text-xs`
- Value text: `text-2xl` → `text-4xl`
- Unit text: `text-sm` → `text-base`
- Add stronger glow/shadow effects on the stat cards
- Add a pulsing neon border animation on the active stat

### 2c. TronChart (`src/components/progress/TronChart.tsx`)
- Title text: `text-[10px]` → `text-sm`
- Session count text: `text-[10px]` → `text-xs`
- Chart height: 280 → 320
- Increase axis font sizes from 9 → 11
- Stronger glow filter on the area line
- Add a subtle scanline overlay effect for Matrix feel

### 2d. BodyAvatar (`src/components/progress/BodyAvatar.tsx`) — Full Rebuild
- Increase SVG size from `max-w-[90px]` → `max-w-[140px]`
- Title text: `text-[9px]` → `text-base font-bold`
- View labels: `text-[7px]` → `text-xs`
- Muscle tag labels: `text-[7px]` → `text-[10px]`
- Add a green "Matrix rain" column effect in the SVG background (animated vertical lines)
- Brighter thermal glow on active muscles with stronger filter
- Add a pulsing border effect on the container
- Use monospace green tint for the cyber grid instead of cyan

### 2e. LiftInsights (`src/components/progress/LiftInsights.tsx`)
- Section title: `text-[10px]` → `text-sm`
- Label text: `text-[9px]` → `text-xs`
- Value text: `text-xl` → `text-3xl`
- Unit text: `text-xs` → `text-sm`

### 2f. LogForm (`src/components/progress/LogForm.tsx`)
- Section label: `text-[10px]` → `text-sm`
- Input heights: `h-9` → `h-11`
- Input text sizes bumped up

### 2g. LogHistory (`src/components/progress/LogHistory.tsx`)
- Toggle label: `text-[10px]` → `text-sm`
- Date text: `text-[11px]` → `text-sm`
- Weight/reps text: `text-sm` → `text-lg`
- Estimated 1RM text: `text-[10px]` → `text-sm`

### 2h. ProgressCharts (`src/components/features/ProgressCharts.tsx`)
- Lift category label: `text-[9px]` → `text-xs`
- Lift button text: `text-[10px]` → `text-xs`
- Button padding increased

### 2i. RecoveryChart — proportional text increases

## 3. Site-Wide Typography Increase

### 3a. SectionHeader (already covered in 2a)
- All box/section titles across the site use this component — single change propagates everywhere

### 3b. Global CSS (`src/index.css`)
- Add a base font-size bump: `body { font-size: 16px }` is already standard, but we ensure all `text-sm` (14px) content remains readable
- No global override needed since the component-level changes handle it

### 3c. Card titles site-wide
- The pattern `text-[10px] font-bold uppercase tracking-widest` appears across many components as card/box titles
- These will NOT be changed globally (too risky), but the SectionHeader increase covers the main section titles
- The Progress tab components are the ones getting the targeted overhaul

---

## Files Modified

| File | Change |
|---|---|
| `src/components/progress/liftConfig.ts` | Add Hang Clean |
| `src/components/shared/SectionHeader.tsx` | Increase title sizes (site-wide effect) |
| `src/components/progress/StatsRow.tsx` | Double font sizes, stronger glow |
| `src/components/progress/TronChart.tsx` | Larger text, taller chart, Matrix scanlines |
| `src/components/progress/BodyAvatar.tsx` | Rebuild with larger SVG, Matrix rain, bigger labels |
| `src/components/progress/LiftInsights.tsx` | Larger text throughout |
| `src/components/progress/LogForm.tsx` | Larger labels and inputs |
| `src/components/progress/LogHistory.tsx` | Larger text for all log entries |
| `src/components/features/ProgressCharts.tsx` | Larger category labels and buttons |
| `src/components/progress/RecoveryChart.tsx` | Proportional text increase |

