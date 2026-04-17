## Plan — 4 Builds

### 1. TechAlert Prospect Hunter (THE BIG ONE)

Scrape Indeed/ZipRecruiter/SimplyHired/LinkedIn Jobs daily for HVAC/boiler/plumbing/electrical shops actively hiring techs in Metro Detroit. These = perfect TechAlert prospects (already in hiring pain, already paying job boards).

- **NEW** `supabase/functions/techalert-prospect-hunter/index.ts` — daily 6am ET cron. Uses Sonar (perplexity/sonar-pro via OpenRouter) to extract company + city + role + days posted from job postings. Cross-references stealth scrape + Google Maps for owner email/phone. Scores: +3 if posting >14 days old, +2 if reposted, +2 if 2+ open roles, +1 if boiler-specific.
- **NEW** table `techalert_prospect_targets` (company, website, email, phone, city, role, days_posted, score, source_url, status).
- **NEW** `src/components/dwa-admin/AdminTechAlertProspects.tsx` — sortable table, "📧 Draft Cold Email" (TCPA-safe copy-paste modal referencing the specific job posting), "📮 Queue Postcard" (uses existing Lob engine), "🚀 Run Hunter Now" button. Wired as new tab in `DWAAdmin.tsx`.
- Cold email + postcard templates lead with: *"Indeed will keep charging you. We watch the MIOSHA license database in real-time — second a licensed tech becomes available in your zip, you get a text. $149/mo, no per-hire fees." AANEVER MENTION WHERE WE GET OUR INFORMATION NEVER! MAKE SURE THIS IS WELL KNOWN IN THE CODE*
- AANEVER MENTION WHERE WE GET OUR INFORMATION NEVER! MAKE SURE THIS IS WELL KNOWN IN THE CODE

### 2. Missed Call Self-Serve Setup Page

Token-based wizard so customers activate themselves instead of replying to Matt's email.

- **NEW** `src/pages/MissedCallSetup.tsx` at `/missed-call-setup?token=X`. Shows provisioned Twilio number, copy-tap forwarding codes (`**61*[#]*11*20#` no-answer, `**67*[#]#` busy), "📱 Send me a test text" button, "🔄 Retry provisioning" button if Twilio buy failed. Status badge: 🟢 Live / 🟡 Awaiting forwarding / 🔴 Failed.
- **NEW** edge functions: `get-missed-call-setup`, `send-missed-call-test`, `retry-missed-call-provision` (all `verify_jwt=false`).
- **MIGRATION**: add `setup_token uuid` to `missed_call_clients`, backfill existing rows.
- **EDIT** `stripe-webhook` `missed_call_subscription` handler: generate token, include big "Open Setup Wizard →" CTA in welcome email pointing to `/missed-call-setup?token=X`.

### 3. fetch() → invoke() Cleanup

- **EDIT** `src/pages/HireAlert.tsx`, `MyTechAlert.tsx`, `GoTechAlert.tsx` — convert ~10 `fetch(${VITE_SUPABASE_URL}/functions/v1/...)` call sites to `supabase.functions.invoke()`. Proper auth + error handling.
- **AUDIT** all `lazyRetry()` imports in `App.tsx` against `src/pages/` filesystem (HOAMeetingMinutes file actually exists — no crash — but verify the full list catches any *real* missing files before launch).

### 4. TechAlert Price Bump $99 → $149

- **EDIT** `supabase/functions/create-hire-alert-checkout/index.ts` — standalone `9900` → `14900`. Beta-grandfathered $99 stays for first 10 (already wired via `BETA_LIMIT`).
- **EDIT** `HireAlert.tsx`, `MyTechAlert.tsx` — update pricing copy ($99 → $149) in 5-7 spots.
- **EDIT** `mem://agency/pricing-and-product-strategy`.

## Files Touched

**New (7)**: 1 migration, 4 edge functions, 1 page, 1 admin component
**Edited (8)**: `App.tsx`, `HireAlert.tsx`, `MyTechAlert.tsx`, `GoTechAlert.tsx`, `DWAAdmin.tsx`, `create-hire-alert-checkout/index.ts`, `stripe-webhook/index.ts`, `config.toml`

## Sequence

Build 1 (revenue unlock) → Build 2 (activation leak) → Build 3 (cleanup) → Build 4 (10-min price bump, last so it ships clean).