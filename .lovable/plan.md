

# VIP In-Person Client System

## Problem
Currently, when admin manually sets a user's tier via the Tier Override dropdown, the `check-subscription` edge function overwrites it on every call because it syncs from Stripe. VIP in-person clients who should get free Basic access lose their tier within 60 seconds.

## What Gets Built

### 1. Database: Add `is_vip` Column to Profiles
- Add `is_vip boolean NOT NULL DEFAULT false` to `profiles`
- This flag tells the system "admin controls this user's tier — don't sync from Stripe"

### 2. Edge Function: Respect VIP Flag in `check-subscription`
- Before doing the Stripe lookup, check if the user's profile has `is_vip = true`
- If VIP, return the profile's existing `subscription_tier` as-is (skip Stripe sync entirely)
- This ensures admin-set tiers persist for VIP users

### 3. Admin UI: VIP Toggle + Invite Links in AdminClientList
- Add a "VIP Client" toggle switch in the User Control modal (next to Tier Override)
- When toggled ON, automatically set tier to "basic" (default VIP access level)
- Admin can still change the tier dropdown to any level (foundation, custom, etc.)
- Add a **"Create Invite Link"** button that generates an SMS-friendly signup link (e.g., `https://www.mattmichelstraining.com/auth?ref=vip`) the admin can copy/text to clients
- Add a **"VIP Clients"** stat card and filter option in the client list header

### 4. Subscription Guard: Treat VIP as Subscribed
- Update `check-subscription` response so VIP users return `subscribed: true`
- This bypasses trial expiration and paywall gating automatically

## Files Changed
- **New migration**: Add `is_vip` column to `profiles`
- **Edit**: `supabase/functions/check-subscription/index.ts` — skip Stripe sync for VIP users
- **Edit**: `src/components/admin/AdminClientList.tsx` — add VIP toggle, invite link button, VIP filter

## Technical Notes
- VIP users default to Basic tier access at zero cost — no Stripe subscription needed
- Admin can elevate any VIP user to higher tiers manually via the existing dropdown
- The `is_vip` flag prevents `check-subscription` from overwriting admin-set tiers
- Invite link is a simple copy-to-clipboard URL — no backend needed for link generation

