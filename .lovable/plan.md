

# 🔍 Production Launch Code Audit — Matt Michels Training

## Executive Summary

After systematic review of the entire codebase — TypeScript compilation, production build, route structure, security patterns, SEO markup, forms, and performance — **this site is in strong launch shape**. The build compiles cleanly with zero errors, the architecture is solid, and most best practices are already in place. Below are findings organized by severity.

---

## 🔴 CRITICAL (Launch Blockers)

### 1. XSS Risk: Unsanitized HTML from Database Rendered via `dangerouslySetInnerHTML`

**Files:** `SEOLandingPage.tsx`, `LegalPage.tsx`, `AdminLegalCompliance.tsx`

These pages render raw HTML from the database directly into the DOM without sanitization. If an admin account is compromised or AI-generated content contains malicious scripts, this is a stored XSS vector.

**Fix:** Install `dompurify` and wrap all `dangerouslySetInnerHTML` content:
```tsx
import DOMPurify from "dompurify";
// ...
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
```

The pages in `ClientReportGenerator.tsx`, `PodcastPitchService.tsx`, `RestaurantMenuCopy.tsx` use it with hardcoded `desc` strings in the component — those are safe since the HTML is not user-supplied.

### 2. Oversized Chunk: `pose-detection.esm` at 2.4 MB

The TensorFlow pose detection library ships a **2.4 MB** chunk. If any user path lazy-loads this (e.g., form-check videos), it will tank Core Web Vitals on mobile.

**Fix:** Verify this is truly lazy-loaded and only imported from a protected route. If it's reachable from a public page, move it behind an explicit user action (e.g., "Start Camera" button triggers the import). Add it to `manualChunks` to isolate it:
```ts
"vendor-pose": ["@tensorflow-models/pose-detection"],
```

### 3. Service Worker Precache Failure

Build output shows: `precache 7 entries (0.00 KiB)` and a glob error: `Cannot read properties of undefined (reading 'sync')`. This means the service worker is deploying but precaching **nothing** — users who visit once and go offline will see a blank page.

**Fix:** Either fix the workbox glob config or, since you're launching tonight, consider temporarily disabling PWA precache and using network-first strategy only. The `injectRegister: false` is already set, so the risk is low, but the broken precache should be fixed post-launch.

---

## 🟡 MODERATE (Fix Soon — Not Launch Blockers)

### 4. `console.log` in Production Auth Flow

`Auth.tsx` line 310-315 logs the Google OAuth redirect URL and full result object to console. This leaks auth flow details to anyone who opens DevTools.

**Fix:** Remove or gate behind `import.meta.env.DEV`:
```tsx
if (import.meta.env.DEV) console.log("[GOOGLE-AUTH]...");
```

### 5. `window.open` for Stripe Checkout (Popup Blocker Risk)

15+ checkout pages use `window.open(data.url, "_blank")` to redirect to Stripe. Many mobile browsers and popup blockers will silently block this, causing users to click "Subscribe" and see nothing happen. **This loses revenue.**

**Fix:** Use `window.location.href = data.url` instead of `window.open` for all Stripe checkout redirects. The user expects a navigation, not a popup.

### 6. Duplicate Facebook Pixel `noscript` Tags

`index.html` has the FB pixel `<noscript><img>` fallback at **both** line 140 (inside `<body>` before `#root`) and line 302 (after scripts). This fires the PageView event twice for noscript users and inflates analytics.

**Fix:** Remove the duplicate at line 140.

### 7. Missing `rel="noopener noreferrer"` on Some External Links

Most external links are correctly attributed, but a sweep of 162 files with `href="tel:"` and `href="mailto:"` patterns shows inconsistent usage. While `tel:` and `mailto:` links don't need `noopener`, any `target="_blank"` links to external sites should always include it.

### 8. Vite `define` Hardcodes Supabase Anon Key

`vite.config.ts` lines 127-132 hardcode the anon key as a fallback. This is the **publishable** key so it's not a security issue, but it means if the `.env` file isn't loaded properly (e.g., Vercel misconfiguration), the app will silently connect to the wrong project or fail. Verify Vercel environment variables match.

---

## 🟢 MINOR (Optimization — Post-Launch)

### 9. 270+ Lazy Imports in App.tsx

While `lazyRetry` handles chunk failures gracefully, having 270+ lazy imports in a single file impacts developer experience and increases the initial route-matching overhead. Consider grouping related routes into sub-routers (e.g., `DemoRoutes`, `ServiceRoutes`, `AdminRoutes`).

### 10. Font Loading: 8 Font Families Loaded

`index.html` preloads 2 Google Fonts stylesheets covering 8 font families. Even with `media="print"` deferral trick, this is ~150-200KB of font data. Consider auditing which fonts are actually used across public pages and trimming unused weights.

### 11. Google Analytics Deferred by 2 Seconds

GA is loaded with a `setTimeout(2000)` after `window.load`. This is good for performance but means the first 2+ seconds of user interaction are untracked. Standard practice is to load after `requestIdleCallback` instead.

### 12. `&amp;` in Error Boundary Button Text

`ErrorBoundary.tsx` line 126 shows `Clear cache &amp; reload` — the `&amp;` is correct JSX but visually renders as `&` which is fine. No action needed.

### 13. Missing `<h1>` on Some Product Pages

Many product/service pages likely use the shared layout pattern. Verify each public page has exactly one `<h1>` tag for SEO. The SEO landing pages correctly use `<h1>` for the heading.

---

## ✅ What's Already Solid

- **TypeScript**: Zero compilation errors
- **Production build**: Clean, no warnings except the expected chunk size warning for pose-detection
- **Error handling**: Robust `ErrorBoundary` with auto-retry, chunk load retry via `lazyRetry`, and broken image fallback
- **Security**: No API keys exposed in frontend, all secrets server-side, RLS enforced, `service_role` patterns correct
- **SEO**: Structured data (JSON-LD) for business + sports location, proper meta tags, OG/Twitter cards, `noscript` fallback content, semantic HTML
- **SPA routing**: Wildcard routes for demos, auth callbacks properly handled
- **Form handling**: All checkout forms use try/catch with toast error feedback, email validation present
- **Accessibility**: Viewport meta allows scaling (`user-scalable=yes`), semantic heading structure in index.html
- **Performance**: Lazy loading everything, deferred third-party scripts, manual chunks for vendor splitting, critical CSS inlined

---

## Recommended Fix Priority for Tonight

1. **Install DOMPurify** and sanitize `dangerouslySetInnerHTML` in `SEOLandingPage.tsx` and `LegalPage.tsx` — 10 min fix
2. **Change `window.open` to `window.location.href`** for all Stripe checkouts — 15 min bulk find-replace
3. **Remove duplicate FB pixel noscript** — 1 min fix
4. **Remove `console.log` from Auth.tsx** — 2 min fix

Everything else can wait until after launch.

