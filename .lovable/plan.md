

# Plan: Secret Test Portal — "The Zone" (`/zone`)

A standalone, immersive test portal page at `/zone`. **Not connected to the live site** — no links from any existing page, no shared navigation. Accessible only by typing the URL directly.

## New File: `src/pages/ZonePortal.tsx`

A single self-contained page (~350 lines) with a dark, immersive aesthetic completely different from the rest of the app.

### Sections

1. **Zone Header** — Minimal sticky bar with M² logo mark, user's name from auth, glowing online indicator. No AppNavbar.
2. **Quick Stats Row** — 3 glassmorphic cards: Streak, Workouts This Week, Current Program (mock data for now).
3. **Today's Action Card** — Hero card with gradient border glow, "Start Training" CTA that dispatches `open-workout-zone` event.
4. **Quick Actions Grid** — 2×2 tiles: Workout Portal, AI Generator, Fix It Engine, Submit PR — each with distinct accent color (cyan, purple, orange).
5. **Coach Access** — Full-width "Message Coach Matt" bar with pulse dot.
6. **Bottom Zone Bar** — Fixed custom bottom nav (Home, Train, Progress, Profile) — completely separate from the standard `BottomTabBar`.

### Design

- Background: `#0a0a0a`, no standard site chrome
- Glassmorphism: `backdrop-blur-xl`, semi-transparent cards with subtle border glow
- Neon accents: cyan (`#00f0ff`), orange (brand), purple
- Pulse/glow animations via Tailwind arbitrary values
- Mobile-first, `max-w-md` centered layout, large tap targets

## Route: `src/App.tsx`

Add one lazy route — **not wrapped in ProtectedRoute** since this is a test page:

```
<Route path="/zone" element={<ZonePortal />} />
```

Placed near the other test routes (`/demo-home`). No links added to any navigation or existing page.

## Isolation

- No imports from or connections to the live dashboard
- Action buttons use `window.dispatchEvent` for existing zone events (workout zone, prove-it) but only function if user is logged in
- Uses `useAuth` only for displaying name — works fine if not logged in (shows "Athlete")
- No new dependencies

