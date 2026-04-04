# Age Verification Gate + Parental Consent + Sitewide Rebrand to "M2 Development"

## What This Does

1. Adds a date-of-birth field to the M² Training app signup flow — if user is under 18, blocks account creation until a parent creates the account for them (via the existing parent flow)
2. Renames every instance of just internet stuff not my training stuff **"M2 Development"** sitewide
3. Removes the Before & After gallery from the Stewart Dental production site (eliminates HIPAA pho

---

## Part 1: Age Verification Gate (Michigan HB 4388 Compliance)

&nbsp;

Wait what is against the rules? Sharing on Instagram? 

**File: `supabase/functions/create-child-account/index.ts**`

- Already handles parent-created child accounts — no changes needed
- The existing parent flow IS the compliant path for minors

**Why this works:** Michigan HB 4388 requires parental consent for users under 18 on interactive platforms. By forcing all under-18 signups through the parent flow (which already exists), we comply without building a separate consent workflow.

---

## Part 2: Remove Stewart Dental Before & After Gallery

**File: `src/pages/StewartDentalProduction.tsx**`

- Remove the "Before & After Gallery" section entirely (the `gallery` tab and `#gallery-section`)
- Remove "Gallery" from the nav links
- Remove the `gallery` type from the Tab type
- This eliminates all HIPAA PHI risk from clinical photos

---

## Part 3: Sitewide Rebrand — "M2 Development"

**14 files with "M² Performance Training" or "M² Performance":**


| File                                       | What changes                       |
| ------------------------------------------ | ---------------------------------- |
| `src/pages/PrivacyPolicy.tsx`              | All 3 instances → "M2 Development" |
| `src/pages/TermsOfService.tsx`             | All 5 instances → "M2 Development" |
| `src/pages/JoinTeam.tsx`                   | "Powered by" line                  |
| `src/pages/SEOLandingPage.tsx`             | Footer line                        |
| `src/pages/Assessment.tsx`                 | SEOHead title                      |
| `src/pages/WeeklyBusinessDigest.tsx`       | 2 instances in email preview       |
| `src/pages/Auth.tsx`                       | Welcome toast message              |
| `src/pages/ElectricianMockup.tsx`          | LD+JSON description                |
| `src/components/workout/IntervalTimer.tsx` | Any branding                       |
| + any remaining files found                | Same pattern                       |


The LegalFooter already says "M2 Development" — no change needed there. ***notice this change**

---

## Technical Details

- **Database migration:** Add `date_of_birth` column to `profiles` table (nullable, type `date`)
- **Auth metadata:** Pass `date_of_birth` in `user_metadata` during signup so the `handle_new_user` trigger can store it
- **Update `handle_new_user` trigger** to write DOB to profiles
- **No new edge functions needed** — the parent/child flow already exists
- **No new tables needed**

## Files Changed

- `src/pages/Auth.tsx` — add DOB field + age gate logic
- `src/pages/StewartDentalProduction.tsx` — remove gallery section
- `src/pages/PrivacyPolicy.tsx` — rebrand
- `src/pages/TermsOfService.tsx` — rebrand
- `src/pages/JoinTeam.tsx` — rebrand
- `src/pages/SEOLandingPage.tsx` — rebrand
- `src/pages/Assessment.tsx` — rebrand
- `src/pages/WeeklyBusinessDigest.tsx` — rebrand
- `src/pages/ElectricianMockup.tsx` — rebrand
- - ~5 more files with remaining "M² Performance" references
- Migration: add `date_of_birth` to `profiles`, update `handle_new_user` trigger