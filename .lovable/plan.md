

## Plan: Territory Deep-Link Generator + Contractor Signup Fix

Two-part build: (1) fix the public `/contractor-leads` page so a deep link auto-selects trade + city, (2) give admin a one-tap "Generate Signup Link" tool so Matt can text the right URL in 3 seconds.

---

### Part 1 — Public page accepts deep links

**File:** `src/pages/ContractorLeads.tsx`

- Replace the static "Metro Detroit" hero with a **Profession** + **Territory** dropdown pair driving the signup form.
- On mount, read URL params:
  - `?trade=electrical&city=Livonia` → preselect both dropdowns, swap heading to `Claim Electrical leads in Livonia, MI`, scroll to form.
  - Optional `&prefilled_email=`, `&name=`, `&business_name=`, `&phone=` → prefill form.
  - Optional `&ref=<token>` → pass through to checkout metadata for click attribution.
- Form submits the **selected** `trade` + `city` + `state` to `create-contractor-checkout` (no more hardcoded "Metro Detroit").
- Shows a clear banner above the form when params are present: `You're signing up for: Electrical — Livonia, MI`.

---

### Part 2 — Admin "Territory Link Generator" panel

**File:** `src/components/dwa-admin/AdminContractorLeads.tsx` (existing) — add a new card at the top: **🔗 Territory Signup Link Generator**

UI:
- **Trade** dropdown — Electrical, HVAC, Plumbing, Roofing, Gutters, Siding (matches `create-contractor-checkout` price map)
- **City** input with autocomplete from existing `contractor_lead_sites` rows (Livonia, Royal Oak, etc.) — also accepts free text for new cities
- **Optional**: prospect name, business name, email, phone (for prefill)
- **[🔗 Generate Link]** button → builds: `https://detroitwebagent.com/contractor-leads?trade=electrical&city=Livonia&prefilled_email=...`
- **[📋 Copy]** button — copies to clipboard
- **[📱 Copy SMS Draft]** button — copies a ready-to-paste text:
  > `Hey [name] — direct signup link for the Livonia electrical territory: https://... (Electrical + Livonia preselected, $399/mo, cancel anytime). — Matt`
- **[📧 Copy Apology Draft]** button — second variant for the "sorry I sent the wrong link" message
- Shows price badge live (`$399/mo` or `$299/mo` for Gutters/Siding) so Matt knows what he's quoting

**Persistence (optional, lightweight):** log each generated link to existing `prospect_nudges` table (already has `link_token`, `trade`, `city` columns) so click-throughs land in admin SMS context per the existing `track-prospect-link` flow. No schema change needed.

---

### Part 3 — Tracked-link redirect fix (one small edge function tweak)

**File:** `supabase/functions/track-prospect-link/index.ts`

Currently always redirects to bare `/contractor-leads`. Update to:
- Look up the `prospect_nudges` row by `link_token`
- If row has `trade` + `city`, redirect to `/contractor-leads?trade=<trade>&city=<city>&ref=<token>`
- Otherwise fall back to current generic redirect (no breakage for legacy links)
- Keep the existing `clicked_at` update and fail-open behavior

---

### Part 4 — Checkout server-side guard (no behavior change for valid inputs)

**File:** `supabase/functions/create-contractor-checkout/index.ts`

- Already normalizes trade and looks up trade-specific pricing — only addition: validate that `trade` is in the known set (Electrical, HVAC, Plumbing, Roofing, Gutters, Siding) and `city` is non-empty before creating Stripe session. Returns 400 with clear message if invalid.
- Stripe product title already uses `Exclusive ${tradeLabel} Leads — ${city}, ${state}` — no change, just confirms it now reflects the real selected territory.

---

### What stays the same (no risk)

- Stripe price map, webhook handlers, `contractor_clients` upsert logic — untouched
- Existing generic `/contractor-leads` visits without query params still work (dropdowns just show empty, user picks manually)
- `prospect_nudges`, `track-prospect-link` table schema unchanged
- Admin SMS inbox, all other admin tabs, all other DWA products untouched
- Lead notification flow (`contractor-lead-notify`) untouched
- Mobile-first layout preserved (under 396px the dropdowns + form stack `grid-cols-1`)

---

### Files touched

| File | Change |
|---|---|
| `src/pages/ContractorLeads.tsx` | Add trade/city dropdowns, URL param parsing, banner, prefill |
| `src/components/dwa-admin/AdminContractorLeads.tsx` | Add Territory Link Generator card at top |
| `supabase/functions/track-prospect-link/index.ts` | Resolve trade/city from `prospect_nudges` and append to redirect |
| `supabase/functions/create-contractor-checkout/index.ts` | Add trade/city validation guard |

No migration. No new tables. No new secrets. No Stripe product changes.

---

### Acceptance test

1. In `/dwa-admin → Contractor Leads`, pick `Electrical` + `Livonia`, hit Generate → get `https://detroitwebagent.com/contractor-leads?trade=electrical&city=Livonia`
2. Open that link in a new tab → page shows `Claim Electrical leads in Livonia, MI`, dropdowns preselected, $399/mo price visible
3. Submit form with test email → Stripe checkout title reads `Exclusive Electrical Leads — Livonia, MI`
4. Existing `/contractor-leads` link with no params still loads (dropdowns empty, manual select works)
5. Send the apology SMS draft to the electrician

