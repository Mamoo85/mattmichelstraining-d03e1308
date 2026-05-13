---
name: AI Pre-Flight Inventory Check
description: Before shipping any customer-facing page or lead magnet, verify the inventory table it depends on has rows above threshold; auto-backfill if not.
type: preference
---

# Rule: Inventory Pre-Flight Before Shipping

Before building OR shipping any customer-facing page, lead magnet, or product landing that reads from a database table:

1. **Query the inventory table** the page depends on (e.g. `hire_alert_candidates`, `mortgage_radar_leads`, `staffing_agency_prospects`, `trade_radar_leads`).
2. **If row count < the threshold in `inventory_watchlist.min_rows` for that product**:
   - DO NOT ship without first running the matching `backfill_function` (scanner / seeder / prospector).
   - OR add an explicit graceful empty-state UI ("we're warming up your data — first leads in 24h").
3. **Never assume the table has rows just because the schema exists.** The TechAlert lead-magnet failure (4 nursing rows for 6 months while shipping a public lead magnet) must be structurally impossible from now on.

## How to apply
- Page reads `select * from X` → check `select count(*) from X` first.
- If a watchlist row exists for the product, use its `min_rows` as the gate.
- If no watchlist row exists, ADD one to `inventory_watchlist` as part of the same change.

**Why:** Matt's frustration on 2026-05-12 was correct — Lovable shipped a healthcare staffing lead magnet on top of an effectively empty `hire_alert_candidates` table. Inventory Sentinel + this rule prevent recurrence.
