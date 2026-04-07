

# Enable RLS on 4 Unprotected Public Tables

## Problem
Four tables exposed via PostgREST have no RLS enabled, allowing anyone with the anon key to read/write them freely:
- `newsletter_subscribers`
- `newsletter_sends`
- `seo_package_orders`
- `newsletter_sponsor_inquiries`

## Plan

### Single migration to enable RLS and add service_role-only policies

For all four tables:
1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
2. `ALTER TABLE ... FORCE ROW LEVEL SECURITY;`
3. Add a `service_role` ALL policy (edge functions use service_role to manage these)
4. For `newsletter_subscribers` only: add an **anon INSERT** policy scoped to the specific columns needed by the website signup form (email, name, active, source) — since `NewsletterPage.tsx` inserts directly via the anon client

### Update NewsletterPage.tsx
The current upsert uses `as any` cast. No code change needed beyond the migration since the anon INSERT policy will allow the upsert to continue working. The `onConflict: "email"` upsert will work with an INSERT policy.

### Files changed
- 1 new migration SQL file (RLS + policies for all 4 tables)
- No frontend changes required

