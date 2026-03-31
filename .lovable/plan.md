

# Build All Three: Legal Compliance + Training Referrals + B2B Referral Automation

---

## Priority 1: Legal Compliance Framework

### 1A. Add 5 New Document Types to Jess
Update `supabase/functions/ai-lawyer-jess/index.ts` DOCUMENT_TYPES array to include:
- `referral_terms` — Referral Program Terms & Conditions
- `cookie_policy` — Cookie Consent Policy (GDPR/UK)
- `refund_policy` — Refund & Cancellation Policy
- `contractor_agreement` — Independent Contractor Agreement
- `data_processing_agreement` — Data Processing Agreement (DPA)

### 1B. Public Legal Pages
Create `/legal/:documentType` route — a single dynamic page component that:
- Fetches the approved document from `legal_documents` by `document_type`
- Renders the HTML content
- Shows "Document pending review" if status is not `approved`

Specific routes: `/legal/terms`, `/legal/privacy`, `/legal/refund`, `/legal/cookie-policy`

### 1C. Site-Wide Footer Legal Links
Create a shared `LegalFooter` component added to the bottom of every B2B service page and the main app layout. Links to: Terms of Service, Privacy Policy, Refund Policy, SMS Consent.

### 1D. Cookie Consent Banner
Create a `CookieBanner` component:
- Shows on first visit for all users
- "Accept" / "Decline" buttons
- Stores consent in localStorage (`m2_cookie_consent`)
- Renders at the bottom of the viewport, dismissible
- Add to the root `App.tsx` layout

### 1E. Checkout Consent Checkbox
Add a required checkbox to all B2B checkout forms: "I agree to the Terms of Service and Privacy Policy" with links. Block the submit/purchase button until checked. This affects ~10-15 service landing pages that have inline checkout forms.

### 1F. Quarterly Legal Review Cron
Create `supabase/functions/legal-review-reminder/index.ts`:
- Queries `legal_documents` for docs where `next_review_at < now()`
- Emails matt@ a summary: "These documents are due for review"
- Schedule: runs 1st of every quarter (Jan/Apr/Jul/Oct)

---

## Priority 2: In-Person Training Referral Program

### 2A. Database Tables
**Migration — `session_referral_rewards`:**
- `id` UUID PK
- `referrer_user_id` UUID (references profiles)
- `referred_friend_email` TEXT
- `session_type` TEXT (30_min / 60_min)
- `status` TEXT DEFAULT 'pending' (pending → credited → redeemed)
- `stripe_session_id` TEXT
- `created_at`, `credited_at`, `redeemed_at` TIMESTAMPTZ
- RLS: service_role + admin only

### 2B. Stripe Webhook Integration
Update `stripe-webhook/index.ts`:
- When a session purchase completes, check metadata for `referredBy`
- If present, insert a row into `session_referral_rewards` with status `credited`
- Send email to referrer: "Your friend booked — you earned a free session!"

### 2C. Admin Manual Gift Panel
Add a section to Admin dashboard:
- Select user by email
- Choose session type (30 min / 60 min)
- Add note ("Referral reward", "Holiday gift", "Venmo payment")
- Inserts into `session_referral_rewards` with status `credited`
- This handles clients who pay via Venmo/Cash/Zelle outside the app

### 2D. Gift Card PDF Generator
Create `supabase/functions/generate-session-gift-card/index.ts`:
- Accepts: recipient name, session type, optional message
- Generates a unique redemption code
- Returns a branded HTML gift card (can be printed/emailed)
- Stores the code in `session_referral_rewards` for redemption tracking

### 2E. Referral UI on Schedule Page
Update `/schedule` page:
- Show referral credit balance if user has any `status = 'credited'` rewards
- "Use Free Session" button that applies the credit during booking
- After use, update status to `redeemed`

---

## Priority 3: B2B Referral Partner Automation

### 3A. Database Tables
**Migration — `b2b_referral_partners`:**
- `id` UUID PK
- `name`, `email` TEXT NOT NULL
- `referral_code` TEXT UNIQUE
- `commission_type` TEXT DEFAULT 'flat' (flat / percent)
- `commission_value` NUMERIC DEFAULT 50
- `total_earned` NUMERIC DEFAULT 0
- `payout_threshold` NUMERIC DEFAULT 50
- `status` TEXT DEFAULT 'active'
- `created_at` TIMESTAMPTZ
- RLS: service_role + admin only

**Migration — `b2b_referral_conversions`:**
- `id` UUID PK
- `partner_id` UUID (references b2b_referral_partners)
- `client_email` TEXT
- `service_type` TEXT
- `stripe_session_id` TEXT
- `commission_amount` NUMERIC
- `status` TEXT DEFAULT 'pending' (pending → approved → paid)
- `created_at`, `paid_at` TIMESTAMPTZ
- RLS: service_role + admin only

### 3B. Partner Registration Page
Create `/partner-program` page:
- Simple form: name, email, PayPal/Venmo handle
- On submit, generates unique referral code, inserts partner record
- Shows their referral link + dashboard with conversion stats
- No auth required — partner logs in via email magic link or just views stats by email lookup

### 3C. Referral Tracking Across All B2B Checkouts
Update all ~50+ B2B checkout edge functions:
- Capture `ref` query param from the page URL
- Pass it as `referral_code` in Stripe metadata
- Stripe webhook matches the code → creates conversion record → calculates commission

### 3D. Fraud Prevention Rules (Built Into Webhook)
- Same email can't generate multiple referral credits within 30 days
- Referrer email cannot match referred client email
- Commission caps per service (configurable in partner record)
- Referral codes expire after 90 days of inactivity

### 3E. Weekly Payout Report
Create `supabase/functions/referral-payout-report/index.ts`:
- Runs weekly (Friday 9am ET)
- Queries all conversions with `status = 'approved'` and partner `total_earned >= payout_threshold`
- Emails matt@ a summary: partner name, total owed, Venmo/PayPal handle
- Admin clicks "Mark as Paid" in dashboard to update status

### 3F. Admin Referral Dashboard
Add "B2B Referrals" tab to Admin:
- List all partners with conversion counts and earnings
- View individual partner conversions
- "Approve" and "Mark as Paid" actions
- Fraud flag alerts (duplicate emails, rapid-fire signups)

---

## Implementation Order (17 steps)

| # | Task | Files |
|---|------|-------|
| 1 | Add 5 doc types to Jess | `ai-lawyer-jess/index.ts` |
| 2 | Create `/legal/:type` page | New component + route |
| 3 | Create `LegalFooter` component | New shared component |
| 4 | Wire footer into all B2B pages | ~15 page edits |
| 5 | Create `CookieBanner` component | New component + App.tsx |
| 6 | Add consent checkbox to checkout forms | ~15 page edits |
| 7 | Create legal review reminder cron | New edge function |
| 8 | Create `session_referral_rewards` table | Migration |
| 9 | Update Stripe webhook for session referrals | `stripe-webhook/index.ts` |
| 10 | Build admin gift panel | Admin dashboard component |
| 11 | Build gift card generator | New edge function |
| 12 | Add referral credits to `/schedule` | Schedule page edit |
| 13 | Create `b2b_referral_partners` + `conversions` tables | Migration |
| 14 | Build `/partner-program` page | New page + route |
| 15 | Update B2B checkouts with referral tracking | ~50 edge function edits |
| 16 | Build weekly payout report | New edge function + cron |
| 17 | Build admin referral dashboard tab | Admin component |

