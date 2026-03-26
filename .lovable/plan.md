

# Youngblood Mockup Production Refactor

## Summary
Replace all placeholder content with real Youngblood Automation / H&P Technologies corporate data, add Tier 1 Partners section, regional locations section, hero background image, and glassmorphism card styling.

## Changes (single file: `src/pages/YoungbloodMockup.tsx`)

### 1. Data Constants Update
- **solutions array**: Replace 6 cards with 4 focused cards matching the user's exact descriptions (Pneumatics, Hydraulics, Robotics, Sensing)
- **stats array**: Update to reflect "Established 1964" instead of "50+ Years"
- **Hero badge**: Change "50+ Years · Warren, MI" to "Established 1964 · Warren, MI"
- **Hero tagline**: Add "Engineered Solutions for Motion Control, Fluid Power, and Robotic Integration."
- **Add `locations` array**: Warren MI (HQ), Grand Rapids MI, Indianapolis IN, Dayton OH with descriptions
- **Add `tier1Partners` array**: SICK, EATON, EMERSON, UNIVERSAL ROBOTS with subtitles
- **Footer text**: Update "since 1972" to "Established 1964", keep "A Division of H&P Technologies" prominent

### 2. New Section: Tier 1 Partners
- Replace the manufacturer marquee with a prominent 4-column "Tier 1 Partners" row
- Each partner gets an icon-style card with name and specialty subtitle
- Keep the remaining manufacturers in a smaller marquee below
- Glassmorphism card style: `bg-slate-900/40 backdrop-blur-md border border-white/10`

### 3. New Section: Regional Footprint
- Add after Industries section (or replace the generic stats)
- 4-column grid with MapPin icons showing each location, role description
- Glassmorphism styling on each location card

### 4. Visual Polish
- **Hero**: Add background image (`photo-1581091226825-a6a2a5aee158`) with dark overlay, replacing the grid pattern
- **Solutions section**: Add subtle background image (`photo-1565515152650-612b3e2441af`) with heavy dark overlay
- **All cards** (solutions, value props, stats, partners, locations): Apply `bg-slate-900/40 backdrop-blur-md border border-white/10` replacing current `#111827` backgrounds

### 5. Header & Footer
- Header already shows "A Division of H&P Technologies" — keep as-is
- Footer col 1: Update founding year to 1964, keep H&P Technologies reference
- Footer copyright: Update year reference
- Solutions footer links: Update to match new 4 solution names

## Technical Notes
- Single file edit (~400 lines rewrite)
- No new dependencies or database changes
- All existing animations (marquee, spin, pulse) preserved
- RevealSection scroll animations preserved

