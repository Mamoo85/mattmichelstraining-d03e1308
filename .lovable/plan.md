

# Plan: Homepage Google Maps Optimization + AppNavbar Reorganization

## 1. Sticky Local Top Bar (new component)

**New file: `src/components/landing/LocalTopBar.tsx`**

- Thin orange bar below AppNavbar: "📍 Grosse Pointe Park, MI · (313) 806-4952 · Schedule →"
- Phone links to `tel:3138064952`, Schedule links to `/schedule`
- Hide on scroll-down, show on scroll-up (track `window.scrollY` delta)
- Only renders for first-time visitors: check `sessionStorage.getItem("m2_visited")`, set it on mount
- Styled: `bg-primary text-white text-xs font-bold`, fixed position below navbar (top-14)

**Modify `src/pages/Index.tsx`**: Import and render `<LocalTopBar />` after `<AppNavbar />`

## 2. Local Trust Section + Specialty Chips

**Modify `src/components/features/HeroSection.tsx`**:

- Add 3 specialty chips above the headline: "💪 Strength Training", "🏈 Youth Sports Performance", "📱 Online Coaching" — small rounded pills in `bg-card border border-border`
- Add a Local Trust block below the stats bar: MapPin icon + "Grosse Pointe Park, MI", service area text, "Rated 5.0 on Google" with Star icon
- Mobile CTA priority: use `useIsMobile()` from `@/hooks/use-mobile` — on mobile, show only "Schedule In-Person Session →" as the primary CTA button; on desktop, show both Schedule and Enter The Portal side by side

## 3. AppNavbar Desktop Reorganization

**Modify `src/components/layout/AppNavbar.tsx`**:

Replace the current flat `primaryNav` + `secondaryNav` + MORE dropdown with a new structure:

**Desktop nav bar** (hidden on mobile):
- **"Train"** dropdown: In-Person → /schedule, Online → /pricing, For Parents → /for-parents
- **"The App"** dropdown: Pricing → /pricing, Trial → /auth?redirect=/trial-welcome, Features → /the-edge
- **"Results"** → /results (direct link)
- **"Studio"** → /studio-rental (direct link)
- Instagram icon → external link to Instagram profile
- Primary CTA pill button: "Schedule" → /schedule (orange bg)
- Admin/Login/Logout buttons remain

Each dropdown uses a simple `useState` toggle with the same outside-click pattern already in use.

## 4. BottomTabBar (Mobile) Reorganization

**Modify `src/components/layout/BottomTabBar.tsx`**:

Update the "More" sheet content to use sectioned layout:

```
FOR CLIENTS (section header)
  Dashboard | Programs | Progress | Schedule

TRAIN WITH MATT (section header)
  In-Person Training → /schedule
  Online Coaching → /pricing
  For Parents → /for-parents
  Results → /results

THE APP (section header)
  Pricing & Plans → /pricing
  Free Trial → /auth?redirect=/trial-welcome
  Merch → /merch

STUDIO & PARTNERS (section header)
  Studio Rental → /studio-rental
  Web Design → /detroit-web-design
```

Add Instagram icon link at the bottom of the sheet.

Bottom tabs themselves stay: Home, Portal, Shop, Schedule, More.

## Technical Details

- `useIsMobile()` imported from `@/hooks/use-mobile` (already exists)
- Instagram icon: use `Instagram` from lucide-react (available in the package)
- No database changes needed
- 4 files modified, 1 file created

