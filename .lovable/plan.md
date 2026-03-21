

# Lift Video Proof & Admin Approval System

## What You're Getting

A video accountability system where paid/in-person clients can attach lift videos to their progress logs as PR proof. Coach Matt has full control: every video and AI analysis requires admin approval before anyone else sees it. All media is deletable/archivable with minimal storage footprint.

## Architecture

```text
Progress Log Entry
├── Weight / Reps / Date (existing)
├── Video Attachment (NEW — camera icon, paid/in-person only)
│   ├── Record live or upload file
│   ├── Compressed to <10MB, stored in lift_videos bucket
│   └── Status: pending_review → approved / rejected / archived
├── AI Analysis (auto-triggered, held until admin approves)
└── Admin Controls
    ├── Review queue in Admin Dashboard (notification badge)
    ├── Approve / Reject / Archive / Delete
    ├── PDF export with M² branding
    └── Share link generation
```

## Plan

### Step 1: Database — New `lift_videos` table + storage bucket

**Migration:**
- Create `lift_videos` table (not columns on progress_logs — keeps it modular and deletable):
  - `id`, `progress_log_id` (FK), `user_id`, `video_url`, `ai_analysis` (TEXT, nullable)
  - `status` enum: `pending_review`, `approved`, `rejected`, `archived`
  - `admin_notes` (TEXT), `created_at`, `reviewed_at`
- Create `lift_videos` storage bucket (private — admin controls visibility)
- RLS: users can INSERT own videos, SELECT only approved ones for themselves; admins can do everything
- No public access — admin is the sole gatekeeper

### Step 2: User-side — Video capture on LogForm

- Add camera icon to `LogForm.tsx` (next to mic button), visible only to paid/in-person users
- Use `useTierAccess` or profile `is_in_person` check to gate the feature
- On tap: file input (accept video, capture=camera for mobile)
- Compress client-side (limit 10MB) before upload to `lift_videos` bucket
- After logging the lift, insert into `lift_videos` table with `status: pending_review`
- Show "Submitted for review" badge — user cannot see AI analysis until approved

### Step 3: LogHistory — Video indicator badge

- In `LogHistory.tsx`, query `lift_videos` for displayed log IDs
- Show a pulsing film/camera icon on entries that have video
- If `status = approved`: user can click to play video inline
- If `status = pending_review`: show "Under Review" chip (no playback for user)
- Admin view: always shows video with approve/reject/archive/delete controls

### Step 4: Auto AI analysis (held for admin approval)

- After video upload, auto-invoke existing `ai-video-form-review` edge function
- Store result in `lift_videos.ai_analysis` column
- Send notification to admin inbox: "New lift video from [athlete] — [exercise]"
- AI analysis is NOT shown to user until admin sets `status = approved`

### Step 5: Admin Review Queue

- New sub-tab or section in Admin Dashboard: "Lift Videos" with pending count badge
- Shows all `pending_review` videos with: athlete name, exercise, date, video player
- Admin actions per video: Approve, Reject (with optional note), Archive, Delete (removes file + row)
- On approve: user can now see their video + AI analysis in their log history
- On delete: removes from storage bucket AND database row (zero footprint)

### Step 6: PDF Report + Share

- "Export PDF" button on approved videos
- Generates branded report: M² logo, athlete name, exercise, weight/reps, date, AI coaching notes
- Admin can download or generate a shareable link to text/email to client
- Uses reportlab-style generation via edge function or client-side print utility

## Efficiency Measures

- **Private bucket** — no CDN bandwidth on unapproved videos
- **Separate table** — delete a row + storage object = zero trace, no orphaned columns
- **Client-side compression** — videos capped at 10MB before upload
- **Lazy video loading** — `preload="none"` on all video elements, only load on play
- **Archive status** — soft-delete without storage cost (admin can purge later)
- **No duplication** — reuses existing `ai-video-form-review` edge function and `ProgressCharts` components

## Files to Create
- Migration SQL (table + bucket + RLS)
- Admin lift video review component

## Files to Modify
- `LogForm.tsx` — add video capture button (gated by tier)
- `LogHistory.tsx` — add video indicator + playback
- `Admin.tsx` — add review queue tab with notification badge
- `AdminProgressLogger.tsx` — video capture in admin log form

