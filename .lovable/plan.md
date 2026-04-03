

# Fix 20 Admin & Site Issues — Implementation Plan

## Issues Identified from Screenshots & Code Review

### 1. Wrong Pricing Sitewide
**Problem**: Prices in `AdminSandbox.tsx` (sandbox test panel), `AdminOpsCenter.tsx` (ops center), `AdminClientHealth.tsx`, and customer-facing pages are inconsistent with your latest pricing strategy.
**Fix**: Update all hardcoded price arrays in these 4 admin components plus customer-facing pages to match your latest pricing. Will audit all files containing `priceNum` or price strings.

### 2. Products Still Showing That Shouldn't Be (Contractor Leads, AI Chatbot, Missed Call)
**Problem**: Contractor Leads ($399/mo) and AI Chatbot ($79/mo) are listed as active sellable products. Missed Call should be admin-only.
**Fix**: Remove Contractor Leads and AI Chatbot from public-facing sandbox and sales pages. Move Missed Call Text to admin-only visibility. Keep them in the admin ops center for tracking but gate them behind a "Coming Soon" or waitlist pattern.

### 3. Real Estate Demo 404
**Problem**: `/demo-real-estate` route exists in `App.tsx` pointing to `RealEstateMockup`. The 404 screenshot suggests either the component crashes or the path isn't in the hidden nav paths. The `AdminDemoLinkGenerator` links to this path.
**Fix**: Verify `RealEstateMockup.tsx` renders without crashing. Add `/demo-real-estate` to the `HIDDEN_PATHS` array in `BottomTabBar.tsx` so the bottom nav doesn't interfere.

### 4. Competitive Battlecard Send Mail Button Not Working
**Problem**: The "send" button on the client roster card for Competitive Battlecard likely calls `battlecard-sender` edge function which either doesn't exist as deployed or has no send route from the admin panel.
**Fix**: Wire the send/mail icon button in `AdminOpsCenter.tsx` to invoke `battlecard-sender` edge function, or if the function isn't deployed, add it to the deployment queue. The send icon currently opens a `mailto:` link — will verify and fix.

### 5. Social Media Client Setup Refresh Button
**Problem**: The Refresh button on `AdminSocialMediaOnboarding.tsx` may not be triggering a re-fetch.
**Fix**: Ensure the refresh button calls `queryClient.invalidateQueries()` for the correct query key.

### 6. Failed Migration: `20260331000001_seo_page_configs` — Syntax Error at "NOT"
**Problem**: Two migrations create the same `seo_page_configs` table — `20260331000001_seo_page_configs.sql` and `20260331235812_...sql`. The duplicate causes a syntax error when the second tries to create policies/constraints that already exist.
**Fix**: Delete the duplicate migration file `20260331000001_seo_page_configs.sql` (the older one). The newer migration `20260331235812_...sql` already has `IF NOT EXISTS` guards.

### 7. Newsletter Generation Failed ("Edge Function returned non-2xx")
**Problem**: `generate-newsletter/index.ts` uses `userClient.auth.getClaims(token)` — this method does NOT exist in the Supabase JS client. It should use `getUser()` instead.
**Fix**: Replace the auth verification in `generate-newsletter` to use `supabase.auth.getUser(token)` and extract the user ID from the result. This is why it returns a non-2xx status.

### 8. Auto-Populate Workouts 6 Weeks Out
**Problem**: Daily workouts only generate for today/tomorrow. You want 6 weeks always populated, copying the previous week if nothing changes.
**Fix**: Modify `generate-daily-workouts` edge function to check for empty days up to 42 days out. For any empty day, clone the same weekday from the previous week. This runs on cron automatically.

### 9. Quick Logs → Save as Workout Template
**Problem**: Quick-logged workouts are stored as standalone records. You want them in each user's workout activity instead, with an optional "Save as Template" button.
**Fix**: Change quick log storage to go into `workout_logs` / user activity feed instead of a separate quick-log table. Add a "Save as Template?" button that copies the workout into `community_workouts` for reuse.

### 10. Newsletter — No Selling, Engagement Only
**Problem**: The AI newsletter prompts include product pitches, CTAs to buy things, and sales language.
**Fix**: Rewrite the system prompts in `generate-newsletter` and `AdminNewsletterComposer` templates to focus on education, humor, and engagement. Remove all promotional language from default templates. Add a manual "Add Promotion" section at the bottom that you can optionally fill in.

### 11. New Month / Announcement Pop-Up on User Dashboard
**Problem**: When monthly focus or challenge changes, users just get a notification — no visual pop-up.
**Fix**: Create a `MonthlyAnnouncementModal` component that checks `monthly_focus` and `monthly_challenges` for the current month. On dashboard load, if the user hasn't seen this month's content (tracked via localStorage or a `seen_announcements` table), show a branded pop-up. Also trigger on admin broadcasts. After dismissal, show a persistent card under the poster/tech box on the dashboard.

### 12. How to Make a Guide (Playbooks Store)
**Problem**: The "Save Guide" form errors with "Could not find the 'slug' column of 'sport_guides' in the schema cache."
**Fix**: The `sport_guides` table is missing a `slug` column. Create a migration to add `slug TEXT` to `sport_guides`. The `AdminGuideStore.tsx` already generates a slug on insert (line 82) — the column just doesn't exist yet.

