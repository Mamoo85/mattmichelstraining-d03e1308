

# Plan: Demo Mockup Updates (6 Changes)

## Change 1 — Fix Broken Hero Images (5 files)

Remove the `import heroImg from "@/assets/demo-*-hero.jpg"` line in each file and replace with a `const heroImg = "..."` using the specified Unsplash URLs. The `<img src={heroImg}>` already works with a string, so no JSX changes needed.

**Files:** `PlumberMockup.tsx`, `ElectricianMockup.tsx`, `LandscapeMockup.tsx`, `LawyerMockup.tsx`, `ClinicMockup.tsx`

---

## Change 2 — Fix Plumber Before/After Placeholders

In `PlumberMockup.tsx` lines 130-133, replace the two gray `<div>` placeholders (BEFORE/AFTER) with real `<img>` elements using the provided Unsplash URLs. Keep the card container and label text beneath.

---

## Change 3 — Replace Phone Numbers (5 files)

Update the `PHONE` constant to `"(313) 806-4952"` in all 5 demo files. Also update any hardcoded `tel:` hrefs — though they already use `PHONE.replace(/\D/g, "")`, so changing the constant handles it automatically.

---

## Change 4 — Expand Testimonials (2 files)

**PlumberMockup.tsx:** Replace the single-testimonial section (lines 152-161) with a 3-card grid using `md:grid-cols-3`, dark blue cards (`bg: #0f2035`, border `#1e3a5f`), red stars (`#dc2626`).

**ElectricianMockup.tsx:** Replace the single-testimonial section with a 3-card grid using yellow stars (`#facc15`), dark cards (`bg: #26262e`, border `#3a3a44`).

---

## Change 5 — Add "See Live Demo" Links to WebDesignAgency.tsx

Convert the static `portfolioCards` grid to include demo link pills below each card's feature list. Import `Link` from `react-router-dom`. Add:
- Contractor card: Plumber, Electrician, Roofing demo links
- Local Shop card: Landscaper demo link
- Pro card: Attorney, MedSpa demo links

---

## Change 6 — Create RoofingMockup.tsx + Route

Create `src/pages/RoofingMockup.tsx` following the PlumberMockup pattern with blue accent (`#2563eb`), roofing-specific content (storm damage, full replacement, gutters), 3 testimonials, and quote form.

In `App.tsx`: Add lazy import and route at `/demo-roofing` next to the other demo routes (after line 78 for import, after line 216 for route).

---

## Files Modified
| File | Changes |
|------|---------|
| `src/pages/PlumberMockup.tsx` | Hero import → const, phone number, before/after images, 3 testimonials |
| `src/pages/ElectricianMockup.tsx` | Hero import → const, phone number, 3 testimonials |
| `src/pages/LandscapeMockup.tsx` | Hero import → const, phone number |
| `src/pages/LawyerMockup.tsx` | Hero import → const, phone number |
| `src/pages/ClinicMockup.tsx` | Hero import → const, phone number |
| `src/pages/WebDesignAgency.tsx` | Add Link import, demo link pills under each portfolio card |
| `src/pages/RoofingMockup.tsx` | **New file** — full roofing demo page |
| `src/App.tsx` | Add RoofingMockup lazy import + route |

