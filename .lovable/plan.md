## Why nothing loads + frame is small

Every `/my-*` portal is gated by either `?email=` (FieldDesk, Demand Radar, Mortgage Radar) or `?token=` against a `dashboard_token` / `dispatch_token` column (SiteRadar, Buyer Radar, Missed-Call, TechAlert). The "My Command Center" admin tab iframes those routes with **no query string**, so every one returns "No email in URL" / "Invalid or expired link." On top of that, Matt isn't actually rowed into several of the client tables yet, so even a correct token would 404.

The frame is small because the iframe sits inside the admin shell with `h-[calc(100vh-3.5rem)]` minus the toolbar — about 55% of the screen.

## Plan — 3 fixes, one pass

### 1. Enroll Matt in every product (one migration)

Idempotent UPSERT into every `*_clients` table with a deterministic shared token so the Command Center can pass it without lookup:

- `trade_radar_clients` — all 11 verticals (re-affirm Phase 31 enrollment, set `dashboard_token = 'matt-cmd-center-dwa'`)
- `mortgage_radar_clients`
- `hire_alert_clients` (TechAlert)
- `field_crm_clients` (covers FieldDesk **and** SiteRadar — needs `dispatch_token`, `visitor_script_key`, `email = matt@detroitwebagent.com`)
- `missed_call_clients` (`dashboard_token`)
- `industry_pulse_clients` × 3 rows (`buyer_type` = contractor / supplier / growth — covers Demand Radar, Buyer Radar, Growth Radar)
- `contractor_clients` (Contractor Leads + Dead Lead Reactivation)
- `dead_lead_campaigns` linked to Matt's contractor row

All tokens set to the same string `matt-cmd-center-dwa` for simplicity (admin-only, gated by `has_role` so safe). Status = active, trial_status = founders, ZIP coverage = SE Michigan.

### 2. Rewrite `MyCommandCenter.tsx` to actually pass auth

- Each `PRODUCTS` entry gets **two** paths:
  - `customerPath` — current `/my-*` URL **with** `?email=matt@detroitwebagent.com&token=matt-cmd-center-dwa` appended
  - `prospectPath` — the public marketing/landing URL (`/field-service`, `/mortgage-radar`, `/hire-alert`, `/site-radar`, `/contractor-leads`, etc.)
- Add a **View mode** toggle in the toolbar: `👤 Customer view` ↔ `🎯 Prospect view` — flips the iframe `src` to either path
- This gives Matt one place to QA every product as both a paying customer **and** a cold visitor

### 3. Make the frame much bigger

- Add a **⛶ Maximize** button next to "Open standalone"
- When maximized, render the iframe in a portal `<Dialog>` that covers the whole viewport (escapes the admin shell sidebar entirely)
- Default unmaximized: bump iframe min-height to `calc(100vh - 9rem)` and let the toolbar collapse into a single row when product is selected (saves ~80px), so the iframe is ~85% of screen instead of ~55%
- Persist preferred mode + maximized state in localStorage

### 4. Verify

After Lovable applies the migration: open Command Center → click each of the 23 product pills in both Customer and Prospect mode → confirm none show "Access denied" / "Invalid or expired link" / "No email in URL." Report back any portal that still gates incorrectly so we can patch its specific check.

## Files

```
+ supabase/migrations/YYYYMMDD_matt_full_enrollment_command_center.sql
~ src/components/dwa-admin/MyCommandCenter.tsx
```

## Notes

- The shared `matt-cmd-center-dwa` token is safe because the entire `/dwa-admin` route is already gated by `AgencyAdminRoute` — only authenticated admins ever see this page.
- If you'd rather NOT share a token across products, I can generate per-product UUIDs and embed them in the Command Center file directly. The single-token approach is just less code.
- Some portals (Talent Radar, Counsel Search, Add-ons, Team) use auth session instead of token — those already work for Matt; they'll keep working unchanged.
