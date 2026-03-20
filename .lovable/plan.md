

## Add M² Logo to Workout Zone + PDF Print Files

### What Changes

1. **Workout Zone UI** — Add subtle M² logo branding in two spots:
   - Replace the Dumbbell icon in the header with the `m2-logo.jpg` image (small 32px circle)
   - Add a small watermark-style logo in the empty state where exercises haven't been added yet
   - Add a tiny "M² Training" logo at the bottom of the scrollable exercise list area (visible when scrolled to bottom)

2. **PDF Print Files** — Embed the M² logo as a base64-encoded image in all three print generators so it appears prominently in the header of every printed/PDF document:
   - `printWorkoutLog.ts` — Program workout logs
   - `printCommunityWorkout.ts` — Community workout bank prints
   - `printNutritionReport.ts` — Nutrition report prints

### Technical Details

**Workout Zone (ActiveWorkoutZone.tsx):**
- Import `m2Logo from "@/assets/m2-logo.jpg"`
- Header: swap the `Dumbbell` icon circle for an `<img src={m2Logo}>` with `h-8 w-8 rounded-full object-cover`
- Empty state: replace the large Dumbbell circle with the logo
- Bottom of exercise list: add a centered `opacity-20` mini logo with "M² Training" text as a subtle brand stamp

**PDF Files (all three print*.ts):**
- Create a shared utility `src/components/workout/m2LogoBase64.ts` that exports the logo as a base64 data URI (convert the JPG at build time won't work in window.open, so we'll inline it)
- Actually, since these use `window.open` and write raw HTML, we'll convert `m2-logo.jpg` to a base64 string constant and use it as an `<img>` src in the header of each print template
- Each print file header gets: the M² logo (60px height), centered above the title, with the "M² Training" text below it
- The logo will be prominent — full-width centered at the top of every printed document

### Files Modified
- `src/components/workout/m2LogoBase64.ts` (new — shared base64 logo constant)
- `src/components/workout/ActiveWorkoutZone.tsx`
- `src/components/workout/printCommunityWorkout.ts`
- `src/components/programs/printWorkoutLog.ts`
- `src/components/nutrition/printNutritionReport.ts`

