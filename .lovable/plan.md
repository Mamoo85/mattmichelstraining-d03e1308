## Scope

Two things in **this** project. Guild & Grain marketplace = separate new Lovable project (start when ready).

---

## 1. Etsy Shop Admin Page (`/dwa-admin` → "Etsy Shop")

Single tab in DWAAdmin with two editable fields (the only ones Etsy's API allows mutating):

- **Shop title** (tagline under shop name, ≤55 chars)
- **Shop announcement** (banner inside shop, ≤2200 chars)

UI:
- Current values shown (live-fetched from Etsy `getShop`)
- Edit textarea + "Push to Etsy" button → calls edge function → toast on success
- Edit history log (last 20 changes, who/when/what) from new `etsy_shop_edits` table
- Manual-change checklist card explaining what still requires the Etsy dashboard (shop name, banner image, icon)

Edge functions:
- `etsy-shop-get` — GET wrapper around Etsy `/shops/{shop_id}`
- `etsy-shop-update` — PUT to `/shops/{shop_id}` with `title` + `announcement`

Requires `ETSY_API_KEY` + `ETSY_ACCESS_TOKEN` + `ETSY_SHOP_ID` secrets (will prompt if missing).

---

## 2. Automated Announcements

**Recommended trigger mix** (rotates so the banner never goes stale):

| Trigger | Frequency | Copy template |
|---|---|---|
| New product published | Real-time on `printify-direct-publish` success | "✨ New drop: {title} — shop now" |
| Weekly featured product | Mon 9am ET cron, picks top product by recent views/sales | "This week's pick: {title}" |
| Sale schedule | Admin sets start/end date | "{discount}% off through {end_date}" |
| Quiet-day fallback | Daily 8am ET if banner >7 days old | Rotates evergreen lines from a copy pool |

Implementation:
- New table `etsy_announcement_schedule` (id, type, copy, starts_at, ends_at, active, priority)
- New table `etsy_announcement_log` (what was pushed when, by which trigger)
- Edge function `etsy-announcement-rotator` — cron daily 13:00 UTC, picks highest-priority active row, calls `etsy-shop-update`
- Edge function `etsy-announcement-on-publish` — hooked into existing publish flow, queues a "new drop" announcement
- Admin UI: schedule manager (add sale window, see queue, manual override, pause automation toggle)

---

## 3. Guild & Grain marketplace

Treated as a separate Lovable project. When you're ready, start a new project and paste the original spec — it will live cleanly on its own without polluting DWA/M2.

---

## Files

**New:**
- `supabase/migrations/<ts>_etsy_shop_admin.sql` — `etsy_shop_edits`, `etsy_announcement_schedule`, `etsy_announcement_log`
- `supabase/functions/etsy-shop-get/index.ts`
- `supabase/functions/etsy-shop-update/index.ts`
- `supabase/functions/etsy-announcement-rotator/index.ts`
- `supabase/functions/etsy-announcement-on-publish/index.ts`
- `src/components/dwa-admin/EtsyShopAdmin.tsx`
- `src/components/dwa-admin/EtsyAnnouncementSchedule.tsx`

**Edited:**
- `src/pages/DWAAdmin.tsx` — add "Etsy Shop" tab
- `supabase/functions/printify-direct-publish/index.ts` — fire-and-forget call to `etsy-announcement-on-publish` after Etsy publish succeeds
- `supabase/config.toml` — register 4 new functions with `verify_jwt = false`

After approval I'll request the Etsy secrets if not already present, then build everything.