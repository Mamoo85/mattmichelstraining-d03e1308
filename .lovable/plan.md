## DWA "Premium Tier" Build Plan — Pat-Worthy Features Only

Scope: **only the items from your list that don't exist yet** and that make the offer feel premium. Items I confirmed are already built are listed at the bottom under "Already Done — Skipping" so you can verify.

---

## What survives the audit (the actual work)

Grouped by the wave it ships in. Each item is a real gap I verified against the codebase.

### Wave A — The "Forever Pricing" infrastructure (the moat made real)

This is the single biggest premium signal Pat will see. Today none of it exists.

**A1. `client_price_locks` table + write on checkout**
- New migration: `client_id`, `stripe_subscription_id`, `locked_price_cents`, `locked_at`, `lock_version` (`v1`), `covered_features` (jsonb), `carve_out_clause` (text — see A2).
- Modify `create-djconley-checkout` (or whichever checkout the $499 / $499+$199 use) to insert the lock row inside the Stripe webhook on `checkout.session.completed`.
- RLS: client can SELECT their own row; only `service_role` can INSERT/UPDATE.

**A2. Forever-Pricing carve-out clause baked in**
- Default `carve_out_clause` text: *"Forever Pricing covers the v1 feature set + every monthly improvement to those features. Net-new product lines released after 24 months are opt-in at then-current rates."*
- Display verbatim under the Locked Price badge.

**A3. `LockedPriceBadge` component**
- Reads from `client_price_locks` for the logged-in client.
- Shows: locked monthly price, lock date, "Locked Forever" pill, hover/tap → carve-out text.
- Drop into: Owner Dashboard header, Billing tab, Pat's `/admin` top bar.

**A4. Stripe checkout for $499/mo and $499+$199/mo**
- Two new edge functions (or one with a `tier` param): `create-djconley-checkout`.
- Inline `price_data` per CLAUDE.md rules. `metadata.type = "djconley_subscription"`, `metadata.tier`, `metadata.locked_price_cents`.
- Webhook handler in `stripe-webhook/index.ts` writes to `client_price_locks` + sends welcome email via `dwaEmail()`.

### Wave B — Owner Dashboard premium surfaces