### 13. Training NL Tab — Too Long, Too Wordy, Not Funny
**Problem**: `AdminTrainingNewsletter.tsx` calls `training-newsletter-send` which uses long, formal prompts. The output is wordy and sales-y.
**Fix**: Rewrite the AI prompt to enforce: max 200 words, conversational/funny tone, zero sales language, sounds like Matt talking to clients. Add parameters for tone (funny/serious), length (short/medium), and a "no selling" hard rule. Also merge this with the Compose tab to eliminate redundancy (see #14).

### 14. Two Newsletter Tabs — Remove Redundancy
**Problem**: "Compose" tab (`AdminNewsletterComposer`) and "Training NL" tab (`AdminTrainingNewsletter`) both generate and send newsletters to the same subscriber list.
**Fix**: Merge into one unified "Newsletter" tab. Keep the AI generation from Training NL (with the improved prompts from #13) and the manual compose/template picker from Compose. One tab, one flow.

### 15. CMO Report Crashes the Site ("Page Unresponsive")
**Problem**: `weekly-cmo-report/index.ts` fetches ALL profiles, ALL progress logs (30 days), ALL workout logs in parallel. On a growing database this causes the edge function to time out or return massive payloads, freezing the browser.
**Fix**: Add `.limit()` calls and aggregate server-side. Use `count` queries instead of fetching full rows. Return a summary object, not raw data arrays.

### 16. Three Products Can't Enroll
**Problem**: Some sandbox test buttons fail because `create-test-checkout` doesn't handle their product IDs, or the corresponding checkout functions don't exist/aren't deployed.
**Fix**: Audit `create-test-checkout/index.ts` to ensure all product IDs in `AdminSandbox.tsx` are mapped. Deploy any missing checkout edge functions.

### 17. Search Console Sync Failed
**Problem**: `fetch-search-console` edge function requires Google Search Console API credentials (`GOOGLE_SERVICE_ACCOUNT_KEY`). The function may fail if the service account doesn't have Search Console access, or the API call format is wrong.
**Fix**: Check `fetch-search-console/index.ts` for errors. The secret `GOOGLE_SERVICE_ACCOUNT_KEY` exists — verify the function logic handles errors gracefully and returns a clear message.

### 18. Web Design CRM — Error Adding Lead
**Problem**: `AdminWebDesignCRM.tsx` inserts into `web_design_leads` using `as any` cast. The table may be missing required columns or have RLS blocking inserts.
**Fix**: Verify `web_design_leads` table schema. Add any missing columns. Ensure admin RLS policy exists for inserts.

### 19. Automation Hub — Nothing Working
**Problem**: Most buttons invoke edge functions that aren't deployed (404 errors). The "basically nothing is working" aligns with earlier findings that ~12 functions need deployment.
**Fix**: Batch deploy all automation edge functions. This is the same root cause as the Quick Fire buttons from the previous discussion.

### 20. Demo Links Tab Crashes System
**Problem**: `AdminDemoLinkGenerator.tsx` itself looks lightweight (308 lines, no heavy queries). The crash may be caused by another tab's query running in the background while this tab renders, or a React rendering loop.
**Fix**: Wrap `AdminDemoLinkGenerator` in error boundaries. Check if lazy-loading cleanup is happening properly. Add `Suspense` fallback if missing.

---

## Implementation Order

**Phase 1 — Critical Fixes (Unblock Admin)**
1. Fix `generate-newsletter` auth (getClaims → getUser) — fixes #7
2. Add `slug` column to `sport_guides` — fixes #12
3. Delete duplicate migration file — fixes #6
4. Add `/demo-real-estate` to HIDDEN_PATHS — fixes #3
5. Fix CMO report to use aggregated queries — fixes #15

**Phase 2 — Newsletter Overhaul**
6. Rewrite newsletter AI prompts (no selling, short, funny) — fixes #10, #13
7. Merge Compose + Training NL into one tab — fixes #14

**Phase 3 — Product & Pricing Cleanup**
8. Update all pricing arrays sitewide — fixes #1
9. Gate Contractor Leads, AI Chatbot; admin-only Missed Call — fixes #2
10. Fix battlecard send button — fixes #4
11. Fix social media refresh — fixes #5

**Phase 4 — Dashboard & UX**
12. Monthly announcement pop-up + persistent card — fixes #11
13. Auto-populate 6 weeks of workouts — fixes #8
14. Quick logs → user activity + "Save as Template" — fixes #9

**Phase 5 — Deploy & Stabilize**
15. Batch deploy all missing edge functions — fixes #16, #17, #18, #19
16. Fix Demo Links crash — fixes #20

### Files Modified (estimated)
- `supabase/functions/generate-newsletter/index.ts` — fix auth
- `supabase/functions/weekly-cmo-report/index.ts` — optimize queries
- `src/components/admin/AdminNewsletterComposer.tsx` — merge + rewrite prompts
- `src/components/admin/AdminTrainingNewsletter.tsx` — merge into Composer
- `src/components/admin/AdminSandbox.tsx` — pricing + product gating
- `src/components/admin/AdminOpsCenter.tsx` — pricing
- `src/components/admin/AdminClientHealth.tsx` — pricing
- `src/components/admin/AdminGuideStore.tsx` — slug fix
- `src/components/admin/AdminDemoLinkGenerator.tsx` — error boundary
- `src/components/layout/BottomTabBar.tsx` — add demo paths
- `src/pages/Admin.tsx` — merge newsletter tabs
- `src/pages/ZoneDashboard.tsx` or `Dashboard.tsx` — announcement modal
- New: `src/components/dashboard/MonthlyAnnouncementModal.tsx`
- Migration: add `slug` to `sport_guides`
- Delete: `supabase/migrations/20260331000001_seo_page_configs.sql`

