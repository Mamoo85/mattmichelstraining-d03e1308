

## Plan: Agency Brand Consistency Pass + Banner Integration + Link Audit

### What's Happening

Three pages linked from the agency landing page still use the old M2 Training orange palette (#e8621a / orange-500), and the landing page footer shows the wrong email (matt@mattmichelstraining.com instead of matt@detroitwebagent.com). The uploaded banners are reference images showing the desired "secure agency" aesthetic — they won't be embedded directly but will inform styling decisions.

---

### Part 1: Re-skin 3 Orange Pages to Agency Cyan Theme

These pages are directly linked from the agency landing page and break brand continuity when visited:

**`src/pages/AllServices.tsx`** (7 orange references):
- Replace all `orange-500`, `orange-400`, `orange-600` with cyan equivalents (`cyan-400`, `cyan-500`)
- Update background from `bg-slate-900` to the agency obsidian `#0a0a0f`
- Replace `border-l-orange-500` card accents with `border-l-cyan-500`
- Update CTA buttons to cyan gradient matching agency hero style
- Add dot-grid background pattern to hero section for consistency

**`src/pages/AIPhoneAnswering.tsx`** (3 orange references):
- Replace `bg-orange-500/10 text-orange-400` badge with cyan
- Replace `text-orange-400` price with cyan
- Replace `bg-orange-500` step circles with cyan
- Rename product label from "AI Phone Answering" to "24/7 Call Routing Engine" (per brand guidelines)

**`src/pages/DigitalFoundation.tsx`** (14 `#e8621a` references):
- Global find/replace `#e8621a` → `#22d3ee` (electric cyan)
- Replace `#d4570f` hover states → `#06b6d4`
- Update SEO title from "M² Development" to "Detroit Web Agency"
- Fix success page phone link color

---

### Part 2: Landing Page Link Audit + Footer Fix

**Footer email fix in `AgencyHome.tsx` (line 351)**:
- Change `matt@mattmichelstraining.com` → `matt@detroitwebagent.com`

**Link verification** — every link on AgencyHome currently points to:
| Link | Target | Status |
|---|---|---|
| Hero CTA | `/ai-website-audit` | OK — page exists |
| Phone CTA | `tel:+13138064952` | OK |
| Web Design card | `/web-design-services` | OK |
| Call Routing card | `/ai-phone-answering` | OK — needs reskin (Part 1) |
| SEO Guard card | `/seo-guard` | OK |
| Free Diagnostic card | `/ai-website-audit` | OK |
| Review Command card | `/ai-reputation-dashboard` | OK |
| Computer Repair card | `/computer-repair` | OK |
| Footer service links | Same as above | OK |
| Final CTA | `/ai-website-audit` | OK |
| LinkedIn | External | OK |
| Facebook | `facebook.com` (generic) | Should update to actual page or remove |

---

### Part 3: Banner-Inspired Aesthetic Upgrades

The uploaded banners show a "secure tech agency" visual language: brushed metal testimonial cards, gear/cog process icons, vault-door CTAs, and suited agent imagery. These will be translated into CSS/Tailwind — not embedded as images.

**Testimonials section (AgencyHome.tsx lines 227-253)**:
- Add brushed-metal card effect: `bg-gradient-to-br from-slate-800/80 to-slate-900/80` with metallic border shimmer
- Add `[VERIFIED INTEL]` badge styling matching banner
- Increase card visual weight with stronger borders

**Secure Development Lifecycle section (lines 257-283)**:
- Already matches the banner's 4-step numbered flow — just refine with gear/cog-style icon backgrounds and connecting arrow lines between steps

**Final CTA section (lines 286-301)**:
- Add vault-door inspired styling: stronger radial glow, more dramatic typography
- Update copy to "Initiate Secured Partnership" (already there) with bolder visual treatment

---

### Files Modified

| File | Changes |
|---|---|
| `src/pages/AllServices.tsx` | Full orange → cyan reskin, agency dark theme |
| `src/pages/AIPhoneAnswering.tsx` | Orange → cyan, rename to Call Routing Engine |
| `src/pages/DigitalFoundation.tsx` | `#e8621a` → `#22d3ee` throughout, update branding |
| `src/pages/AgencyHome.tsx` | Fix footer email, polish testimonials + CTA sections |

