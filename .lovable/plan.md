

# Combined Plan: Multi-Tenant Architecture + Prospector Upgrade + Reference Sites

## Summary

Three workstreams: (1) Add HADO SEO to reference sites, (2) upgrade OpenRouter to `sonar-reasoning` model, (3) implement domain-based multi-tenant "One Brain, Two Faces" architecture.

---

## 1. Add HADO SEO Reference Site

**File:** `src/lib/siteTemplates.ts`

Add a new `techSeo` template inspired by HADO SEO's dark-mode, score-comparison layout. This gives the site builder a 5th template option for tech/SaaS clients.

---

## 2. Upgrade Prospector to `sonar-reasoning`

**Files:**
- `supabase/functions/openrouter-research/index.ts` — change model from `perplexity/sonar` → `perplexity/sonar-reasoning`, increase `max_tokens` to 1200
- `supabase/functions/prospect-website-audit/index.ts` — change inline `sonarResearch()` model from `perplexity/sonar` → `perplexity/sonar-reasoning`

`sonar-reasoning` uses chain-of-thought reasoning with real-time search — better for analyzing business pain points and competitive intel than basic `sonar`.

---

## 3. Multi-Tenant "One Brain, Two Faces" Architecture

This is the big one. The site will detect which domain it's on and swap branding, navigation, homepage, and contact info accordingly.

### 3A. Domain Detection Utility

**New file:** `src/lib/domainConfig.ts`

```text
Exports:
- getDomainBrand(): returns "training" | "agency"
- Training domains: mattmichelstraining.com, www.mattmichelstraining.com, *.lovable.app (default)
- Agency domains: detroitwebagent.com, www.detroitwebagent.com
- getBrandConfig(): returns { siteName, tagline, primaryColor, logo, contactPhone, contactEmail, navLinks[], footerInfo }
```

Training config:
- Name: "Matt Michels Training"
- Color: `#e8621a` (orange)
- Nav: Train, App, Store, Schedule (current links)
- Hides: Prospector, SEO tools, web dev, computer repair

Agency config:
- Name: "M2 Web Development"
- Color: Deep blue/slate (`#1e40af`)
- Nav: Services, AI Prospector, SEO Audit, Computer Repair, For Business dropdown
- Shows: All tech/agency products
- Hides: Fitness, training, workout tools

### 3B. Update AppNavbar.tsx

- Import `getBrandConfig()`
- Swap logo, site name, primary color, and nav links based on domain
- Training: current navbar (unchanged)
- Agency: new links — All Services, AI Prospector, SEO Guard, Website Audit, Computer Repair

### 3C. Update Footer

- Swap contact info and company name based on domain
- Training: "Matt Michels Training · Grosse Pointe, MI"
- Agency: "M2 Web Development · Grosse Pointe, MI" with tech-focused contact

### 3D. Agency Homepage

**New file:** `src/pages/AgencyHome.tsx`

High-converting landing page for M2 Web Development:
- Hero: "AI-Powered Web Design & Automation for Michigan Businesses"
- Services grid: Web Design, AI Receptionist, SEO Guard, Prospector, Computer Repair
- Social proof / testimonials section
- CTA: Free Website Audit
- Dark/blue theme matching agency brand

### 3E. Computer Repair Section

**New file:** `src/pages/ComputerRepair.tsx`

- Route: `/computer-repair`
- Local Grosse Pointe/Detroit hardware + remote repair services
- Simple service list + contact form
- Targets local SEO

### 3F. Routing Logic in App.tsx

- Import `getDomainBrand()`
- Wrap the root route (`/`) in a conditional:
  - If `getDomainBrand() === "agency"` → render `AgencyHome`
  - If `getDomainBrand() === "training"` → render current `LandingPage`
- `/admin` and `/dashboard` remain accessible from BOTH domains (shared admin)
- Add routes: `/computer-repair`, `/agency` (direct access fallback)

### 3G. Shared Admin

No changes needed — `/admin` already works via auth + `useIsAdmin()`. Both domains share the same Supabase project, so all data is unified.

---

## Files Changed

| File | Action |
|------|--------|
| `src/lib/domainConfig.ts` | NEW — domain detection + brand config |
| `src/lib/siteTemplates.ts` | Edit — add HADO-inspired tech/SaaS template |
| `src/pages/AgencyHome.tsx` | NEW — M2 Web Development landing page |
| `src/pages/ComputerRepair.tsx` | NEW — local repair service page |
| `src/App.tsx` | Edit — conditional homepage routing + new routes |
| `src/components/layout/AppNavbar.tsx` | Edit — domain-aware branding swap |
| `src/components/layout/Footer.tsx` (or inline) | Edit — domain-aware contact info |
| `supabase/functions/openrouter-research/index.ts` | Edit — model → `sonar-reasoning` |
| `supabase/functions/prospect-website-audit/index.ts` | Edit — model → `sonar-reasoning` |

---

## DNS Prerequisite

After implementation, Matt needs to point `detroitwebagent.com` DNS to the same IP as `mattmichelstraining.com` (185.158.133.1) and add it as a custom domain in the Lovable project settings.

