

# Plan: Build Studio Rental Page, Rebuild For Parents Page, Create Results Page

This plan covers three new/rebuilt pages, routing updates, and navbar additions.

---

## 1. Studio Rental Page (`/studio-rental`)

**New file: `src/pages/StudioRental.tsx`**

- SEOHead with title, description, path as specified
- 6 sections: Hero (badge, headline, subhead, mailto CTA), What's Included (6-item icon grid), Pricing (3 cards with mailto Inquire buttons), Who This Is For (2-column trainers/health pros), Partnership Interest (CTA mailto), Contact Form (name/email/message → `notify-coach-question` edge function, success toast)
- Dark M² theme, professional B2B tone, orange accents on section headers only

**Modifications:**
- `src/App.tsx`: Add `/studio-rental` route (non-protected)
- `src/components/layout/AppNavbar.tsx`: Add "STUDIO" to nav (either primaryNav or secondaryNav)
- `src/pages/Pricing.tsx`: Add a small card at bottom linking to `/studio-rental` ("Are you a trainer? Rent the studio →")

---

## 2. For Parents Page Rebuild (`/for-parents`)

**Rewrite: `src/pages/ForParents.tsx`**

Complete rebuild with new structure:
1. **Hero** — new headline/subhead, two CTAs (Schedule a Consult → /schedule, Text Matt → sms:3138064952), trust line
2. **Parent Concern Section** — 3 concern/answer accordion-style pairs (injury, sport-specific, monitoring)
3. **Sports Served** — icon chips for 10 sports
4. **What a Program Includes** — timeline layout (3 phases: Assessment, Foundation, Sport-Specific)
5. **Athlete Results** — 3 youth-focused result cards (football squat, wrestling deadlift, baseball velo)
6. **Pricing** — simple links to schedule/pricing tiers
7. **Bottom CTA** — Phone, Text, Email, Schedule button strip

- Updated SEOHead with new title/description and LocalBusiness JSON-LD schema
- Keep existing imports where useful (AppNavbar, SEOHead), remove old components no longer needed

---

## 3. Results Page (`/results`)

**New file: `src/pages/Results.tsx`**

1. **SEOHead** with SportsActivityLocation JSON-LD schema
2. **Youth Athletes section** — "What Parents Are Saying" with 3 parent testimonial quote cards (Football OL, Wrestling, Baseball Pitcher)
3. **Main results grid** — reuse/adapt content from `AthleteResults.tsx` component
4. **Instagram section** — embed `InstagramSocialBox` component, follow button
5. **Bottom CTA** — 3 rows: Train In-Person → /schedule, Try the App Free → /auth?redirect=/trial-welcome, Youth Athlete Inquiry → /for-parents

**Modifications:**
- `src/App.tsx`: Add `/results` route (non-protected)

---

## Technical Details

- All three pages follow existing patterns: `motion` animations, `SEOHead`, `AppNavbar`, Tailwind dark theme classes
- Contact form on Studio Rental uses `supabase.functions.invoke("notify-coach-question")` — already exists as an edge function
- No database migrations needed
- Nav updates: "STUDIO" added to `secondaryNav` in AppNavbar; "RESULTS" can go in secondaryNav or primaryNav depending on space
- For Parents page removes dependency on `ForParentsHero`, `MembershipTiers`, `BringAFriendCard`, `ParentChildBenefits` components (those components stay in codebase for potential reuse elsewhere)

