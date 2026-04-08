

# Detroit Web Agency — Industrial Rebrand & Copy Scrub

## Summary

Strip all "AI" buzzwords from the agency-facing pages, rebrand to an industrial "Digital Engines" voice, update the color palette to deep slate + electric cyan CTAs, and add industrial typography. The training side remains completely untouched.

---

## Technical Details

### 1. Domain Config Update — `src/lib/domainConfig.ts`

Change the tagline from "AI-Powered Web Design & Automation..." to:
**"High-Performance Websites & Automated Systems for Michigan Businesses"**

### 2. AgencyHome.tsx — Full Rewrite

**Hero:**
- H1: "Building Digital Engines for Michigan Businesses."
- Sub: "We engineer high-performance websites and automated systems that capture leads, book appointments, and do the heavy lifting for you."
- Primary CTA: "Run a Free Site Audit" (cyan/cobalt button)
- Secondary CTA: "View All Services"

**Services grid — rename everything:**
- "Web Design" → stays (already clean)
- "AI Receptionist" → **"24/7 Call Routing Engine"** — "Never miss a call. Our automated voice system answers, qualifies, and books leads around the clock."
- "SEO Guard" → stays (already clean)
- "Website Audit" → **"Free Site Diagnostic"** — "Our automated scanner reveals exactly what's costing you leads."
- "Reputation Manager" → **"Review Command Center"** — "Monitor reviews, respond instantly, build 5-star social proof."
- "Computer Repair" → stays

**Stats bar:**
- "AI Receptionist" → **"Call Engine"**

**Trust section — scrub copy:**
- "AI-powered prospecting finds YOUR customers" → **"Automated prospecting finds YOUR customers"**

**CTA section:**
- "Get a free, AI-powered audit" → **"Get a free automated audit of your website in under 60 seconds."**

Remove `Bot` icon import, replace with `PhoneCall` or `PhoneForwarded`.

### 3. ComputerRepair.tsx — Add M2 Branding

Add "M2 Computer Repair" subtitle/badge in the hero. Already clean of AI buzzwords — no copy changes needed.

### 4. SeoGuard.tsx — Copy Scrub

- Line 15: "Monthly AI Report" → **"Monthly Performance Report"**
- Line 94: "✅ AI reports" → **"✅ Automated reports"**
- Line 155: "M² Development" → **"Detroit Web Agency"**

### 5. AppNavbar.tsx — Scrub Nav Labels

- Line 43: "Free Website Audit" label → **"Free Site Diagnostic"**
- CTA button (line 239): "Free Audit" → **"Free Diagnostic"**

### 6. Color Palette — Agency-Only CSS Class

Add an `.agency-theme` CSS utility or use inline Tailwind on AgencyHome. The existing dark theme is already slate-based. Changes:
- Primary CTA buttons: switch from `bg-blue-600` → **`bg-cyan-500 hover:bg-cyan-400 text-slate-950`** (electric cyan, dark text — industrial punch)
- Service card hover borders: `border-blue-500/50` → `border-cyan-500/50`
- Accent icon color: `text-blue-500` → `text-cyan-400`
- Hero gradient: keep `from-blue-950 via-slate-900 to-slate-950` (already industrial)

### 7. Typography — Agency Headings

Add Rajdhani font via `index.html` link tag (Google Fonts). Create a `.font-industrial` utility:
```css
.font-industrial {
  font-family: 'Rajdhani', 'Plus Jakarta Sans', system-ui, sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
```
Apply to AgencyHome H1/H2s and ComputerRepair headings only. Training pages use existing `font-display` / `font-brand`.

### 8. LegalFooter.tsx — No Changes Needed

Already pulls from `getBrandConfig()` which shows "Detroit Web Agency". Clean.

---

## Files Changed

| File | Action |
|------|--------|
| `src/lib/domainConfig.ts` | Edit — scrub tagline |
| `src/pages/AgencyHome.tsx` | Rewrite — new hero, scrubbed copy, cyan palette |
| `src/pages/ComputerRepair.tsx` | Edit — add "M2 Computer Repair" badge |
| `src/pages/SeoGuard.tsx` | Edit — scrub 3 AI references |
| `src/components/layout/AppNavbar.tsx` | Edit — rename 2 labels |
| `src/index.css` | Edit — add `.font-industrial` utility |
| `index.html` | Edit — add Rajdhani font link |

Training side: zero files touched.

