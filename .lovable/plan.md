

# Premium Product Demo Email — "The Full Tour"

## What We're Building

A new Edge Function `product-demo-email` that sends a premium, visually rich HTML email showcasing **both FieldDesk and TechAlert** to prospective clients like DJ Conley. This replaces the current TechAlert-only tease with a full product showcase.

Plus a **"Send Demo Email"** button in the DWA Command Deck with an email input field so Matt can send it to any prospect.

## Email Content Sections

The email will be a dark-themed (DWA navy/teal) visual tour with these sections:

1. **Hero Header** — "Your Field Operations, Reimagined" with DWA branding
2. **FieldDesk Command Center** — Screenshot-style mockup showing:
   - Dispatch Board with job cards (7 demo boiler jobs)
   - Live Tech Map with 4 tech pins across Metro Detroit
   - Mobile Tech App preview (PIN login, photo upload, status updates)
   - Auto-SMS notifications (en-route, completed, review request)
3. **SiteRadar Visitor Intelligence** — "See Who's On Your Website Right Now" with 3 demo visitor rows (Stellantis, DMC, Wayne County Schools) and estimated contract values
4. **TechAlert Predictive Hiring** — "Know Before Anyone Else" section showing:
   - 10 revealed boiler tech candidates (real data from DB)
   - Blurred/locked remaining candidates with count
   - Multi-source intelligence explanation (MIOSHA, job boards, cross-referencing)
   - Predictive mobility signals (newly licensed, expiring licenses, status changes)
5. **Feature Comparison Table** — FieldDesk vs eWay-CRM (8 rows, all ✗/✓)
6. **Pricing** — FieldDesk $199/mo, TechAlert $99/mo, Bundle pricing
7. **CTA Button** — "Schedule a 15-Minute Demo" linking to Matt's calendar or reply-to

## Technical Plan

### Step 1: Create `supabase/functions/product-demo-email/index.ts`
- Queries `hire_alert_candidates` for real boiler data (same as tease)
- Builds full HTML email with all 7 sections above
- Uses DWA dark branding (navy `#0a1628`, teal `#00d4ff`)
- Accepts `{ to_email, company_name, contact_name }` in request body
- Personalizes header and comparison section with company name
- Sends via Resend from `matt@detroitwebagent.com`

### Step 2: Update `DWACommandDeck.tsx`
- Replace the single "Send DJ Conley Tease" button with a more flexible "Send Product Demo Email" action
- Add a small modal/form where Matt enters: recipient email, company name, contact name
- Keep the existing tease button as well (for TechAlert-only pitches)

### Step 3: Deploy and send test to Matt

The email will use HTML tables for maximum email client compatibility (same pattern as the existing tease). Visual elements like the dispatch board, tech map, and mobile app will be rendered as styled HTML mockups — not actual screenshots — so they render perfectly in every email client.