**B1. Magic-link login at the client's own domain**
- New edge function: `owner-magic-link-request` — accepts email, validates against `client_price_locks` or `field_crm_clients`, generates short-lived signed token (15 min), emails it via Resend with the `dwaEmail()` template.
- New edge function: `owner-magic-link-verify` — exchanges token for a Supabase session.
- New page: `/owner/login` (renders cleanly under client's branded domain when DNS points to us).
- Route guard `OwnerRoute` checks magic-link session, falls through to `/owner/login` otherwise.

**B2. `product_changelog` table + `/changelog` public page**
- Table: `id`, `published_at`, `title`, `body_md`, `category` (feature|fix|polish), `included_in_forever_pricing` boolean (default true), `client_visible` boolean.
- Public route at `/changelog` (page exists as `Changelog.tsx` — currently a stub; wire to table).
- Server-rendered list, newest first, filter pills by category.

**B3. "What's New" banner on Owner Dashboard**
- Component reads last 30 days of `product_changelog` rows where `client_visible = true`.
- Dismiss-per-row via localStorage; reappears when new rows ship.
- "Included in your Forever Pricing" pill on every entry.

**B4. `monthly-upgrade-recap-sender` cron wiring**
- Edge function exists. Confirm: add pg_cron schedule for 1st of month 9am ET; query last month's `product_changelog` rows; render branded email per client; queue via `email_send_log`.
- Add an admin "Send test recap to me" button on `DwaAdminQbrQueue` (or new `AdminUpgradeRecap` page).

### Wave C — Command Center (Pat's daily-use surface)

**C1. `command_center_tiles` table**
- Columns: `id`, `client_id`, `label`, `url`, `icon_key`, `open_mode` (`iframe`|`new_tab`), `position` (int), `created_at`.
- RLS: client reads/writes own rows only.

**C2. Command Center grid component + `/admin/command-center` route**
- CRUD UI: add tile, drag to reorder (`@dnd-kit/sortable`), per-tile open mode toggle.
- Iframe attempt with X-Frame-Options fallback to "open in new tab" + auto-flip the tile's `open_mode` so it stays.
- Pinned bar across `/admin/*` showing top 6 tiles.

**C3. "Sync to Command Center" seed action**
- Admin button on Marketing Tools panel that bulk-inserts Pat's most-used URLs (eWay, FieldServio, QuickBooks, Gmail, Google Calendar, BSEED, MITN.info, bank, payroll) — pulled from a config constant initially, editable after.

### Wave D — ICP & SiteRadar Pro premium polish

**D1. `icp_keywords` table (replace localStorage)**
- Columns: `user_id`, `keyword`, `weight` (int 1–5), `created_at`.
- RLS: user reads/writes own rows.
- Migrate any existing `localStorage` ICP keywords on first login (one-shot client-side script).

**D2. ICP scoring + filter on SiteRadar Pro dashboard**
- Server-side scoring fn: visitor event → match keywords → weighted score 0–100.
- New `match_score` column on `crm_visitor_events`.
- UI: sort/filter by ICP score; gated to active SiteRadar Pro subscribers via existing subscription check.

**D3. "ICP Matched" top-5 realtime panel**
- Supabase Realtime subscription on `crm_visitor_events` filtered by `client_id` + `match_score >= 70`.
- Tooltip on each row shows which keywords matched (returned from scoring fn as `matched_keywords[]`).

**D4. Instant SMS alerts for ICP matches**
- New edge function: `icp-match-sms-alert` triggered from a Postgres trigger on `crm_visitor_events` insert when `match_score >= threshold`.
- Per-client config row (`icp_alert_settings`): phone, threshold, opt-in, quiet-hours respect via `_shared/twilio.ts`.

### Wave E — Run reliability + observability (the items that block Pat from clicking "send")

**E1. `outreach_runs` table + state machine**
- Columns: `id`, `kind` (`one_press`|`djconley_proposal`|`followup`), `status` (`queued`|`running`|`succeeded`|`failed`|`canceled`), `total_targets`, `sent_count`, `failed_count`, `error_log` jsonb, `created_by`, `started_at`, `finished_at`.
- Every outreach edge function writes a row + step events to `outreach_run_steps`.

**E2. Preflight gate on `outreach-one-press`**
- Before kicking off: check (a) eligible prospect count > 0, (b) all have valid email, (c) no rate-limit window breach, (d) marketing kill switch is OFF, (e) not in TCPA quiet hours for SMS branches.
- Returns structured error per failed check; UI renders red banners with the specific cause.

**E3. JWT/auth fix for `outreach-one-press → contractor-outreach-email-blast` chain**
- Today the parent forwards the user's JWT to the child function, which sometimes hits `verify_jwt = true` and explodes with `UNAUTHORIZED_INVALID_JWT_FORMAT`.
- Fix: parent invokes child with `SUPABASE_SERVICE_ROLE_KEY` in the Authorization header (server-to-server), and child validates a shared signed payload (HMAC of `run_id` + timestamp) instead of trusting the JWT.
- Add `verify_jwt = false` for `contractor-outreach-email-blast` in `config.toml` if not already set, since it is now an internal callee.

**E4. Queue-based send worker**
- `outreach_send_queue` table (or pgmq queue if already in use for emails).
- `outreach-send-worker` edge function drains N per cycle, writes step rows, retries with backoff, marks DLQ after 3 fails.
- pg_cron every 1 min.

**E5. Run dashboard + diagnostics panel**
- New admin page `/admin/outreach/runs`: list of runs with status pill, retry/resume/cancel buttons (each calling a small edge function that mutates `outreach_runs.status`).
- Drill-in panel shows step-by-step timeline, last error, payload that failed, "Retry this step" button.

**E6. Alerting on unauthorized + zero-send outcomes**
- pg_cron every 5 min: scan `outreach_runs` for `failed` with `error_log->>'code' = 'UNAUTHORIZED'` or `succeeded` with `sent_count = 0`.
- Send `notifyMatt()` SMS once per run (idempotent via `alerted_at` column).

**E7. Widen prospect search**
- Bump default lookback in `outreach-one-press` prospect query from current window to **90 days**.
- Trade-label match: switch from exact equality to `ILIKE %trade%` plus a synonym map (boiler↔heating, hvac↔mechanical, etc.) in a small `trade_synonyms` table.

### Wave F — Pat-specific premium touches (small but visible)

**F1. Proposal email preview + admin send card**
- New admin component `DJConleyProposalCard`: shows rendered React Email template (iframe srcdoc), "Send test to me" + "Send to Pat" buttons.
- "Send to Pat" calls existing `send-djconley-proposal` (already exists), logs to `outreach_runs`, shows confirmation toast with timestamp + recipient.

**F2. Pitch Audit Log: pagination + inner scroll**
- Existing `OutreachAuditLog.tsx` page: add server-side pagination (25/page), constrain table container to `max-h-[70vh] overflow-y-auto` so the page itself doesn't scroll-jack.

**F3. Admin sidebar mobile fix**
- Marketing Tools panel currently squeezes under 380px viewport.
- Switch sidebar to `Sheet` overlay below `md:` breakpoint; pinned floating menu button.

**F4. Unsubscribe link in pitch SMS/email**
- Add `STOP` instruction (already in `_shared/twilio.ts` but verify) + `?unsub_token=...` link in proposal email pointing at existing `handle-email-unsubscribe`.
- Verify token row is created when proposal sends.

---

## Already Done — Skipping (verified in code)

These appeared in your list but are already built — I checked the files. If any feel broken, tell me and I'll requeue them as bug fixes:

- `outreach-one-press` edge function ✅ (exists, needs E2/E3/E5 hardening only)
- `contractor-outreach-email-blast` ✅
- `monthly-upgrade-recap-sender` ✅ (function exists; needs C-wave cron + admin trigger)
- `nps-survey-sender` ✅ (needs 30-day cron schedule confirmed)
- `dwa-v4-qbr-generator` + `DwaAdminQbrQueue.tsx` ✅
- `dwa-v4-stripe-reconcile-diff` + `DwaAdminStripeReconcile.tsx` ✅ (set 6-hour cron)
- `send-djconley-proposal`, `send-djconley-followup-sms`, `send-djconley-pitch-v2` ✅ (Pat phone now correct)
- `DJConleyDemo1` + `DJConleyDemo2` ✅ — already redirect to brand-correct `/demo-djconley-v2` (navy #1B4F8A + orange #E07B39, zero teal)
- `Changelog.tsx` page exists ✅ (needs B2 wiring to table)
- `OutreachAuditLog`, `OutreachObservability`, `OutreachQueue` admin pages ✅ (need pagination + diagnostics drill-in)
- `/dwa-admin` route exists ✅ — if it's loading homepage it's an auth-redirect bug; will verify in build pass
- "Test SMS to my number only" ✅ — `_shared/twilio.ts` already has admin-test mode; just need a UI toggle on the proposal card

---

## Order of execution (recommended)

1. **Wave A** (price locks + checkout) — turns the offer into a real product Pat can buy.
2. **Wave E** (run reliability) — without this, every other "send" button is a coin flip.
3. **Wave B** (owner dashboard) — what Pat sees Day 1 after paying.
4. **Wave C** (Command Center) — what makes him open the dashboard daily.
5. **Wave F** (polish) — ship in parallel as small PRs.
6. **Wave D** (ICP / SiteRadar Pro) — premium upsell, ship after Pat is live.

---

## Open questions before I build

1. **Magic-link domain strategy:** Do you want the magic link to land on `djconley.com/admin` (requires DNS work on Pat's domain) or on `app.detroitwebagent.com/owner/djconley`? The first is more premium, the second ships in a day.
2. **Command Center seed list:** Do you want me to use the 9 default tiles (eWay, FieldServio, QuickBooks, Gmail, Google Calendar, BSEED, MITN, bank, payroll) or send Pat a form to fill in first?
3. **Forever-Pricing carve-out language:** OK to ship the 24-month / net-new-product-line clause as written in A2, or do you want to soften/strengthen it?

Approve and I'll execute Wave A + Wave E first (the two that unlock revenue + reliability), then loop back for B/C/D/F.