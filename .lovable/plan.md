

## Pro Tier Intake Form — Implementation Plan

### Overview
Create a multi-step assessment form for Pro/Elite subscribers, backed by a new database table and Supabase Storage, with automatic redirect after Stripe checkout.

---

### 1. Database Migration
Create `client_assessments` table:
- `id` (uuid, PK, default gen_random_uuid())
- `user_id` (uuid, NOT NULL, references auth.users on delete cascade)
- `age` (integer)
- `height` (text) — allows formats like "5'10" or "178cm"
- `weight` (text)
- `daily_activity` (text)
- `injury_history` (text, NOT NULL)
- `equipment_access` (text)
- `goals` (text)
- `posture_photos` (text[] — array of storage URLs)
- `squat_video` (text — single storage URL)
- `status` (text, default 'pending') — for coach workflow
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

Enable RLS:
- Users can INSERT their own row (`auth.uid() = user_id`)
- Users can SELECT their own row
- Admins can SELECT all rows

Create a **storage bucket** `assessments` (private) with RLS policies allowing authenticated users to upload to their own folder and admins to read all.

### 2. New Page: `src/pages/Assessment.tsx`
Multi-step form with 3 steps:

**Step 1 — Baseline & Damage Report:**
- Age (number input)
- Height (text input)
- Weight (text input)
- Daily Activity (text input)
- Injury History & Chronic Pain (large required textarea with helper text "Do not leave anything out")

**Step 2 — Environment:**
- Available Equipment (textarea)
- 12-Week Definition of Success (textarea)

**Step 3 — Visual Check:**
- 3 posture photo upload zones (Front, Back, Side) — each required
- 1 video upload (15-second side-angle bodyweight squat)
- Uploads go to `assessments/{user_id}/` bucket path
- Show preview thumbnails and progress indicators

On submit: insert row into `client_assessments`, redirect to `/dashboard` with toast "Assessment sent to Coach Matt. Your custom block will be ready in 24 hours."

### 3. Route Registration in `App.tsx`
- Add `/assessment` route wrapped in `<ProtectedRoute>` (no SubscriptionGuard — they just subscribed)
- Lazy-load the Assessment page

### 4. Checkout Redirect Logic
Update `src/pages/Pricing.tsx` `handleCheckout`:
- For `pro` and `elite` tiers, set `successUrl` to `/assessment?checkout=success` instead of `/dashboard?checkout=success` or `/schedule?checkout=success`
- This ensures new Pro/Elite subscribers land on the assessment form after payment

### 5. Files Changed
| File | Change |
|------|--------|
| New migration | `client_assessments` table + RLS + `assessments` storage bucket |
| `src/pages/Assessment.tsx` | New multi-step form page |
| `src/App.tsx` | Add `/assessment` route |
| `src/pages/Pricing.tsx` | Redirect pro/elite checkout success to `/assessment` |

### Technical Notes
- Posture photos capped at 5MB each, video at 25MB (consistent with existing media limits)
- Uses existing Shadcn UI components (Input, Textarea, Button, Card)
- Step navigation with back/next buttons, progress indicator at top
- Form validation with required fields enforced per step before advancing

