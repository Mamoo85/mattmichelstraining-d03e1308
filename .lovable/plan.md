

# Tighten the Program Delivery System

## The Problem
Right now, the program experience is a flat week/day picker. There's no sense of progression, no "you are here" indicator, no automatic next-workout flow, and no structured 8-week block cycle. It doesn't feel like a system — it feels like a spreadsheet.

## What We'll Build

### 1. Track Progress in the Database
Add `current_week` and `current_day` columns to `user_active_programs`, plus a `block_number` (defaults to 1). When an athlete completes a day, the system auto-advances them to the next day/week. After week 8, the block increments and weeks reset — the subscriber stays, the program evolves.

Migration adds:
- `current_week` (int, default 1)
- `current_day` (int, default 1)  
- `block_number` (int, default 1)
- `completed_days` (jsonb, default '[]') — stores completed week/day pairs

### 2. Program Progress Card on Dashboard Home
Replace the generic empty state with a **"Today's Training"** card that shows:
- Program name + block/week label (e.g. "Block 1 · Week 3 of 8")
- A compact progress bar (days completed out of total)
- A single "Start Day X" button that launches directly into the correct day
- "Last session: 2 days ago" timestamp from progress_logs

This is the first thing the athlete sees. One tap to train.

### 3. Rework ActiveProgramView with Progression
- Auto-select the current week and day based on `current_week` / `current_day`
- Completed days get a checkmark badge; future days are accessible but dimmed
- After finishing a workout (logging via the Workout Zone or Log Session), mark that day complete and advance the pointer
- At week 8 completion, show a "Block Complete" celebration and auto-increment to Block 2

### 4. Coach Check-In Prompts
At weeks 2, 4, and 7, inject a small "Coach Check-In" card below the day's exercises:
- Week 2: "How's the weight feeling? Send Matt a quick note"
- Week 4: "Halfway mark — request a form review"
- Week 7: "Next block starts soon — request program adjustments"

These link to the existing Ask Coach Matt component. No new backend needed — just strategic placement that makes the coaching relationship feel active.

### 5. Block Transition Flow
When `current_week` exceeds `total_weeks` (8):
- Show a summary card: sessions completed, estimated 1RM improvements (pulled from progress_logs)
- "Start Block 2" button that resets week/day to 1 and increments block_number
- This is the retention hook — the subscriber sees tangible progress and a clear reason to keep going

## Files Changed

| File | Change |
|---|---|
| Migration (new) | Add `current_week`, `current_day`, `block_number`, `completed_days` to `user_active_programs` |
| `src/components/dashboard/DashboardHome.tsx` | Add "Today's Training" card fetching active program + progress |
| `src/components/programs/ActiveProgramView.tsx` | Auto-select current week/day, checkmarks on completed days, day-complete handler |
| `src/components/programs/BlockCompleteSummary.tsx` (new) | End-of-block celebration + "Start Next Block" CTA |
| `src/components/programs/CoachCheckIn.tsx` (new) | Small prompt card shown at weeks 2, 4, 7 |
| `src/components/features/MyPrograms.tsx` | Pass `current_week`/`current_day` to ActiveProgramView, show block number in list |

## What This Does for Retention
The subscriber now sees: a progress bar that fills, a coach who checks in at specific milestones, a block that completes and resets into the next phase. It stops feeling like "I'm paying for access to exercises" and starts feeling like "I'm in a system that's moving me forward."

