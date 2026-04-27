## Goal

Scale the Dead Lead Reactivation prospector from ~1–2 emails/run to **20–50/run**, expand search coverage from 11 Metro Detroit cities to **all of Michigan**, and remove the bottlenecks that cause "20 found · 10 skipped · 0 emailed" runs.

## Why the current run only emailed 0–2

Audit of `supabase/functions/contractor-prospector/index.ts`:

1. **Daily cap = 30 total emails** (`DAILY_SEND_CAP = 30`), of which only **5** can be dead-lead pitches (`DEAD_LEAD_CAP = 5`). That alone caps us at 5 dead-lead emails per day no matter how many prospects we find.
2. **Per-run send cap is hardcoded to 15** (`maxToSend = Math.min(15, remainingCap)`).
3. **Google Places fetches only 20 results per query** (`maxResultCount: 20`) → after dedupe + AI rejection, often nets 0–2 new prospects.
4. **Manual run uses one combo only** — when you pick "HVAC contractor / Troy MI", it searches that single string once and stops.
5. **City list = 11 Metro Detroit ZIPs** in both the edge function (`CITIES`) and the UI dropdown (`PROSPECT_CITIES`).
6. The "10 already in DB" skip is real — small city pool means we burn through fresh businesses fast.

## Plan

### 1. Statewide city coverage (50+ Michigan cities)

Replace the 11-city Metro Detroit list in **both**:
- `supabase/functions/contractor-prospector/index.ts` → `CITIES` constant
- `src/components/admin/AdminDeadLeads.tsx` → `PROSPECT_CITIES`

New list grouped by region (Metro Detroit, West MI, Mid-MI, Northern MI, UP):
Detroit, Grosse Pointe, Warren, Sterling Heights, Troy, Livonia, Dearborn, Royal Oak, St. Clair Shores, Macomb, Ferndale, Southfield, Farmington Hills, Novi, Rochester Hills, Pontiac, Auburn Hills, Birmingham, Bloomfield Hills, Canton, Westland, Taylor, Wyandotte, Monroe, Ann Arbor, Ypsilanti, Saline, Brighton, Howell, Lansing, East Lansing, Okemos, Jackson, Kalamazoo, Battle Creek, Portage, Grand Rapids, Wyoming, Kentwood, Holland, Muskegon, Grand Haven, Saugatuck, Flint, Burton, Saginaw, Bay City, Midland, Mt. Pleasant, Traverse City, Petoskey, Cadillac, Alpena, Marquette, Sault Ste. Marie, Escanaba.

Add an **"All Michigan (auto-rotate)"** option in the UI city dropdown — picks 8 random cities per run.

### 2. Bigger per-run scale

In `contractor-prospector/index.ts`:

| Constant | Old | New |
|---|---|---|
| `DAILY_SEND_CAP` | 30 | **150** |
| `DEAD_LEAD_CAP` | 5 | **50** |
| `TECH_ALERT_CAP` | 5 | 20 |
| `MISSED_CALL_CAP` | 5 | 20 |
| `maxToSend` per run | `min(15, remaining)` | `min(50, remaining)` |
| Google Places `maxResultCount` | 20 | **20 (max allowed by API) — but loop multiple queries** |

Google Places caps at 20 per call, so to get more candidates we run **multiple queries per run**:
- When user picks a single trade+city → expand to 4 query variants ("HVAC contractor in Troy MI", "heating and cooling Troy MI", "AC repair Troy MI", "furnace repair Troy MI") = ~80 raw candidates instead of 20.
- When user picks "All Michigan" → run the chosen trade across **8 rotated cities** in one invocation = ~160 raw candidates.
- Keep the 50 s soft timeout — process queries in parallel batches of 4 with `Promise.all`.

### 3. Smarter dedupe & yield

- The "already in DB" filter currently rejects any business previously contacted by ANY pitch. Loosen for dead-lead pitch: allow re-pitch if last contact was >90 days ago.
- Lower the email-found bar: when site scrape returns no email, fall back to the existing enrichment waterfall (Snov → Hunter → pattern-guess `info@domain`) inline before skipping. (Today the prospector skips if no email scraped; enrichment runs later out-of-band.)

### 4. UI feedback

- Show city + trade in the result line: "Last run: 23 emailed · 142 found · 8 cities scanned".
- When "All Michigan" is selected, show the 8 cities that were rotated.
- Keep daily-cap progress bar so you know when you're approaching the new 150/day ceiling.

## Files

**Edited:**
- `supabase/functions/contractor-prospector/index.ts` — caps, city list, multi-query expansion, inline enrichment fallback, 90-day re-pitch window
- `src/components/admin/AdminDeadLeads.tsx` — statewide city dropdown + "All Michigan" option, larger result display

**No new tables, no new functions, no migrations.** Pure config + logic expansion in existing files.

## Expected outcome

- Single run targeting "HVAC contractor / All Michigan" → ~80–160 raw candidates → 20–50 emails sent (vs 0–2 today).
- Daily ceiling 150 emails (vs 30) — enough headroom for 3–5 manual runs per day.
- Coverage: every metro in Michigan, not just Detroit suburbs.
