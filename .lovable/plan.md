

# Plan: Create Test Demo Homepage

**What**: A new standalone test page at `/demo-home` with conversion-optimized fitness coaching homepage copy. Completely isolated from the live site — no changes to existing routes or components.

## Single File to Create

**`src/pages/DemoHomepage.tsx`** — A self-contained page with all sections inline (no new component files). Sections:

1. **Hero** — Headline: "Get Stronger. Stay Healthy. Train With a Coach Who's Done It 10,000 Times." Subheadline about 20 years, thousands of clients, national champions. Two CTAs: "Start Your Transformation" → `/auth`, "See the Results" → `/results`.

2. **How It Works** — 3-step process: (1) Book a free intro call, (2) Get your custom program, (3) Train with expert guidance and accountability.

3. **Proof of Expertise** — Stats strip: 20+ Years, 5,000+ Clients Trained, National Champions Coached, Zero-Injury Record. Certifications: CPT, FMS, CES, IYCA.

4. **App & Coaching Features** — Grid of 6 benefits: Custom Programs, Progress Tracking, Exercise Video Library, Direct Coach Access, Community & Challenges, Nutrition Tools.

5. **Testimonials** — 3 text-only testimonials covering adult strength, youth athlete, and remote coaching lanes.

6. **Final CTA** — "Ready to Train With a Real Coach?" with single conversion button.

7. **Footer** — Simple copyright line with "TEST PAGE" label.

## Route Addition

**`src/App.tsx`** — Add one lazy route: `/demo-home` → `DemoHomepage`. No navigation links added anywhere — accessible only by direct URL.

## Design

- Uses existing Tailwind theme tokens (`bg-background`, `text-foreground`, `text-primary`, `bg-card`, `border-border`)
- Includes `AppNavbar` for consistent navigation
- Mobile-first, single-column layout matching the existing `max-w-xl` pattern
- No new dependencies

