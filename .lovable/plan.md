

# Plan: What's Included Page, GA4, Browser Notifications & Free Program Lead Magnet

Four features across the training business and web design service.

---

## Feature 5 — "What's Included" Checklist Page

**New file: `src/pages/WebDesignIncluded.tsx`**
- Route: `/whats-included` (public, no login required)
- Standalone page with AppNavbar, SEOHead (title: "What's Included for $499 | M² Web Design Detroit")
- Hero: "Here's Exactly What You Get for $499" headline
- Checklist grid with green checkmarks (~12 items): copywriting, mobile-first design, contact/quote form, Google Business optimization, Maps embed, click-to-call, SSL + hosting, domain connection, SEO meta tags, 1 revision round, live in 7 days, $49/mo ongoing
- Bottom CTA: "Ready? Let's talk." linking to `/detroit-web-design`
- JSON-LD WebPage schema

**Edit: `src/App.tsx`** — add lazy import + `/whats-included` route

**Edit: `src/pages/WebDesignAgency.tsx`** — add "See exactly what's included →" link below the pricing section

**Edit: `src/components/admin/AdminOutreach.tsx`** — append `mattmichelstraining.com/whats-included` line to email templates

**Edit: `index.html`** — add `/whats-included` to noscript links

---

## Feature 6 — Google Analytics Snippet

**Edit: `index.html`** — add GA4 gtag.js snippet in `<head>` with a placeholder `G-XXXXXXXXXX` measurement ID. The user can swap in their real ID later.

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-XXXXXXXXXX');</script>
```

This covers ALL routes including demo pages automatically since it's a SPA.

---

## Feature 7 — Browser Push Notifications

The app already has a `notifications` table and a `NotificationBell` component with realtime subscriptions. We'll add the Web Notifications API layer on top.

**New file: `src/hooks/useBrowserNotifications.tsx`**
- On dashboard mount, request `Notification.permission` (shows browser prompt)
- Subscribe to Supabase Realtime on `notifications` table filtered by `user_id`
- On INSERT event, fire `new Notification(title, { body })` if permission granted
- Clean up channel on unmount

**Edit: `src/components/dashboard/DashboardHome.tsx`** — mount `useBrowserNotifications()` hook

**New edge function: `supabase/functions/weekly-checkin-nudge/index.ts`**
- Queries all profiles with active subscriptions
- Inserts a notification row per user: "Don't forget your check-in this week"
- Intended to be scheduled via pg_cron for Sundays at 6pm ET

**Migration:** `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;`

**Note:** This gives browser-level notifications when PWA is open/background tab. True background push (app fully closed) would require FCM/OneSignal — this is the foundation layer.

---

## Feature 10 — Free Workout PDF Lead Magnet

Follows the orphan/standalone page pattern like `/free-ai-generator`.

**New file: `src/pages/FreeProgram.tsx`**
- Route: `/free-program` (public, no login)
- AppNavbar + SEOHead with JSON-LD
- Hero: "Free: 4-Week Beginner Strength Program" with badge
- Teaser: 4 week titles shown blurred/locked
- Email capture form: First Name (optional) + Email (required) + "Send Me the Program" button
- On submit: upsert into `newsletter_subscribers` with `source: 'free-program'`, then invoke `send-free-program` edge function
- Success state: checkmark + "Check your inbox!" + CTA to sign up for trial
- Below fold: TechShowcaseMarketing component (same as free generator)

**New edge function: `supabase/functions/send-free-program/index.ts`**
- Accepts `{ email, firstName }`
- Calls Lovable AI Gateway to generate a 4-week beginner strength program
- Formats into styled HTML email (dark theme matching existing email pattern from send-workout-email)
- Sends via Resend (RESEND_API_KEY already configured)
- Also upserts into newsletter_subscribers server-side as backup

**Edit: `src/App.tsx`** — add lazy import + `/free-program` route

**Edit: `index.html`** — add `/free-program` to noscript links

**Edit: `src/pages/Pricing.tsx`** — add "Not ready? Get our free program →" link

---

## Files Summary

| File | Action |
|------|--------|
| `src/pages/WebDesignIncluded.tsx` | **New** — What's Included checklist |
| `src/pages/FreeProgram.tsx` | **New** — PDF lead magnet page |
| `src/hooks/useBrowserNotifications.tsx` | **New** — Web Notifications hook |
| `supabase/functions/weekly-checkin-nudge/index.ts` | **New** — Sunday reminder |
| `supabase/functions/send-free-program/index.ts` | **New** — Generate + email program |
| `src/App.tsx` | **Edit** — add 2 routes |
| `src/pages/WebDesignAgency.tsx` | **Edit** — add "What's included" link |
| `src/components/admin/AdminOutreach.tsx` | **Edit** — add URL to email templates |
| `src/components/dashboard/DashboardHome.tsx` | **Edit** — mount notification hook |
| `src/pages/Pricing.tsx` | **Edit** — add free program link |
| `index.html` | **Edit** — GA4 snippet + noscript links |
| Migration SQL | Enable realtime on notifications table |

---

## Blocker

GA4 will use placeholder `G-XXXXXXXXXX`. You'll need to create a GA4 property at analytics.google.com and swap in the real Measurement ID. I'll add a code comment marking where to replace it.

