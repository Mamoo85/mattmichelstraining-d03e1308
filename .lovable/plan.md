

# Plan: Rebuild Youngblood Demo into Full Sales-Ready Mockup

## Context

The current `/demo-youngblood` page is a minimal skeleton (4 capability cards, a partner list, contact form). The pitch package calls for a comprehensive, jaw-dropping homepage redesign demo with 9 sections, real company data, animated elements, and a "Built by Matt Michels" badge. The goal: when the prospect sees this, he thinks "this looks like us, but 10x better."

## What Changes

**Complete rewrite of `src/pages/YoungbloodMockup.tsx`** — expanding from ~120 lines to a full enterprise demo with all 9 sections from the pitch package.

### Sections to Build

1. **Sticky Header** — Logo as styled text ("YOUNGBLOOD | AUTOMATION" with "A Division of H&P Technologies" subtitle), nav links (Solutions, Manufacturers, Engineering, Resources, About), "Request a Quote" (orange) + phone number button. Backdrop blur, hide-on-scroll-down / show-on-scroll-up behavior.

2. **Hero** — Full viewport. CSS geometric grid pattern background (no stock photos). Left-aligned layout on desktop: badge pill ("50+ Years · Warren, MI"), three-line headline with "Total Automation." in electric blue, trust bar checkmarks, two CTAs (orange "Explore Our Solutions" + blue outline "Talk to an Engineer"). Right side: animated CSS concentric circles suggesting precision engineering (hidden on mobile).

3. **Solution Categories** — 6 cards in 3x2 grid: Hydraulics & Lubrication, Pneumatics & Conveyance, Motion Control, Robotics & Vision, Safety/Sensing/Vision, Custom Engineered Solutions. Each with icon, description, "Explore" link, top-border hover animation.

4. **Manufacturer Logos** — Two-row infinite CSS marquee scroll with real partner names: ABB, SICK, Universal Robots, Yaskawa, Eaton, Parker, Bosch Rexroth, Emerson, SMC, Festo, Schunk, Robotiq, IAI, Thomson, Kollmorgen, Norgren, HydraForce, Graco, MTS, Murr Elektronik. Pause on hover.

5. **Value Proposition** — 3 columns: "Stocking Distributor", "Application Engineering", "Custom Manufacturing" with icons and descriptions from pitch doc.

6. **Industries Served** — Grid of animated pill chips: Automotive, Aerospace & Defense, Food & Packaging, Medical, Steel & Heavy Industry, Factory Automation, Consumer Goods, Mobile Equipment, Robotics Integration.

7. **Case Study Teaser** — Full-width dark section with large quote and 4 stat boxes (12 Weeks, 3 Systems, 99.2% Uptime, Warren MI).

8. **Contact Section** — Two-column: left = form (Name, Company, Phone, Email, textarea), right = contact info (address: 23751 Amber Ave, Warren MI 48089, phone: (586) 755-0200, social icons).

9. **Footer** — 4-column layout (Logo+tagline, Solutions list, Resources list, Contact info). Bottom bar with copyright.

### Design Tokens
- Primary bg: `#0a0f1a` (deep navy-black)
- Card surface: `#111827`
- Accent: `#0ea5e9` (electric sky blue)
- CTA accent: `#f97316` (orange)
- Text: `#f1f5f9`, Muted: `#94a3b8`
- Fonts: Rajdhani (headings via Google Fonts link) + Inter (body, already loaded)

### Special Features
- **Demo badge** — Fixed top-right pill: "REDESIGN CONCEPT · Built by Matt Michels Web Design · 313.806.4952" with link to `/detroit-web-design`
- **Scroll-triggered fade-in** — Uses the existing `useInView` hook for section reveals
- **Marquee animation** — Pure CSS infinite scroll for manufacturer names
- **Animated hero illustration** — CSS concentric rotating circles (60s rotation)
- **Smart header** — Hides on scroll down, reappears on scroll up (useEffect with scroll listener)

### Mobile Responsive
- Hero stacks vertically, illustration hidden
- Solution grid becomes 2-column then 1-column
- Hamburger menu for nav
- All touch targets appropriately sized

## Technical Details

- Add `<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&display=swap">` to `index.html` for the industrial heading font
- CSS keyframes for marquee and circle rotation added inline via Tailwind arbitrary values or a small `<style>` block in the component
- No database changes, no new dependencies
- RevealSection from `useInView.tsx` used for scroll animations

## Files Changed

| File | Action |
|------|--------|
| `src/pages/YoungbloodMockup.tsx` | Complete rewrite — 9-section enterprise demo |
| `index.html` | Add Rajdhani font link |

