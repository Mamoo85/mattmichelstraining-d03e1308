

## Revised Plan: "Prove It" PR Zone + Onboarding Tour

This builds on the previously approved plan with two additions:

### New Additions

**1. Media Vault Auto-Save**
When admin approves a PR submission, the video is automatically copied from the `lift_videos` bucket into the `admin_media` bucket and registered in the `admin_media_files` table. This ensures all approved PR footage is available in the Media Vault for later use (social content, highlights, etc.).

- Handled inside `AdminProveItReview.tsx` — on "Approve", after updating `pr_submissions` status:
  1. Download the video from `lift_videos` bucket
  2. Upload a copy to `admin_media` bucket with a descriptive filename (e.g., `prove_it/athleteName_exercise_date.mp4`)
  3. Insert a row into `admin_media_files` with metadata

**2. Video Usage Consent**
Add a required consent checkbox to the `ProveItZone.tsx` submission form:

> "I give Coach Matt permission to use this video for coaching reviews, social media, and promotional content."

- Store the consent as a boolean column `media_consent` on the `pr_submissions` table (default `false`, non-nullable)
- Submission is blocked until the checkbox is checked
- Admin review panel shows a badge indicating consent was granted

---

### Database Changes (updated)

**`pr_submissions` table** now includes:
- `media_consent BOOLEAN NOT NULL DEFAULT false` — records athlete's permission to use the video

Everything else from the previously approved plan remains unchanged:
- `ProveItZone.tsx` — PR submission with mandatory video + consent checkbox
- `PortalOnboarding.tsx` — multi-page tour modal
- `AdminProveItReview.tsx` — admin review with auto-copy to media vault on approval
- Dashboard button swap to "Attempting New Best"
- RLS policies, event wiring, admin panel integration

### Files to Create
| File | Purpose |
|------|---------|
| `src/components/workout/ProveItZone.tsx` | PR submission zone with video upload + consent |
| `src/components/dashboard/PortalOnboarding.tsx` | Multi-page onboarding tour |
| `src/components/admin/AdminProveItReview.tsx` | Admin review + media vault auto-save |