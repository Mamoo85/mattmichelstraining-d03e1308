# DJ Conley Sandbox — Real Clone, Not a Sketch

Two failures in the last build, both fixable:

1. **Browser tab still shows M² Training branding** on `pat.detroitwebagent.com`. The runtime script in `index.html` (lines 137–148) swaps `document.title` and favicon AFTER the page boots — so for the first ~200ms the user sees M² title + favicon. Worse, there's a static `<link rel="icon" sizes="any">` and `apple-mobile-web-app-title` in the head that paint instantly with M² values. That's what Pat will see.
2. **Content is fake.** I shipped curated bullet-point pages. The live site at djconley.com has full marketing copy, dozens of paragraphs per page, full product/manufacturer lists, project case studies, blog posts. None of that is in the sandbox.

Pat's site has 19 public URLs (per `wp-sitemap-posts-page-1.xml`) plus 9 blog posts. We need every one cloned verbatim.

---

## Plan

### Step 1 — Eliminate the M² flash on `pat.detroitwebagent.com` (zero tolerance)

Move host detection to a **synchronous block at the very top of `<head>`**, before any `<title>` or `<link rel=icon>` tag is parsed. Use `document.write` for the title/favicon when host is `pat.detroitwebagent.com`, OR conditionally render the static head tags via the existing inline IIFE — but moved to be the **first** child of `<head>`.

Specifically:
- Add an inline script as the first thing inside `<head>` that, on `pat.detroitwebagent.com`, injects `<title>D.J. Conley Associates, Inc.</title>` + `<link rel="icon" href="/demo-djconley-current/favicon-32.png">` + `<meta name="apple-mobile-web-app-title" content="D.J. Conley">` BEFORE the existing static M² versions are parsed.
- Easiest approach: keep the current static tags but give them `id="host-default-*"` and have the early script `removeChild` them on the pat host before the parser keeps walking. Browsers process inline scripts synchronously, so this kills the flash if the script appears before the tags.
- Also remove the M² `apple-touch-icon` and any `<link rel="icon">` with the M² favicon for that host.

Verify with `browser--navigate_to_url` to the live preview path and a screenshot of the tab.

### Step 2 — Scrape all 19 pages of djconley.com verbatim

Use `code--fetch_website` (markdown format) for each URL below. Store raw content in `/tmp/djconley-scrape/<slug>.md`, then convert to React components in `src/sandbox/djconley/pages/`:

```
/                       → Home.tsx          (already exists, REWRITE with full content)
/about/                 → About.tsx
/industries/            → Industries.tsx
/service/               → Service.tsx
/parts/                 → Parts.tsx
/products/              → Products.tsx       (Manufacturers list)
/projects/              → Projects.tsx
/rentals/               → Rentals.tsx
/education/             → Education.tsx
/resources/             → Resources.tsx
/careers/               → Careers.tsx
/contact/               → Contact.tsx
/blog/                  → Blog.tsx           (index)
/new-boiler-solutions/  → NewBoilerSolutions.tsx
/boiler-accessories/    → BoilerAccessories.tsx
/boiler-burners/        → BoilerBurners.tsx
/heat-recovery/         → HeatRecovery.tsx
/exhaust-solutions/     → ExhaustSolutions.tsx
/boiler-controls/       → BoilerControls.tsx
```

Plus 9 blog posts at `/blog/<slug>/`.

Each page component must contain:
- The full body copy from the live page (every paragraph, every bullet, every heading) — no summaries, no rewrites.
- Every link the live page has, pointing to the corresponding `/sandbox/djconley/...` route.
- Every image — download from djconley.com to `public/demo-djconley-current/<slug>/` and reference locally.

### Step 3 — Layout match the live site

Live site uses WordPress + a dark hero on every interior page, then a light gray content area with serif-ish sans body. Current `SiteLayout.tsx` is close but missing:
- The footer (Quick Links / Services / Territory / Location / Connect with Us / Careers — all visible in screenshot 4).
- Mobile menu hamburger styled identically to the live site.
- "Accessibility" floating button (visible left side of screenshots 2/3/4).

Add a new `SiteFooter.tsx` and `AccessibilityButton.tsx` mirroring the live HTML structure. Pull the exact link list and address (`26225 Sherwood, Warren, Michigan 48091`) from screenshot 4.

### Step 4 — Update routes in `src/sandbox/djconley/index.tsx`

Add the new pages (blog, blog posts, the 6 product subpages) to the route table. Add `<Route path="blog/:slug" element={<BlogPost />} />` for the dynamic post pages.

### Step 5 — QA pass

- `browser--navigate_to_url` to `pat.detroitwebagent.com` (or sandbox preview equivalent) on mobile viewport (396×762, matching Pat's screenshots).
- Tab title check: must read "D.J. Conley Associates, Inc." with DJ flame favicon, no M² flash.
- Open every one of the 19 pages, confirm content matches live djconley.com.
- Screenshot 4 pages and visually diff against the originals Pat sent.

### Out of scope (hold for later)

- Functional contact form submit (live site uses WPForms — sandbox can render the form but POST to a placeholder).
- Live YouTube embed (we'll keep the same iframe).
- WordPress comment system on blog posts (omit, just render the article body).

---

## Technical notes

- All scraping done via `code--fetch_website` in markdown mode, then HTML mode for any page where markdown loses structure.
- Images downloaded via `curl` in `code--exec` to `public/demo-djconley-current/<page-slug>/`.
- No business logic changes — frontend-only sandbox work.
- No M2 imports leak in: every file under `src/sandbox/djconley/` already uses local components only (verified). `App.tsx` already conditionally hides the M2 banner/footer/tabs for this domain.

---

## Estimated size

~20 page files × ~150–400 lines each + footer + accessibility widget. Roughly 4000–6000 lines of presentational JSX/TSX. Single deploy. No DB, no edge functions.