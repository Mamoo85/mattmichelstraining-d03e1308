

# Plan: Admin Outreach, SEO Pages, GBP Posts & Dashboard Referral Card

## Pre-requisites & Blockers

**ANTHROPIC_API_KEY is missing.** The `generate-seo-page` edge function and GBP post generator both need this secret. I'll need to request it before the edge function will work. The GBP post generator should also use an edge function (not client-side fetch) to avoid exposing the API key in the browser.

**`seo_landing_pages` table already exists** — the migration for it will be skipped. There is also an existing `AdminSeoGenerator` component and `generate-seo-pages` edge function. The new "SEO Pages" tab will be integrated alongside the existing SEO Engine or replace it with the requested features.

---

## Database Migrations

1. **Create `outreach_leads` table** with industry/status check constraints, RLS policy restricted to Matt's email
2. **Add `referral_count` column** to `profiles` (integer, default 0)
3. **Skip `seo_landing_pages`** — already exists with public read + trainer write policies

---

## New Files

### `src/components/admin/AdminOutreach.tsx`
- Stats row: Total Leads, Emails Sent, Response Rate, MRR ($49 × Closed)
- "Add Lead" Sheet with form fields (Business Name*, Owner, City, Industry select, Phone, Email, Website Status select, Notes)
- Leads table with filter dropdowns (Industry, Status)
- Status badge cycling (New→Emailed→Responded→Closed→Lost) with optimistic update via React Query
- "Copy Email" button with industry/website_status-based cold email templates
- Delete button with confirm dialog
- All data from `outreach_leads` table

### `src/components/admin/AdminGbpPosts.tsx`
- Sub-switcher: "M² Training" | "Web Design"
- "Generate This Month's Posts" button calls a new edge function
- Displays 4 cards (2×2 grid) with week label, title, body, CTA, copy button
- Parses JSON response, error toast on failure

### `supabase/functions/generate-seo-page/index.ts`
- Accepts `{ slug, keyword, location, service_type }`
- Calls Lovable AI Gateway (not Anthropic directly — no API key needed) to generate HTML content
- Upserts into `seo_landing_pages`
- CORS headers included

### `supabase/functions/generate-gbp-posts/index.ts`
- Accepts `{ mode: "training" | "webdesign" }`
- Calls Lovable AI Gateway with the specified system prompts
- Returns JSON array of 4 posts
- Keeps API key server-side (secure)

---

## Modified Files

### `src/pages/Admin.tsx`
- Add new master tab "Growth" (or add Outreach/GBP as sub-tabs under existing tabs)
- Actually: add a 5th master tab `{ key: "growth", label: "Growth", icon: Megaphone, desc: "Outreach · SEO · GBP" }`
- Sub-tabs: Outreach, SEO Pages (existing AdminSeoGenerator enhanced with bulk generate), GBP Posts
- Lazy-load all 3 new components

### `src/pages/Dashboard.tsx`
- Add a `ReferralCard` component between the tab content sections (in DashboardHome)
- Shows referral link using `user.id`, copy button, referral_count from profiles

### `src/components/dashboard/DashboardHome.tsx`
- Import and render a new `DashboardReferralCard` component
- Fetches `referral_count` from profiles where `user_id = user.id`
- Displays copy-link UI with "Copied ✓" feedback

---

## Technical Details

| Aspect | Decision |
|--------|----------|
| AI calls | Use Lovable AI Gateway (no Anthropic key needed) via edge functions |
| Cold email templates | Stored as template strings in AdminOutreach, interpolated with row data |
| Optimistic updates | React Query `onMutate` for status cycling |
| Bulk SEO generate | Sequential requests with progress indicator |
| GBP posts | Edge function returns JSON array, parsed client-side |
| Referral link | `https://mattmichelstraining.com?ref={user.id}` |

---

## Files Summary

| File | Action |
|------|--------|
| Migration SQL | Create `outreach_leads`, add `referral_count` to profiles |
| `src/components/admin/AdminOutreach.tsx` | **New** — full outreach CRM tab |
| `src/components/admin/AdminGbpPosts.tsx` | **New** — GBP post generator |
| `supabase/functions/generate-seo-page/index.ts` | **New** — SEO page generator edge function |
| `supabase/functions/generate-gbp-posts/index.ts` | **New** — GBP posts edge function |
| `src/pages/Admin.tsx` | **Edit** — add Growth master tab with 3 sub-tabs |
| `src/components/dashboard/DashboardHome.tsx` | **Edit** — add referral card |

