

## Plan: Territory Generator v2 — Tracking, Bulk Mode, Expiry, Test, Confirmation

All 7 enhancements layered onto the existing `TerritoryLinkGenerator`, `prospect_nudges` table, public `/contractor-leads` page, and Stripe webhook. No breaking changes to existing flows.

---

### 1. Conversion tracking + Signups counter

**Migration** — add to `prospect_nudges`:
- `generated_by_admin boolean default false` — flags rows created from the admin generator
- `expires_at timestamptz null` — for one-time/24h expiry option
- `consumed_at timestamptz null` — set when a one-time link is used

`paid_at` already exists — that's our "signup completed" signal (set by Stripe webhook).

**Generator panel** — add a small stat strip at top:
- `Links generated: 12 · Clicked: 8 · Signed up: 3` — pulls counts from `prospect_nudges WHERE generated_by_admin = true` over last 30 days
- Auto-refreshes when a new link is generated

**Stripe webhook** (`stripe-webhook/index.ts`, `contractor_lead_subscription` handler) — on success, look up `prospect_nudges` by the `ref` token (already passed through Stripe metadata via the page) and set `paid_at = now()`. Wrap in try/catch so existing flow never breaks.

---

### 2. Better SMS / Apology drafts (`{customer_name}` placeholder)

Update both draft templates in `TerritoryLinkGenerator.tsx`:
- Always include trade label + city + `$<monthly>/mo` (already there but fragile when fields empty)
- Use `{customer_name}` literal placeholder when no name is entered, so Matt can search-and-replace before sending: `Hey {customer_name} — direct signup link...`
- Add expiry note when 24h option is enabled: `(Link expires in 24 hours.)`
- Currency consistently rendered as `$399/mo` or `$299/mo` based on selected trade

---

### 3. Territory list / bulk mode

Add a toggle: **[Single City] / [Bulk Cities]**

Bulk mode UI:
- Multi-line textarea: `Livonia, Redford, Westland` (comma or newline separated)
- One trade dropdown (applies to all)
- **[Generate All]** button → creates N `prospect_nudges` rows, one per city
- Output: a table with one row per city showing `City | Link | [Copy] [Copy SMS]`
- **[Copy All as List]** button → copies all links as a clean text block

---

### 4. One-time / 24h expiry option

In the generator:
- Checkbox: `☐ One-time use / expires in 24h`
- When checked, the new `prospect_nudges` row gets `expires_at = now() + 24h`
- `track-prospect-link` edge function — before redirecting:
  - If `expires_at` is in the past → redirect to `/contractor-leads?expired=1` (no preselect)
  - If `consumed_at` is already set → same expired redirect
  - Otherwise set `consumed_at = now()` (fire-and-forget) and proceed
- `ContractorLeads.tsx` — when `?expired=1`, show a small banner: `This signup link has expired. Pick your trade and city below to continue.`

Backward compatible: links without `expires_at` behave exactly as today.

---

### 5. "Test link" button

Add **[🔍 Test Link]** button next to Copy:
- Opens the generated URL in a new tab (no token consumption — uses a `?test=1` query so `track-prospect-link` skips the consume step)
- Actually, simpler: the deep link already works without a token. `Test Link` opens the bare `?trade=&city=` URL (no `ref` token) so the test never burns the real one-time link. Tooltip explains this.

---

### 6. Admin SMS inbox: one-tap "Copy correct signup link"

In `src/components/dwa-admin/AdminSMSInbox.tsx`:
- For threads matched to a `prospect_nudges` row (already shows trade/city context per the existing fix), add a **[🔗 Copy Signup Link]** button in the thread header
- Click → builds the deep link from the nudge's trade + city + phone + name and copies to clipboard
- Toast: `Signup link copied — Electrical, Livonia`
- For threads with no nudge match, button is disabled with tooltip: `No territory context — use Territory Generator`

---

### 7. Post-checkout confirmation page

`ContractorLeads.tsx` already shows a `success=1` state. Upgrade it:
- When `success=1&trade=Electrical&city=Livonia` is present, render a dedicated confirmation card:
  - **`✅ You're all set for Electrical — Livonia`**
  - Three next-action tiles:
    1. `📱 Save Matt's number: (313) 992-1219` (tap to call/text)
    2. `🔖 Bookmark your signup page: https://detroitwebagent.com/contractor-leads?trade=electrical&city=Livonia` with [Copy] button
    3. `📧 Check your email for the welcome guide`
  - Faint reminder: `First lead usually arrives within 3–7 days.`
- Mobile-first: stacks `grid-cols-1` under 640px

---

### Files touched

| File | Change |
|---|---|
| `supabase/migrations/<new>.sql` | Add `generated_by_admin`, `expires_at`, `consumed_at` to `prospect_nudges` |
| `src/components/dwa-admin/TerritoryLinkGenerator.tsx` | Stats strip, bulk mode toggle, expiry checkbox, Test button, `{customer_name}` placeholder, persists rows to `prospect_nudges` |
| `src/components/dwa-admin/AdminSMSInbox.tsx` | "Copy Signup Link" button on prospect threads |
| `src/pages/ContractorLeads.tsx` | Expanded success-state card, `?expired=1` banner |
| `supabase/functions/track-prospect-link/index.ts` | Honor `expires_at` + `consumed_at` |
| `supabase/functions/stripe-webhook/index.ts` | Set `paid_at` on `prospect_nudges` when `contractor_lead_subscription` completes (best-effort) |

No new secrets. No Stripe product changes. All changes are additive / backward compatible.

---

### Acceptance test

1. Open generator → see `Links: 0 · Clicked: 0 · Signed up: 0`
2. Pick Electrical + Livonia, check expiry box, click Generate → row appears in `prospect_nudges` with `expires_at` and `generated_by_admin = true`
3. Click [Test Link] → opens new tab, dropdowns preselect, no token consumed
4. Click [Copy] and open the real link in incognito → page loads with banner; refresh → "expired" banner shows
5. Switch to Bulk mode, paste `Livonia, Redford, Westland`, hit Generate All → 3 rows + 3 links
6. Complete a real Stripe checkout via a generated link → `paid_at` populates → counter shows `Signed up: 1`
7. After payment, success page shows `You're all set for Electrical — Livonia` with bookmark link
8. In SMS inbox, prospect thread shows [Copy Signup Link] → click copies correct deep link

