
## Live Prospect Status Tracker

A minimal, isolated system to watch the Livonia electrician (and every future nudge prospect) move from **link click → account → profile complete → paid**. Zero edits to existing webhooks, pages, or Stripe handlers.

### What you'll see
A new **📍 Prospect Tracker** tab in `/dwa-admin` showing every nudged prospect as a card with a 4-step progress bar:

```
(734) 620-7178 · Livonia electrician
[●━━━●━━━○━━━○]  Clicked → Account → Profile → Paid
Last activity: clicked link 12m ago
[Copy tracked link]  [Send fresh nudge]  [Mark dead]
```

Updates live (Supabase realtime). Green dot = done, gray = pending, amber = stalled 24h+.

### How tracking works (the 4 milestones)

| Step | How we detect it |
|---|---|
| 1. **Clicked link** | New `/r/{token}` redirect — logs hit, then 302s to `/contractor-leads?ref={token}` |
| 2. **Account created** | Stripe Checkout session started (webhook event already fires — DB trigger watches it) |
| 3. **Profile complete** | Stripe Checkout completed + `contractor_clients` row inserted (existing flow) |
| 4. **Paid** | `contractor_lead_subscription` active in `contractor_clients` (existing flow) |

A **DB trigger** on `contractor_clients` matches new signups to `prospect_nudges` rows by phone number and stamps the milestone columns. The existing `stripe-webhook` is **not modified** — the trigger fires automatically when the webhook inserts the row.

### Files added (all new — nothing edited)

**1 migration** — `supabase/migrations/20260421000000_prospect_nudges.sql`
- `prospect_nudges` table: `id`, `phone`, `name`, `business`, `city`, `trade`, `link_token` (random 12-char), `notes`, `clicked_at`, `signup_started_at`, `account_created_at`, `profile_completed_at`, `paid_at`, `status` (active/dead/converted), `created_at`
- RLS: service_role + admin only
- Trigger `match_prospect_on_contractor_signup` on `contractor_clients` AFTER INSERT — looks up phone in `prospect_nudges`, stamps `account_created_at` + `paid_at`. Uses `ON CONFLICT DO NOTHING` semantics — never errors out, never blocks the existing insert.
- Seeds Livonia row: `('+17346207178', null, null, 'Livonia', 'electrical', ...)`

**1 edge function** — `supabase/functions/track-prospect-link/index.ts`
- `verify_jwt = false`, GET `/r/{token}`
- Updates `clicked_at` if null, then 302 redirect to `/contractor-leads?ref={token}`
- Fail-open: bad token → still redirects to `/contractor-leads` (never breaks prospect's flow)

**1 admin component** — `src/components/dwa-admin/AdminProspectTracker.tsx`
- Card grid, 4-step progress bar per prospect, realtime subscription on `prospect_nudges`
- "Copy tracked link" button → `https://detroitwebagent.com/r/{token}`
- "Add prospect" form (phone + optional name/city/trade)
- Filter: All / Active / Stalled (24h+) / Converted

**1 wiring change** — `src/pages/DWAAdmin.tsx` adds new tab `📍 Prospect Tracker`

**1 route** — `/r/:token` in `src/App.tsx` → tiny client component that calls the edge function and redirects (or we route directly to the edge function URL — even cleaner)

### Why this is code-safe
- ✅ **Zero edits** to `stripe-webhook/index.ts`, `contractor-lead-notify`, or any existing function
- ✅ **Zero edits** to `/contractor-leads` page or checkout flow
- ✅ New table is fully isolated; nothing else queries it
- ✅ DB trigger is wrapped in `EXCEPTION WHEN OTHERS THEN RETURN NEW` (matches your existing pattern in `auto_block_paying_client`) — can never break contractor signups
- ✅ Tracked redirect is brand-new route, no collisions
- ✅ Follows your project rules: RLS + service_role policy, `verify_jwt = false` for public function, dark DWA branding

### After it ships
1. Livonia row is pre-seeded — tracker is live for him immediately.
2. I'll text him a fresh tracked link (`/r/{token}` instead of bare URL) so the click registers.
3. Future nudges: just add the prospect in the admin, copy the tracked link, paste into your draft.

### Technical notes
- Token: 12-char base62 via `gen_random_uuid()` substring — collision-safe at our scale
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.prospect_nudges;`
- Phone matching uses `regexp_replace(phone, '\D', '', 'g')` on both sides for E.164 vs raw normalization
- Trigger only fires on INSERT (not UPDATE) — no double-stamping
