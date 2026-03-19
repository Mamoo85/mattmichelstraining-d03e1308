

# Add VIP Tier to Access Manager + Feature Audit

## What This Does

1. **Adds a VIP column** to the Tier Access Manager so the admin can toggle which features VIP users can access
2. **Adds VIP invite link generation** directly in the Tier Manager (admin-only, unique invite links)
3. **Expands the preset feature list** to cover ALL app features currently missing from the manager

## Database Changes

**Migration:** Add `tier_vip` boolean column to `tier_features` table (default `true` — VIP gets everything by default)

The existing `tier_legend` column is unused and will be left as-is (no breaking changes).

## Changes

### 1. Database Migration
- `ALTER TABLE tier_features ADD COLUMN tier_vip boolean NOT NULL DEFAULT true;`

### 2. `src/components/admin/AdminTierManager.tsx`
- Add VIP to the `TIERS` array with a Crown icon (positioned after Team/Elite)
- Add VIP invite link generator section at the top: a button that generates a unique invite URL (using the existing VIP flow from `AdminClientList`) and copies it to clipboard
- **Expand `PRESET_FEATURES`** to include ALL missing features:
  - `progress_tracking` — Progress Charts & Lift Logging
  - `nutrition_scanner` — already present
  - `ai_recovery` — AI Recovery Advisor
  - `workout_scanner` — Workout Photo Scanner
  - `shared_feed` — Community Workout Feed
  - `session_booking` — already present
  - `posture_capture` — Posture Photo Capture
  - `lift_insights` — AI Lift Insights
  - `ask_coach_matt` — Ask Coach Matt (already used in code but missing from presets)
  - `referral_program` — Referral & Earn Program
  - `points_leaderboard` — Points & Leaderboard
  - `gift_sessions` — Gift a Session
  - `interval_timer` — Interval Timer
  - `workout_builder` — Custom Workout Builder
  - `live_form_tracker` — Live Form Tracker
  - `voice_notes` — Voice Notes

### 3. `src/hooks/useTierAccess.tsx`
- Add `"vip": "tier_vip"` to `TIER_COLUMN_MAP`
- When checking access for a VIP user (detected via profile `is_vip` flag), check the `tier_vip` column instead of their stored subscription tier

### 4. `src/hooks/useAuth.tsx`
- Expose `isVip` boolean from the auth context (read from the profile's `is_vip` field)

### 5. VIP Invite Link Generator (in AdminTierManager)
- Small card at the top of the Tier Manager with a "Generate VIP Invite Link" button
- Generates a link like `/auth?ref=vip-{random8chars}` 
- Copies to clipboard with a toast confirmation
- Admin can text/email this link manually

## Files Modified
- **Migration**: New migration for `tier_vip` column
- `src/components/admin/AdminTierManager.tsx` — VIP column + expanded presets + invite link generator
- `src/hooks/useTierAccess.tsx` — VIP tier access logic
- `src/hooks/useAuth.tsx` — Expose `isVip` flag

