

# Fix: 8 Issues Across DWA Admin + Splash Screen + Checkouts

## Issues Identified

### 1. Stripe checkout redirects to M2 Training homepage
**Root cause**: `create-field-service-checkout` and `create-hire-alert-checkout` use `success_url` with the request's `origin` header, which on mattmichelstraining.com is correct. But the success page (`/field-service?success=1` and `/hire-alert?success=1`) loads the M2 training homepage look because the root route is domain-detected. The real problem: after checkout, the user lands on a product page that works fine — the "splash" flash is Issue 2.

### 2. M2 Training splash screen flashes on every navigation (THE BIG ONE)
**Root cause**: The `hero-shell` div in `index.html` is a static HTML element that shows "M² Training" branding on every full page load. Since this is an SPA, it should only show on the very first load. But the `hero-shell` is inside `<div id="root">`, and React replaces the root innerHTML on mount — so the shell should be removed. The issue is likely that on Stripe redirect (full page load), the shell briefly shows M2 branding before React mounts and the domain detection kicks in. The shell already has domain detection (line 199), so the DWA version should show on DWA domains. On mattmichelstraining.com, M2 branding is correct. The flash is the delay between shell render and React mount.

**Fix**: Make the splash removal faster and ensure it doesn't re-appear on SPA navigation. The real fix is: SplashScreen component already removes the shell on mount. The flash is just the normal boot delay. We can minimize it by making the shell less visually intrusive (shorter display, faster fade).

### 3. "Is this supposed to be here?" (Image 69 — Migration section on FieldDesk landing)
This is a section on the Field Service landing page showing "MIGRATE FROM JOBBER OR FIELDSERVIO IN MINUTES." This is intentional content for the product page — it's a feature selling point. **Yes, it's supposed to be there.**

### 4. Scanner error (Image 70 — "Failed to send a request to the Edge Function")
**Root cause**: `hire-alert-scanner/index.ts` has **zero CORS headers** and no OPTIONS handler. When called from the browser via `supabase.functions.invoke()`, the preflight fails.

**Fix**: Add CORS headers + OPTIONS handler to `hire-alert-scanner`.

### 5. "How do I get a code to test?" (Image 71 — Tech PIN login)
The tech PIN login at `/field-service/tech` requires a tech to exist in `field_service_techs` table with a PIN. The table is currently empty. To test, we need to create a demo tech record.

**Fix**: Add a "Create Demo Tech" button in DWA Admin, or seed a demo tech (PIN: 1234) in the database.

### 6. "Is there only one DWA Admin button?" (Image 72)
Currently there's one "DWA Admin" link in the AdminDWAOverview quick links pointing to `/dwa-admin`. The `/admin` page (main admin) has a DWA tab, and `/dwa-admin` is the dedicated FieldDesk management page. This is correct — but we should add more prominent navigation between them.

### 7. Test checkouts are NOT $0 (Image 73 — Command Deck)
**Root cause**: The DWA Command Deck buttons say "Test Checkout (Bundle $0)" and "Test Checkout (Standalone $0)" but they call `create-field-service-checkout` which creates real Stripe checkout sessions at $199/mo and $299/mo. The labels are lies.

**Fix**: Either create actual $0 test checkout sessions (using `unit_amount: 0` or a coupon), or fix the labels to show the real prices, or create a separate test checkout function.

### 8. "What is the Oracle Report?" (Image 74)
The Oracle Report (`agent-smith-report`) is a health check that queries all product tables and returns MRR, revenue, leads, and action items. The modal shows: MRR $1,195, 0 revenue 7d/30d, 0 leads 24h, 1 action needed. This is working correctly — it's your business health dashboard.

---

## Plan

### Fix A: CORS on `hire-alert-scanner` and `contractor-lead-notify`
Add standard CORS headers + OPTIONS handler to both functions so they stop failing when called from the browser.

### Fix B: $0 Test Checkouts
Modify `DWACommandDeck.tsx` to pass a `test: true` flag, and update `create-field-service-checkout` to create $0 checkout sessions when `test: true` is passed (only for Matt's email).

### Fix C: Seed Demo Tech for PIN Login
Create a migration to insert a demo tech (name: "Demo Tech", PIN: 1234, client_id linked to demo) so the tech app can be tested.

### Fix D: Splash Screen Flash Reduction
The hero-shell flash is unavoidable on full page loads (Stripe redirects). We'll add a CSS transition so it fades out smoothly instead of abruptly disappearing, and reduce the shell's min-height so it's less jarring.

### Fix E: Add tooltip/info to Oracle Report button
Add a small description under the Oracle button explaining what it does.

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/hire-alert-scanner/index.ts` | Add CORS headers + OPTIONS handler |
| `supabase/functions/contractor-lead-notify/index.ts` | Add CORS headers + OPTIONS handler |
| `supabase/functions/create-field-service-checkout/index.ts` | Support `test: true` for $0 sessions |
| `src/components/dwa-admin/DWACommandDeck.tsx` | Pass `test: true` to checkout, add Oracle description |
| `index.html` | Add fade-out transition to hero-shell |
| New migration | Seed demo tech (PIN: 1234) |

### Answers to Your Questions
- **3 (migrate section)**: Yes, it's supposed to be there — it's a selling point for contractors switching from Jobber/FieldServio.
- **5 (tech PIN code)**: No demo tech exists yet. We'll seed one with PIN 1234.
- **6 (DWA Admin button)**: There's one link — `/dwa-admin` is the FieldDesk-specific admin. The main `/admin` has the broader DWA tab. Both are intentional.
- **8 (Oracle Report)**: It's your business health dashboard — shows MRR ($1,195), recent revenue, leads, and alerts. It's working correctly.

