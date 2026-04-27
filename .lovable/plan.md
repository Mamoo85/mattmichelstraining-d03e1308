## Why "Failed to send a request to the Edge Function"

The SMS Sniper / Fax / Postcard tabs all call the `channel-prospector` edge function. Two problems:

1. **Function is not deployed.** `supabase--edge_function_logs` returns *zero* logs for `channel-prospector` — meaning Lovable never deployed it (likely because it was created without a `config.toml` entry, so the deploy pipeline skipped it).
2. **No `[functions.channel-prospector]` block in `supabase/config.toml`.** Compare with `contractor-prospector` which has `verify_jwt = false`. Without this entry, even once deployed, calls would 401 because the auto-default flips JWT verification on for unregistered functions in this project.

That combo = "Failed to send a request to the Edge Function" in the browser before the function ever runs. D

## Why the search parameters are so small

Looking at `supabase/functions/channel-prospector/index.ts`:


| Bottleneck                      | Current                                    | Effect                                            |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| `CAPS.sms`                      | 30/day                                     | Hard ceiling — even a perfect run = max 30        |
| Per-run loop                    | `places.slice(0, Math.min(15, remaining))` | Only 15 sends per click                           |
| Single Google Places query      | 1 call → ~20 raw results                   | 80% drop after dedupe + missing-phone filter      |
| `DEFAULT_CITIES`                | 6 Metro Detroit suburbs                    | Same exhausted pool every run                     |
| `DEFAULT_TRADES`                | 4 trades                                   | Hits "already pitched" wall fast                  |
| `todaysCombo()`                 | One trade × one city per day               | Zero fan-out                                      |
| Per-place skip if no `+1` phone | Hard skip                                  | We never try a fallback Google Place phone format |


So a typical SMS Sniper click = 1 query → 20 results → 10 already in DB → 8 with no clean phone → **0–2 sends**.

## Fix Plan

### 1. Deploy + register the function

- Add `[functions.channel-prospector]` with `verify_jwt = false` to `supabase/config.toml` (matches `contractor-prospector` pattern).
- Add admin-role check inside the function (mirror the `outreach-gmail-send` pattern) so it stays secure even with JWT off.
- Force redeploy of `channel-prospector`.

### 2. Statewide Michigan coverage

Replace `DEFAULT_CITIES` (6 cities) and the UI dropdown `CITIES` (8 cities) with the **same 56-city Michigan list** already used by `contractor-prospector` / `AdminDeadLeads`:
Detroit, Warren, Sterling Heights, Troy, Livonia, Dearborn, Royal Oak, St. Clair Shores, Macomb, Ferndale, Southfield, Farmington Hills, Novi, Rochester Hills, Pontiac, Auburn Hills, Birmingham, Bloomfield Hills, Canton, Westland, Taylor, Wyandotte, Monroe, Ann Arbor, Ypsilanti, Saline, Brighton, Howell, Lansing, East Lansing, Okemos, Jackson, Kalamazoo, Battle Creek, Portage, Grand Rapids, Wyoming, Kentwood, Holland, Muskegon, Grand Haven, Saugatuck, Flint, Burton, Saginaw, Bay City, Midland, Mt. Pleasant, Traverse City, Petoskey, Cadillac, Alpena, Marquette, Sault Ste. Marie, Escanaba, Grosse Pointe.

Add **"🌎 All Michigan (auto-rotate)"** as a UI option that triggers the multi-city fan-out.

### 3. Massively scale per-run output

In `channel-prospector/index.ts`:


| Constant                | Old                  | New                                 |
| ----------------------- | -------------------- | ----------------------------------- |
| `CAPS.sms`              | 30                   | **150**                             |
| `CAPS.fax`              | 20                   | **80**                              |
| `CAPS.postcard`         | 25                   | **80**                              |
| Per-run cap             | `min(15, remaining)` | `min(50, remaining)`                |
| Google Places per query | 1 query × 20 results | **multi-query fan-out** (see below) |


### 4. Multi-query fan-out (the real yield unlock)

Google Places caps at 20 results per text-search call. So instead of one call, we run **multiple in parallel**:

- **Specific trade + specific city** → expand to 3–4 trade synonyms ("plumber Troy MI", "plumbing service Troy MI", "drain cleaning Troy MI", "emergency plumber Troy MI") = ~80 raw candidates.
- **Specific trade + "All Michigan"** → run that trade across **8 randomly rotated cities** in one invocation = ~160 raw candidates.
- **Auto-rotate trade + Auto-rotate city** → today's trade × 8 random MI cities = ~160 raw candidates.

Run queries with `Promise.all()` in batches of 4 to stay under the 50 s soft timeout. Dedupe by `place_id`, then send up to 50 per run.

Add `TRADE_QUERY_VARIANTS` (mirror the one in `contractor-prospector`):

- HVAC → ["HVAC contractor", "heating and cooling", "AC repair", "furnace repair"]
- plumber → ["plumber", "plumbing service", "drain cleaning", "emergency plumber"]
- roofer → ["roofer", "roofing contractor", "roof repair", "roof replacement"]
- electrician → ["electrician", "electrical contractor", "electrical repair"]

### 5. Smarter dedupe (yield boost)

- Currently any business previously pitched on the same channel is permanently skipped. **Loosen to 90-day window** — allow re-pitch if `last_contact_date` is older than 90 days.
- For SMS specifically: when Google Places phone is missing, fall back to scraping the website (we already have `scrapeFax` — generalize to `scrapePhone` too).

### 6. UI feedback (`ChannelOutreachTab.tsx`)

- Show which cities were rotated in the last-run panel: "8 cities scanned: Detroit, Ann Arbor, Lansing…"
- Update cap displays from "30/day" → live channel cap.
- Update subtitle text in `AdminSMSOutreach.tsx` (and Fax/Postcard equivalents) to reflect new caps.

## Files Changed

**Edited only — no new tables, no migrations, no new functions:**

- `supabase/config.toml` — add `[functions.channel-prospector]` with `verify_jwt = false`
- `supabase/functions/channel-prospector/index.ts` — caps, statewide cities, trade variants, multi-query fan-out, 90-day re-pitch, phone-scrape fallback, admin role check
- `src/components/admin/ChannelOutreachTab.tsx` — 56-city dropdown + "All Michigan", richer last-run feedback
- `src/components/admin/AdminSMSOutreach.tsx`, `AdminFaxOutreach.tsx`, `AdminPostcardOutreach.tsx` — updated subtitle/cap props

## Expected Outcome


| Metric                 | Before                 | After                   |
| ---------------------- | ---------------------- | ----------------------- |
| Per-click sends        | 0–2                    | **20–50**               |
| Daily SMS ceiling      | 30                     | **150**                 |
| City coverage          | 6 Detroit suburbs      | **All 56 MI cities**    |
| Raw candidates per run | ~20                    | **~160**                |
| Edge function status   | Not deployed (failing) | Deployed + auth-checked |


Approve to ship.