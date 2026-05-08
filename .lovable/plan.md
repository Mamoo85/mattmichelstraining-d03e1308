## The two questions, answered

**1. Does AmeriSteel use 4–5 dashboards today?**
Yes. Right now `start-multi-product-trial` provisions them in 5 products (TechAlert, Demand Radar, Buyer Radar, Industry Pulse, Mortgage Radar) and returns 5 separate magic links — one per `My*` page. There is **no unified hub** in the codebase. They'd be juggling 5 tabs.

**2. The 46 stub sources** — they live in `supabase/functions/_shared/talent-signals/extras-100.ts` as functions that all `return []`. They are not silently broken, just unbuilt. You'd never know when they're "ready" because there's no signal — that's what we'll fix.

---

## Plan: Unified Trial Hub (zero risk to existing portals)

**New page only — no edits to `MyTechAlert`, `MyBuyerRadar`, `MyDemandRadar`, `MyIndustryPulse`, or `MyMortgageRadar`.**

### Part A — `/hub/:token` Trial Hub page

A single dashboard at `https://detroitwebagent.com/hub/<token>` showing all of a prospect's trials in one place.

```text
┌─ AmeriSteel — Active Trials (4 days left) ──────────┐
│  [TechAlert]  3 candidates    → Open full dashboard │
│  [Demand]     12 RFP signals  → Open full dashboard │
│  [Buyer]      5 supplier ops  → Open full dashboard │
│  [Pulse]      8 industry hits → Open full dashboard │
│  [Mortgage]   —               → Open full dashboard │
└──────────────────────────────────────────────────────┘
```

Each tile shows: product name, live count of new items in last 7d, "Open full dashboard" button that deep-links to the existing `My*` page with their existing magic token. Existing portals remain untouched and continue to work standalone.

### Part B — Backend (additive only)

1. **Migration** — new `trial_bundles` table:
   - `bundle_token` (uuid, public-readable via token), `email`, `company_name`, `product_tokens jsonb` (e.g. `{techalert: "abc", demand: "def", ...}`), `expires_at`
   - RLS: anon SELECT only when token matches URL param.
2. **`start-multi-product-trial`** — extend to also insert one `trial_bundles` row collecting all sub-tokens, return a single `hub_url`.
3. **`hub-summary`** edge function — given bundle_token, fans out parallel reads against each product's leads table (count of last-7d rows) and returns the tile data. Read-only. Cannot break anything.

### Part C — AmeriSteel page

`AmeriSteelTrials.tsx` — after submission, show the **single hub link** as the primary CTA, with the 5 individual links collapsed under "Direct links to each tool" disclosure. You send one URL; he clicks through to whichever tool he wants.

---

## Plan: Stub source visibility (so you don't have to remember)

The 46 stubs in `extras-100.ts` are just functions returning `[]`. The fix is making the system **tell you** when each is buildable.

### Add `source_registry` table + admin tile

1. **Migration** — `source_registry` table with rows for all 50 talent sources:
   - `key`, `name`, `category`, `status` (`live` | `stub` | `blocked` | `needs_key`), `blocker` (text — e.g. "needs LinkedIn API key", "endpoint TBD"), `last_attempted_at`, `last_result_count`
   - Seed all 50 rows; the 4 live ones marked `live`, the 46 stubs marked `stub` with a one-line blocker reason.
2. **Weekly cron `source-registry-probe`** — for each stub source, attempts a tiny test fetch and records what it would need (API key missing? endpoint 404? CAPTCHA?). Updates `blocker` text.
3. **Admin tile in `DWAAdmin` → "Data Sources Health"** — table view sorted by status. You'll see at a glance:
   ```
   ✅ Live (4):   NPI, Craigslist, Reddit trades, MI WARN
   🟡 Ready to wire (X):  needs 30min coding, no blockers
   🔑 Needs secret (Y):   needs API key — list of which keys
   ❌ Blocked (Z):        scrape blocked / endpoint dead
   ```
4. **Weekly Monday SMS to you** (extends existing `weekly-admin-digest`):
   `"Sources update: 3 stubs are now ready to wire. Reply 'WIRE' to have Claude do it."`

That way you literally never have to remember — the system pings you when sources move from stub → ready.

---

## What I will NOT touch

- `MyTechAlert.tsx`, `MyBuyerRadar.tsx`, `MyDemandRadar.tsx`, `MyIndustryPulse.tsx`, `MyMortgageRadar.tsx` — zero edits
- `LeadDetailDrawer.tsx`, scanners, `techalert-prospect-hunter`, all working scanners
- Existing magic-link auth flow

The hub is purely additive: new route, new table, new edge function, new admin tile.

---

## Files (new only)

- `src/pages/TrialHub.tsx` (new)
- `src/components/hub/HubTile.tsx` (new)
- `src/pages/admin/DataSourcesHealth.tsx` (new tab in DWAAdmin)
- `supabase/functions/hub-summary/index.ts` (new)
- `supabase/functions/source-registry-probe/index.ts` (new)
- Migrations: `trial_bundles` table, `source_registry` table + seed
- Edits: `start-multi-product-trial/index.ts` (add bundle row), `AmeriSteelTrials.tsx` (show hub link first), `weekly-admin-digest/index.ts` (append sources section), `App.tsx` (add `/hub/:token` route)

Ship in 2 PRs: Hub first (immediate win for AmeriSteel), Source Registry second.
