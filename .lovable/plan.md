# Fix: "Draft failed — new row violates row-level security policy for table sms_reply_drafts"

## Root cause

`AdminProspectTracker.tsx` ("Send nudge SMS") inserts a row into `public.sms_reply_drafts` directly from the browser using the user's auth session.

The only RLS policy on that table (migration `20260420181554`) is:

```sql
CREATE POLICY "service_role_all_sms_reply_drafts"
  ON public.sms_reply_drafts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

A logged-in admin's role is `authenticated`, not `service_role`, so every browser INSERT fails RLS. This also affects `AdminPendingSMSDrafts` (Approve/Edit/Discard updates) and `AdminReferralKickback` (insert).

## Fix — add admin-scoped RLS policies

New migration adding policies that let users with the `admin` role (via the existing `public.has_role(auth.uid(), 'admin')` helper) read/insert/update on `sms_reply_drafts`. Service role keeps full access.

```sql
-- Admins can read all drafts (for Pending Drafts panel + dedup checks)
CREATE POLICY "admins_select_sms_reply_drafts"
  ON public.sms_reply_drafts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert drafts (Prospect Tracker nudges, referral kickback, etc.)
CREATE POLICY "admins_insert_sms_reply_drafts"
  ON public.sms_reply_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update draft status (approve / edit / discard)
CREATE POLICY "admins_update_sms_reply_drafts"
  ON public.sms_reply_drafts
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

No DELETE policy — admins discard via UPDATE `status='discarded'` (already what the UI does). Existing `service_role_all_sms_reply_drafts` policy stays untouched so edge functions (`auto-draft-on-inbound`, `inbound-sms-relay`, `prospect-nudge-request-approval`) keep working.

## Verification after deploy

1. Reload Prospect Tracker, click **Send nudge SMS** on the Livonia electrical prospect → toast should show "Approval requested" instead of the red RLS error.
2. New row appears in `sms_reply_drafts` with `status='pending'` and Matt receives the Y/N approval text.
3. Pending Drafts tab loads and Approve/Discard buttons work.

## Files

- **New**: `supabase/migrations/<timestamp>_admin_rls_sms_reply_drafts.sql` (the three policies above)

No code changes required — the bug is purely missing RLS coverage for the admin role.
