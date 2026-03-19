

## Predictive Churn Radar — Retention Guardian

### What We're Building
A daily automated system that identifies at-risk clients based on logging velocity drop-off, saves alerts to a `retention_alerts` table, and surfaces them in a new "High-Risk Clients" widget on the Admin Roster tab with one-click outreach.

### Database Changes (Migration)

**New table: `retention_alerts`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid (refs profiles.user_id) | |
| `alert_type` | text | e.g. `velocity_drop`, `inactive` |
| `avg_weekly_logs` | numeric | Historical average |
| `days_since_last_log` | integer | |
| `status` | text | `active`, `dismissed`, `contacted` |
| `created_at` | timestamptz | |
| `resolved_at` | timestamptz | null until dismissed/contacted |

RLS: admin-only read/update via `has_role()`.

### Edge Function: `churn-radar`
- Scheduled via pg_cron every 24 hours
- Auth: service-role key only
- Logic:
  1. Query all users with `subscription_tier` != 'basic' (paying users)
  2. For each, calculate avg logs/week over last 30 days from `progress_logs` + `workout_logs`
  3. Count logs in last 7 days
  4. Flag if: avg ≥ 3/week historically AND 0 logs in last 7 days
  5. Upsert into `retention_alerts` (avoid duplicates for same user if already active)

Note: Since there's no `last_active_at` column tracked, we'll use "last log date" as the activity proxy (covers the "hasn't opened the app in 10 days" intent).

### Admin Widget: `AdminChurnRadar.tsx`
- Queries `retention_alerts` where `status = 'active'`, joined with `profiles` for name/email/tier
- Shows a card per flagged user: name, tier badge, days since last log, historical avg
- Two action buttons per card:
  - **"Send Check-In"** — opens a pre-drafted message: *"Hey [Name], noticed you've been quiet this week. Everything good with the programming?"* via the existing Direct Messages system (inserts into `direct_messages` table)
  - **"Dismiss"** — marks alert as `dismissed`
- Placed in the Roster tab as a new sub-tab "Churn Radar"

### Files

| File | Action |
|---|---|
| `supabase/functions/churn-radar/index.ts` | **Create** — Daily watchdog edge function |
| `src/components/admin/AdminChurnRadar.tsx` | **Create** — High-risk clients widget |
| `src/pages/Admin.tsx` | **Edit** — Add "Churn Radar" sub-tab to Roster |
| `supabase/config.toml` | **Edit** — Add `verify_jwt = false` for churn-radar |
| Migration | Create `retention_alerts` table + RLS policies |
| pg_cron SQL | Schedule daily invocation |

