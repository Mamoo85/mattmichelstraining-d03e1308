

# 10 FieldDesk Customer Experience Enhancements

After a deep review of every FieldDesk component, edge function, and data flow, here are 10 high-impact enhancements ranked by customer value.

---

## 1. Customer Job Completion SMS with Photo Summary

**Problem**: When a tech marks a job "completed," the homeowner/facility manager hears nothing. They have to call the office to confirm.

**Enhancement**: Auto-fire an SMS to the customer on job completion: *"Your service at [address] is complete. Tech: [name]. [photo count] photos attached. Questions? Call [business_phone]."* If photos were uploaded, include a link to a mini gallery page.

**Files**: New edge function `field-service-job-complete-notify`, triggered from `TechJobDetail.tsx` after `completed` status update.

---

## 2. Drag-and-Drop Dispatch Board

**Problem**: The dispatch board is view-only columns. Dispatchers can't reassign jobs or change status without opening each job. Every competitor (Jobber, ServiceTitan) has drag-and-drop.

**Enhancement**: Add drag-and-drop between status columns (Open → Assigned, Assigned → En Route, etc.) and a tech assignment dropdown on each card. Use `@dnd-kit/core` for the drag interaction.

**Files**: `DispatchBoard.tsx` — major rework with dnd-kit integration + inline tech assignment.

---

## 3. Real-Time Job Status Updates (Realtime)

**Problem**: The dispatch board requires manual "Refresh" clicks. When a tech changes status in the field, the dispatcher doesn't see it until they refresh.

**Enhancement**: Enable Supabase Realtime on `field_service_jobs`. The dispatch board subscribes to `postgres_changes` and updates the board instantly when any tech changes a job status.

**Files**: Migration to add `field_service_jobs` to `supabase_realtime` publication. `DispatchBoard.tsx` — add realtime subscription channel.

---

## 4. Tech GPS Check-In on Status Change

**Problem**: `tech_locations` exists but nothing writes to it. The Live Map tab shows stale or no data for real clients.

**Enhancement**: When a tech taps "En Route," "On Site," or "Complete," capture `navigator.geolocation` and insert into `tech_locations`. The dispatcher's Live Map then shows real positions without any extra app.

**Files**: `TechJobDetail.tsx` — add `navigator.geolocation.getCurrentPosition()` call inside `handleStatusChange`. Write to `tech_locations` table.

---

## 5. Job History for Techs (Past Jobs Tab)

**Problem**: Techs only see today's active jobs. They can't look up yesterday's job to check a note, find a part number, or reference a photo they took.

**Enhancement**: Add a "History" tab to the tech mobile app showing the last 14 days of completed jobs. Tapping a past job opens it read-only with notes, photos, and parts.

**Files**: `FieldServiceTechApp.tsx` — add tab toggle (Today / History). New query for completed/invoiced jobs in last 14 days.

---

## 6. Dispatcher Notes Visible to Techs

**Problem**: The `notes` field on jobs exists but isn't prominently displayed to techs. When a dispatcher adds context ("Gate code: 4521" or "Ask for Dave at loading dock"), it's buried.

**Enhancement**: Show dispatcher notes in a highlighted callout box at the top of `TechJobDetail`, styled differently from tech-added notes. Add a "Dispatcher Notes" section with a yellow/amber accent.

**Files**: `TechJobDetail.tsx` — add dispatcher notes callout. `DispatchBoard.tsx` inline detail panel — add notes editing.

---

## 7. Job Estimated Duration + Schedule Conflict Warning

**Problem**: There's no concept of job duration. A dispatcher can schedule two jobs for the same tech at the same time with no warning.

**Enhancement**: Add `estimated_duration_minutes` to `field_service_jobs`. `JobCreateModal` gets a duration picker (30m, 1h, 2h, 4h, 8h). When assigning a tech, check for overlapping time slots and show a warning: "⚠️ Mike Johnson has 'Boiler Tune-Up' at Ford from 10:00–12:00."

**Files**: Migration to add `estimated_duration_minutes` column. `JobCreateModal.tsx` — duration field + conflict check query. `DispatchBoard.tsx` — show duration on cards.

---

## 8. Customer Signature Capture on Completion

**Problem**: Techs complete jobs with no proof of customer acknowledgment. Paper sign-off sheets get lost.

**Enhancement**: When a tech taps "Complete Job," show a signature pad (canvas-based). The signature is saved as a PNG to `job-photos` storage and linked to the job. This creates a digital record that the customer approved the work.

**Files**: New `SignaturePad.tsx` component. `TechJobDetail.tsx` — show signature step before final completion. Upload to storage bucket.

---

## 9. Daily Job Summary Email to Client Owner

**Problem**: The business owner (FieldDesk client) has no daily visibility into what happened without logging into the dispatch board.

**Enhancement**: Daily 6pm ET cron emails each active `field_crm_client` a summary: jobs completed today, total on-site hours, parts costs, photos taken, any emergency jobs. Clean HTML email matching DWA dark branding.

**Files**: New edge function `field-service-daily-summary`. Migration for cron schedule. Uses existing `dwaEmail()` template pattern.

---

## 10. Recurring Job Auto-Generation from Contracts

**Problem**: `ContractManager.tsx` and `field-service-contract-scheduler` exist, but the contract scheduler may not be creating jobs automatically. Clients with PM contracts (quarterly boiler inspections, annual CSD-1 tests) need jobs to appear on the board without manual entry.

**Enhancement**: Verify and harden `field-service-contract-scheduler` to auto-create jobs 7 days before `next_due_date`, auto-assign the contract's tech, and advance `next_due_date` to the next interval. Add a "Next Auto-Job" indicator on the contract card.

**Files**: `field-service-contract-scheduler/index.ts` — verify/fix auto-creation logic. `ContractManager.tsx` — show next auto-generation date.

---

## Implementation Priority

| # | Enhancement | Effort | Customer Impact |
|---|------------|--------|-----------------|
| 4 | GPS Check-In on Status | Small | Immediate — makes Live Map work |
| 3 | Realtime Board Updates | Small | High — eliminates manual refresh |
| 6 | Dispatcher Notes Visible | Small | High — reduces phone calls |
| 1 | Completion SMS to Customer | Medium | High — professional impression |
| 5 | Tech Job History | Medium | Medium — daily convenience |
| 8 | Signature Capture | Medium | High — legal/compliance value |
| 2 | Drag-and-Drop Dispatch | Large | High — matches competitor UX |
| 7 | Duration + Conflict Warning | Medium | Medium — prevents scheduling errors |
| 9 | Daily Summary Email | Medium | Medium — owner peace of mind |
| 10 | Recurring Job Auto-Gen | Medium | High — eliminates manual PM scheduling |

I'd recommend starting with items 4, 3, and 6 — they're small, high-impact, and immediately make FieldDesk feel like a live, connected system rather than a static tool.

