

## Final Styling Overhaul: High-Contrast Black/White + Orange Accent

**Goal**: Strip all warm brown/sepia tones. Pure deep blacks, crisp whites, one bold accent (the existing orange `#E8621A`). Bold, heavy sans-serif for "M² Training" branding throughout.

---

### 1. CSS Variables Overhaul (`src/index.css`)

Replace all warm-tinted HSL values (`40 5%`, `36 14%`, `36 8%`, etc.) with pure neutral black/white values:

| Token | Current (warm brown) | New (pure B&W) |
|-------|---------------------|-----------------|
| `--background` | `40 5% 7%` | `0 0% 5%` |
| `--foreground` | `36 14% 90%` | `0 0% 95%` |
| `--card` | `40 6% 11%` | `0 0% 9%` |
| `--card-foreground` | `36 14% 90%` | `0 0% 95%` |
| `--secondary` | `40 5% 14%` | `0 0% 12%` |
| `--muted` | `40 4% 19%` | `0 0% 16%` |
| `--muted-foreground` | `36 8% 62%` | `0 0% 55%` |
| `--border` | `40 5% 18%` | `0 0% 15%` |
| `--input` | `40 5% 18%` | `0 0% 15%` |
| `--accent` | `36 14% 90%` | `0 0% 95%` |
| `--accent-foreground` | `40 5% 6.7%` | `0 0% 5%` |

Same treatment for `.dark` block, sidebar tokens, and `--m2-*` custom tokens. Remove `--m2-green` (replace usage with primary orange where needed).

### 2. Font: Bold Heavy Sans-Serif for Branding

- Add `Oswald` (or `Black Ops One` / `Anton`) via Google Fonts import for the "M² TRAINING" brand text.
- Create a `font-brand` utility class: `font-family: 'Oswald', Impact, sans-serif; font-weight: 800;`
- Apply to all instances of "M² Training" / "M² TRAINING" / "M2 Training" text across:
  - `AppNavbar.tsx` (line 29)
  - `HeroSection.tsx` (logo area)
  - Footer text
  - Any other branding references

### 3. Remove Soft Gradients & Glows

- **TronChart.tsx**: Remove the SVG glow filter (`#chartGlow`), reduce gradient opacity to near-zero or replace with flat orange fill.
- **HeroSection.tsx**: Keep the subtle grid background but ensure it uses pure neutral gray, not warm-tinted.
- **shadow-m2 / shadow-m2-hover**: Update `rgba(232,98,26,0.25)` references — these are fine as orange accent shadows. Update the white channel `rgba(255,255,255,0.04)` — keep as-is (neutral).

### 4. Clean Up Colored Text in Components

- **ChallengeSystem.tsx** (lines 168-172): Replace `text-emerald-400`, `text-amber-400`, `text-red-400` difficulty colors with orange accent shades or pure white/gray tones.
- **StatsRow.tsx**: The green/red delta colors — replace green with primary orange for positive, keep destructive red for negative.
- **ProgressCharts.tsx**: Ensure chart colors use only orange accent, white, and gray.

### 5. Tailwind Config (`tailwind.config.ts`)

- Remove `m2-green` from the color map.
- Verify all custom color tokens reference the updated neutral CSS variables.

### 6. Files to Edit

1. `src/index.css` — All CSS variable values
2. `tailwind.config.ts` — Remove m2-green
3. `src/components/AppNavbar.tsx` — Brand font class
4. `src/components/HeroSection.tsx` — Brand font, grid bg neutrals
5. `src/components/progress/TronChart.tsx` — Remove glow filters, flatten gradients
6. `src/components/progress/StatsRow.tsx` — Replace green with orange
7. `src/components/ChallengeSystem.tsx` — Replace colored difficulty text
8. `src/components/ChallengeLeaderboard.tsx` — Check for any colored elements
9. Any other components using warm-tinted inline HSL values

