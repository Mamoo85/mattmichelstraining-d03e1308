

# Final Push to 100% — What's Left

## Current Scores After Last Fix

| Product | Score | Why Not 100% |
|---------|-------|-------------|
| **Contractor Leads (PPL)** | **95%** | Missing: aged-lead-downsell cron, fomo-mailer cron |
| **TechAlert** | **85%** | Missing: hire-alert-scanner cron, phantom-alert cron, trial-convert cron |
| **Dead Lead Reactivation** | **85%** | Missing: dead-lead-drip cron, dead-lead-daily-notifier cron, dead-lead-outreach-drip cron |
| **FieldDesk** | **95%** | No blockers — polish only |

## THE CRITICAL FINDING

**Zero automation crons exist for your 3 revenue engines.** The functions all work when called manually (I just tested them — all return 200), but NOTHING is scheduled to call them automatically. The previous cron migration (`20260413000000_fix_broken_crons.sql`) fixed the vault pattern for existing crons but never created the missing ones.

### Missing Crons (all must be created)

| Function | Schedule | Purpose |
|----------|----------|---------|
| `hire-alert-scanner` | Daily 11:00 UTC (7am ET) | Scan for candidates, send alerts |
| `hire-alert-phantom-alert` | Daily 12:30 UTC (8:30am ET) | FOMO notification to trialists |
| `hire-alert-trial-convert` | Daily 14:00 UTC (10am ET) | Convert expiring trials |
| `dead-lead-drip` | Daily 14:00 UTC (10am ET) | Send drip SMS to dead leads |
| `dead-lead-daily-notifier` | Daily 21:00 UTC (5pm ET) | SMS Matt daily digest |
| `dead-lead-outreach-drip` | Daily 16:00 UTC (noon ET) | Follow-up on prospected contractors |
| `contractor-fomo-mailer` | Daily 19:00 UTC (3pm ET) | Email contractors who missed leads |
| `contractor-aged-lead-downsell` | Daily 18:00 UTC (2pm ET) | Blast $15 aged leads |
| `dwa-operator` | Every 4h | Auto-pause bad campaigns, generate A/B copy |
| `dwa-closer` | Daily 18:00 UTC (2pm ET) | Personalized bundle pitches |

### What Else

1. **Clean up test trial client** — delete the `test-audit@example.com` row I just created during testing
2. **Verify contractor-lead-notify uses service_role** — cron uses anon key (line from cron query shows anon Bearer token). Should use vault service_role pattern like other fixed crons.

## After This Fix: 100%

All 4 products will have:
- Schema ✅ (verified — all columns exist)
- Edge functions ✅ (verified — all return 200)
- RLS ✅ (verified — anon INSERT on contractor_leads, service_role on everything else)
- Crons ✅ (will be created)
- Stripe checkout ✅ (verified — returns live Stripe URL)

## How to Test After Deploy

1. **PPL**: Submit a lead at `/get-quote/plumber/detroit` in incognito → verify it appears in admin
2. **TechAlert**: Wait for next 7am ET cron run, or invoke manually from admin sandbox → check `hire_alert_candidates` for new rows
3. **Dead Leads**: Create a campaign + contacts in admin → invoke `dead-lead-drip` manually → check SMS logs
4. **FieldDesk**: Already 95% — no test needed

## Files Changed

| File | Change |
|------|--------|
| New migration SQL | Create 10 missing crons using vault pattern + fix contractor-lead-notify to use vault service_role |
| Data cleanup | Delete test trial client row |

