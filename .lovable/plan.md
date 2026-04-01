

# Scale SEO Pages from 100 → 2,000 with Content Diversity

## Current State
- **100 pages** in `seo_page_configs`: 5 trades × 20 cities
- Each page has identical structure (hero, bullets, FAQs, CTA)
- All served at `/services/:slug` via `ContractorSeoPage.tsx`

## Expansion Matrix (2,000 pages)

```text
Category                  Niches    Cities    Pages
──────────────────────────────────────────────────
Contractor Trades           20    ×   40   =   800
Web Design (by industry)    15    ×   40   =   600
Personal Training           10    ×   40   =   400
Life/Performance Coaching    5    ×   40   =   200
──────────────────────────────────────────────────
                                   Total =  2,000
```

**Trades** (20): Plumber, Electrician, HVAC, Roofer, Landscaper, Painter, General Contractor, Concrete, Fencing, Flooring, Kitchen Remodeler, Bathroom Remodeler, Deck Builder, Drywall, Pest Control, Tree Service, Garage Door, Window Installer, Siding, Pressure Washing

**Web Design niches** (15): Restaurant, Dental, Law Firm, Real Estate, Auto Repair, Salon, Gym, Chiropractor, Accountant, Insurance Agent, Veterinarian, Photography, Cleaning Service, Moving Company, Wedding Venue

**PT niches** (10): Youth Athletes, Over-40 Fitness, Post-Rehab, Weight Loss, Strength Training, Sports Performance, Bodybuilding, Functional Fitness, Senior Fitness, Women's Fitness

**Coaching** (5): Career Transition, Entrepreneur Mindset, Work-Life Balance, Leadership, Accountability

**Cities** (40): Detroit, Chicago, Miami, Houston, Dallas, Phoenix, Denver, Atlanta, Nashville, Charlotte, Tampa, Orlando, Austin, San Antonio, Minneapolis, Indianapolis, Columbus, Cleveland, Pittsburgh, St Louis, Kansas City, Milwaukee, Cincinnati, Raleigh, Jacksonville, Memphis, Louisville, Las Vegas, Oklahoma City, Richmond, Birmingham, Tucson, Omaha, Albuquerque, Boise, Des Moines, Grosse Pointe, Warren, Sterling Heights, St Clair Shores

## Content Diversity Strategy (Avoiding Google Penalties)

Each category gets a **different AI system prompt** with unique angles:
- **Contractor**: Focus on licensing, insurance, seasonal demand, local building codes
- **Web Design**: Focus on industry-specific features (online ordering for restaurants, booking for dentists, listings for real estate)
- **Personal Training**: Focus on biomechanics, injury prevention, age-specific programming
- **Coaching**: Focus on transformation stories, methodology, accountability frameworks

Each prompt includes the city name for localized references (neighborhoods, landmarks, climate).

## Database Change
- Add `category` column to `seo_page_configs` to filter/organize pages
- Update existing 100 rows to `category = 'contractor'`

## Implementation Steps

| # | Task |
|---|------|
| 1 | Migration: add `category` column, update existing rows |
| 2 | Add anon SELECT policy to `seo_page_configs` (pages are public) |
| 3 | Run batch generation script (~2,000 AI calls via Lovable AI Gateway using `gemini-2.5-flash-lite` at ~$0.001/page = ~$2 total) with 4 distinct system prompts per category |
| 4 | Update `ContractorSeoPage.tsx` to handle all categories (adjust CTA links based on category) |

## Cost
- ~$2 one-time AI generation cost
- ~4MB database storage
- Generation time: ~45 min with 1.2s delay between calls

