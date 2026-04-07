

# 2026 Design System Upgrade — All Public Pages

## The Problem
255 pages, each with hardcoded styles. Editing them one-by-one would take weeks and create maintenance hell. Instead, we upgrade the **design system layer** so every page inherits the new look automatically, then update the ~10 shared layout/section components that 90% of pages already use.

## Strategy: Cascade, Don't Copy-Paste

```text
Layer 1: CSS Variables + Global Styles (index.css)     ← touches ALL pages
Layer 2: Shared Layout Components (AppNavbar, SEOHead)  ← touches ALL pages
Layer 3: Reusable Section Components (new)              ← opt-in per page
Layer 4: Page-Category Batch Updates (~6 patterns)      ← covers 200+ pages
Layer 5: High-Traffic Page Polish (Index, Pricing, etc) ← 8-10 pages
```

## What Changes

### Step 1: Global Design Tokens (index.css + tailwind.config.ts)
- Add `--glass-bg`, `--glass-border`, `--glass-blur` CSS tokens
- Add `--font-display` (Plus Jakarta Sans) and `--font-body` (DM Sans) tokens
- Update `body` font-family to DM Sans, add `.font-display` utility for Plus Jakarta Sans
- Add Google Fonts `<link>` to `index.html` for both fonts
- Add glassmorphism utilities: `.glass-card`, `.glass-hero`, `.glass-stats`
- Add scroll-animation utility: `.animate-on-scroll` with Intersection Observer JS snippet in a global hook
- Soften the dark palette slightly: `--background` from pure `0 0% 5%` to `0 0% 6%`, `--card` from `0 0% 9%` to `0 0% 8%` with a subtle warm shift
- Add `--m2-rust` accent token: `18 82% 42%` (your existing primary is close — this is refinement)

### Step 2: New Shared Components (5 files)
Create reusable 2026-style building blocks:

1. **`src/components/layout/PageShell.tsx`** — wraps any page with `<AppNavbar />`, consistent padding, scroll-animation observer, and optional glassmorphic hero slot. Pages that already use `<AppNavbar />` + `<div className="min-h-screen bg-background">` can swap to `<PageShell>`.

2. **`src/components/layout/GlassHero.tsx`** — frosted glass hero section with `backdrop-blur-xl`, translucent background, pill badge, headline, subline, and CTA. Replaces the 31+ pages using `bg-[#0f0f1a]` hardcoded hero patterns.

3. **`src/components/layout/StatsStrip.tsx`** — animated counter bar with glassmorphism. Accepts array of `{value, label}`. Intersection Observer triggers count-up animation.

4. **`src/components/layout/FeatureGrid.tsx`** — asymmetric card grid with glass treatment and 3D hover tilt. Replaces the repeated `grid md:grid-cols-2 gap-4` + icon card pattern used across 50+ product pages.

5. **`src/hooks/useScrollReveal.ts`** — Intersection Observer hook that adds `.revealed` class for CSS-driven fade-in + slide-up. Applied globally via PageShell.

### Step 3: Update Existing Shared Components
- **`AppNavbar.tsx`** — add glassmorphism treatment (`backdrop-blur-xl bg-background/80`), warm hover states, Plus Jakarta Sans for logo/brand text
- **`WaitlistGate.tsx`** — glassmorphic card with warm glow border, improved typography hierarchy
- **`HeroSection.tsx`** (Index hero) — glassmorphic overlay on stats, scroll-triggered animations, typography upgrade

### Step 4: Batch-Update Page Categories

**Category A: Dark `bg-[#0f0f1a]` pages (~31 pages)**
These all use the same hardcoded dark background. Search-and-replace `bg-[#0f0f1a]` → `bg-background` and `text-[#f97316]` → `text-primary`. This alone modernizes them by inheriting the global theme instead of fighting it.

**Category B: WaitlistGate-only pages (~20 pages)**
Pages like AIHandbook, ContractorChatbot that are just a wrapper around `<WaitlistGate>`. Wrap in `<PageShell>` + swap to `<GlassHero>` header. Since WaitlistGate itself gets upgraded in Step 3, these pages improve automatically.

**Category C: Product sales pages with hero + features + CTA (~60 pages)**
Pages like MissedCallSaaS, RevenuePreventer, ContractorLeads. Replace inline hero markup with `<GlassHero>`, inline feature grids with `<FeatureGrid>`, and stats with `<StatsStrip>`.

**Category D: Mockup/demo pages (~15 pages)**
Already have their own style. Light touch — add `<PageShell>` wrapper and glassmorphic nav only.

**Category E: Content/info pages (~10 pages)**
About, Learn, ForParents, Schedule, etc. Typography upgrade via global fonts + add scroll animations.

**Category F: Admin, Dashboard, Zone pages — EXCLUDED**
No changes to ZoneDashboard, ZonePortal, Dashboard, Admin, Profile, Progress, or any protected route dashboards.

### Step 5: High-Traffic Page Polish
Individual attention on the 8 pages that get the most traffic:
- `Index.tsx` — full glassmorphic hero, animated stats, scroll reveals
- `Pricing.tsx` — glass tier cards with 3D hover, animated feature reveals
- `About.tsx` — typography overhaul, glass quote cards, scroll timeline
- `Shop.tsx` — glass tab bar, card hover effects
- `AllServices.tsx` — glass category headers, asymmetric service grid
- `WebDesignServices.tsx` — glassmorphic pricing tiers, animated add-on cards
- `RevenuePreventer.tsx` — full 2026 treatment as flagship product page
- `GetStarted.tsx` — glass form card, trust bar

## What's NOT Changing
- User dashboards (Dashboard, ZoneDashboard, ZonePortal, Profile, Progress)
- Admin panel (Admin, AdminViewUser)
- Auth pages (Auth — already has its own treatment)
- Zone theme (ZoneThemeWrapper already has a distinct dark theme)
- Any database tables, edge functions, or backend logic
- Core functionality of any page

## Files Created
- `src/components/layout/PageShell.tsx`
- `src/components/layout/GlassHero.tsx`
- `src/components/layout/StatsStrip.tsx`
- `src/components/layout/FeatureGrid.tsx`
- `src/hooks/useScrollReveal.ts`

## Files Modified
- `index.html` — add Plus Jakarta Sans + DM Sans font links
- `src/index.css` — new tokens, glassmorphism utilities, scroll animation keyframes
- `tailwind.config.ts` — add glass, font-display utilities
- `src/components/layout/AppNavbar.tsx` — glass treatment
- `src/components/WaitlistGate.tsx` — glass card upgrade
- `src/components/features/HeroSection.tsx` — glass overlay + animations
- ~100-150 product/service pages — swap to shared components (batched)

## Implementation Approach
This will be done in phases across multiple messages:
1. **Phase 1**: Global styles + new shared components (the foundation)
2. **Phase 2**: Update existing shared components + high-traffic pages
3. **Phase 3**: Batch-update Category A-C pages (bulk search-replace + component swaps)

Total estimated scope: 3-4 implementation messages.

