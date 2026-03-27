

# Plan: Restyle Zone Dashboard to Match Zone Portal (Instagram-style)

Rewrite `src/pages/ZoneDashboard.tsx` to adopt the ZonePortal's Instagram-like aesthetic — inline styles, big `rounded-2xl` cards, generous padding, 2-column action grid, and the clean social-app feel that younger users navigate intuitively.

## What Changes

### `src/pages/ZoneDashboard.tsx` — Full restyle

**Header**: Match ZonePortal's inline-styled sticky header — M² logo badge (gradient orange square with "M²" text or real logo), athlete name, "THE ZONE" label, green pulse dot with "Online" text. Cleaner, more Instagram-like.

**Stats Row**: 3-column grid with `rounded-2xl` cards, inline `rgba(255,255,255,0.04)` backgrounds, big bold values centered — matching ZonePortal's stat card style exactly.

**Action Grid**: Switch from 3 cramped buttons to a **2x2 grid** like ZonePortal — Workout Portal (cyan), AI Generator (purple), Fix It Engine (cyan), Submit PR (orange). Each card has colored icon, label, generous `p-5`, `rounded-2xl`. Tapping AI Generator / Fix It switches to the Generate tab.

**Tab Pills**: Keep 4 tabs (Lifts, Generate, Train, Home) but style them as a clean bottom-of-header row or inline pills matching the social-app aesthetic — `rounded-full`, subtle active indicator using orange.

**Tab Content**: All existing lazy-loaded content preserved. Wrap in the same inline-style approach (dark backgrounds, `rgba` borders, `rounded-2xl` containers).

**Coach Chat card**: Match ZonePortal's "Message Coach Matt" card — avatar circle, "Available" badge, full-width `rounded-2xl`.

**Overall aesthetic shift**:
- Replace `zone-glass` / `zone-glow-*` Tailwind utilities with inline `style={{}}` matching ZonePortal exactly
- `rounded-2xl` everywhere (not `rounded-lg`)
- `rgba(255,255,255,0.04)` card backgrounds with `rgba(255,255,255,0.08)` borders
- Background `#0a0a0a`, text `#e5e5e5` / `#fafafa` / `#737373`
- Larger touch targets, more whitespace
- `max-w-md` centered (matching ZonePortal, not `max-w-lg`)

### No other files change

All lazy-loaded components (ProgressCharts, WorkoutsTab, MyPrograms, etc.) still render inside ZoneThemeWrapper for dark CSS variable overrides. Only the shell/chrome of ZoneDashboard changes.

## Key Principle

Keep every feature, tab, data fetch, and modal — just make the wrapper look and feel like the `/zone` page the user loved.

