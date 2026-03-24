

## VIP Access Controller — Implementation Plan

### What We're Building
A new admin sub-component `AdminVipAccess.tsx` that lets Coach Matt search users and toggle their `is_in_person` flag, added as a new sub-tab "VIP Access" under **The Roster** in Admin.tsx.

### Files to Change

#### 1. New: `src/components/admin/AdminVipAccess.tsx`
- Fetch all profiles: `supabase.from('profiles').select('id, user_id, full_name, email, is_in_person, created_at').order('created_at', { ascending: false })`
- Search bar filtering by name/email (client-side filter)
- Data table with columns: Name, Email, Joined, In-Person VIP Status
- VIP Status column: `Switch` toggle per row
- On toggle: update via `supabase.from('profiles').update({ is_in_person: newValue }).eq('user_id', userId)` — note: `is_in_person` is a protected field, so we need to use the `admin-user-manage` edge function or a service-role call. Since the `protect_profile_sensitive_fields` trigger allows admins, the client-side update should work because `has_role(auth.uid(), 'admin')` returns true for admin users.
- Per-row loading spinner during update
- Toast: "VIP Access Granted" / "VIP Access Revoked"
- Invalidate query on success via `queryClient.invalidateQueries`

#### 2. `src/pages/Admin.tsx`
- Add lazy import for `AdminVipAccess`
- Add new sub-tab `{ key: "vip", label: "VIP Access", content: <AdminVipAccess /> }` in The Roster section

### Technical Notes
- The `protect_profile_sensitive_fields` trigger checks `has_role(auth.uid(), 'admin')` and allows admin updates to `is_in_person`, so no edge function needed
- Uses existing Shadcn components: Input, Switch, Table, Card
- TanStack Query with `queryKey: ["admin-vip-profiles"]`

