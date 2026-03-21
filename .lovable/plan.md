

## Bulk Open Slots: Per-Day-of-Week Selection

Change the bulk populate UI so instead of just a "Skip Weekends" checkbox, the admin picks exactly which days of the week to open slots for (e.g., only Mondays, or Mon+Wed+Fri).

### Changes to `src/components/admin/AdminSchedule.tsx`

1. **Replace `skipWeekends` boolean** with `selectedDays: number[]` state (0=Sun, 1=Mon, ... 6=Sat), defaulting to weekdays `[1,2,3,4,5]`.

2. **Replace the "Skip Weekends" checkbox** with a row of 7 day-of-week toggle buttons (Sun–Sat). Each toggles its day number in/out of the `selectedDays` array. Styled like the existing time-slot toggle chips.

3. **Update `bulkPopulate()`** to filter days using `selectedDays` instead of the weekend check:
   ```
   const days = allDays.filter(d => selectedDays.includes(d.getDay()));
   ```

4. **Update the confirm dialog and button label** to reflect the selected days (e.g., "Open 4 slots/day on Mon for 6 weeks").

No other files change. All existing logic (upsert, chunking, time selection) stays the same.

