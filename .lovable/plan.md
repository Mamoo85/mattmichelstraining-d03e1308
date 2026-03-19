- Welcome Gift System for New Signups

## Overview

When a new user creates a free account, they receive two pre-built workouts in their portal and a posture analysis offer popup. The posture flow is designed to funnel free users toward a Basic membership ($14.99/mo).

## What Gets Built

### 1. Database: Seed Welcome Workouts via Trigger

- Create a DB trigger on the `profiles` table (after insert) that automatically inserts two rows into `community_workouts` for the new user:
  - **"Death by Hang Cleans"** — 4 rounds: Hang Cleans + Burpees, Hang Clean Front Squats + Burpees, Hang Clean Presses + Burpees, Hang Clean Front Squat Presses + Burpees (10 reps each)
  - **"Matt's Mountain Workout"** — Pyramid structure with 6 beginner exercises (mobility/core/foundational): Round 1 = Ex1; Round 2 = Ex1+Ex2; ... Round 6 = all 6. Exercises: Cat-Cow, Dead Bug, Goblet Squat, Push-Up, Band Pull-Apart, Plank
- These workouts will be private (`is_public = false`) and appear in the user's workout bank immediately

### 2. New Component: `WelcomeGiftModal`

- A full-screen modal shown to new users on their first dashboard visit
- **Screen 1 — Workout Gift**: Announces the two free workouts with workout names and a "Let's Go" button
- **Screen 2 — Free Posture Analysis Offer**: 
  - Explains the free AI posture analysis
  - Two CTAs: **"Let's Do It"** (opens camera for front + side photos) and **"No, I'm Scared 😅"** (dismiss/do later)
  - If they choose to do it: uses device camera to capture front and side photos, uploads to `form_checks` storage bucket with metadata, and inserts a row into a lightweight `posture_requests` table so it lands in the admin inbox
- **Screen 3 — Basic Membership Promo**: After the posture step (whether they did it or skipped), show a promo card with a discount code for Basic membership ($14.99/mo) with a CTA to `/pricing?promo=CODE`
- Tracks that the user has seen this via `localStorage` key `m2-welcome-gift-seen`

### 3. Database: `posture_requests` Table

- New table: `id`, `user_id`, `front_photo_url`, `side_photo_url`, `status` (pending/analyzed/sent), `analysis`, `created_at`
- RLS: users can insert their own, admins can read/update all
- When admin reviews in the existing Biomechanics admin panel, they approve the AI analysis and it gets sent back

### 4. Admin Inbox Integration

- Add a "Posture Requests" section to the admin coach inbox showing pending requests with the uploaded photos
- Admin can run the existing `analyze-biomechanics` function on the photos, review/edit, and approve — which creates a notification for the user

### 5. Dashboard Integration

- In `DashboardHome`, detect first-time users and show `WelcomeGiftModal`
- Add a persistent "Free Posture Analysis" card in the dashboard for users who skipped it, linking back to the camera capture flow

### 6. Stripe Promo Code

- Use the existing `create-stripe-promo` edge function to generate a welcome promo code for Basic tier (e.g., `WELCOME-M2` for a percentage off first month)

## Files Changed

- **New migration**: Create `posture_requests` table + welcome workout trigger on `profiles`
- **New**: `src/components/dashboard/WelcomeGiftModal.tsx` — multi-step welcome modal
- **New**: `src/components/dashboard/PostureCapture.tsx` — camera capture component for front/side photos
- **Edit**: `src/components/dashboard/DashboardHome.tsx` — mount the welcome modal for new users
- **Edit**: `src/components/admin/AdminCoachInbox.tsx` — add posture requests tab
- **Edit**: `src/pages/Admin.tsx` — wire up posture requests if needed

## Technical Notes

- Welcome workouts use the existing `community_workouts` table structure with `is_public = false`
- The posture capture reuses camera patterns from the existing `SmartCamera` component
- Photos upload to the existing `form_checks` public bucket
- The welcome modal only shows once per device (localStorage flag), but the posture analysis option remains accessible from dashboard
- 50% off their first month if they sign up for a basic membership within the next 14 days.