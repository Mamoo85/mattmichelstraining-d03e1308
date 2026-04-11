

## Issues Identified

1. **Can't delete sent leads / need batch delete improvements** — The "Archive Sent" button only moves leads with `pipeline_stage === "outreach_sent"`, but leads that have been emailed (drip_step > 0) may still be in "new_lead" stage. Also, there's no "Select All" checkbox or batch action for easy mass operations.

2. **"Prospector Login" nav link** — Links to `/auth`, which is the M2 Training login page. After login, it redirects to `/dashboard` (workout dashboard). Auth.tsx has zero agency awareness — no domain-based redirect, no agency branding.

3. **M2 logo flash on agency domain** — The `index.html` hero shell shows the M2 logo first, then a script hides it and shows the agency shell. But the hero shell uses `#e8621a` (orange) for the agency branding instead of the correct cyan `#22d3ee`. Plus the M2 logo image (`/assets/m2-logo-placeholder.jpg`) loads and is visible before the swap script runs.

4. **Login on agency domain → stuck on workout dashboard, no bottom nav** — After login on agency domain, Auth.tsx redirects to `/dashboard` (the fitness dashboard). BottomTabBar correctly hides on agency domain, but now the user has no navigation. Auth should redirect agency users to `/admin#prospector` instead.

5. **Drip stage badges not showing accurate status** — The DripBadge only shows status for `active`, `completed`, `queued`, `drafted`. Leads that have been sent (drip_status might be "sent" or step > 0 with status still "not_started") don't display their stage clearly. The condition `lead.drip_step > 0 || lead.drip_status !== "not_started"` may miss cases where the backend sets different status values.

---

## Plan

### 1. Fix Auth.tsx for agency domain awareness
- Import `isAgencyDomain` from `domainConfig.ts`
- Change post-login redirect: if on agency domain, navigate to `/admin#prospector` instead of `/dashboard`
- Update the Auth page UI to show agency branding (cyan colors, "Detroit Web Agency" text) when on agency domain, hiding M2-specific content (athlete signup, parent flow, invite flow)

### 2. Fix index.html hero shell for agency domain
- Change the agency hero shell to use cyan (`#22d3ee`) instead of orange (`#e8621a`)
- Move the domain-detection script **before** the hero shells so it can set `display:none` on the M2 shell immediately via inline `style` attributes, preventing the flash
- Or: set both shells to `display:none` by default and let the script show the correct one

### 3. Fix "Prospector Login" nav link
- Rename to "Login" or "Admin Login"
- Link to `/auth?redirect=/admin` so after login it goes to the admin panel, not the workout dashboard

### 4. Improve batch delete and archive in AdminProspector
- Add a "Select All" / "Deselect All" toggle checkbox at the top of the pipeline
- Make "Archive Sent" smarter: archive leads where `drip_step > 0` OR `pipeline_stage === "outreach_sent"` (any lead that has been contacted)
- Add a "Delete All Filtered" button for the current filter view
- Add a batch status filter: "Sent", "Dripping", "No Email", etc. to make it easy to isolate and bulk-delete

### 5. Improve DripBadge accuracy
- Handle additional statuses: "sent" (from pipeline-drip-send), "1_Day_1_Sent" style values from `drip_campaign_status` JSONB
- Show the exact stage label even when status is "not_started" but `drip_step > 0` (meaning emails were sent but status wasn't updated)
- Add color-coded visual: red for no contact, amber for drafts, purple for active drip, green for completed/booked

### 6. Add agency-aware BottomTabBar or top nav for logged-in agency users
- When on agency domain and user is logged in, the AppNavbar should show an "Admin" link and a sign-out option
- This is already partially there (ADMIN link visible in screenshots), but needs a mobile-friendly fallback since BottomTabBar is hidden

---

## Files to modify

| File | Changes |
|------|---------|
| `src/pages/Auth.tsx` | Agency domain detection, redirect to `/admin#prospector`, agency-branded UI |
| `index.html` | Fix hero shell: both hidden by default, script shows correct one; fix agency colors to cyan |
| `src/components/layout/AppNavbar.tsx` | Rename "Prospector Login" → "Login", add `?redirect=/admin` |
| `src/components/admin/AdminProspector.tsx` | Select All checkbox, smarter archive logic, better DripBadge statuses, batch delete improvements |

