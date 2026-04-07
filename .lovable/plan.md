

# DJ Conley Sales Package — Visual PDFs + Meeting Materials

## Context
- Your pricing tiers: $499 (Standard) / $1,499 (Professional) / $3,499 (Business). You want $3,499 — that IS your top tier.
- The owner is a "good ol' boys" guy — means he runs on relationships, handshakes, word-of-mouth. He doesn't trust digital marketing because his business has always come from people who know people. This is actually your biggest advantage: **you're not selling him e-commerce or social media — you're selling him a digital business card that makes him look as good as his reputation already is.**
- Key insight: Don't lead with automation or AI. Lead with **credibility and professionalism**. His peers and customers Google him — what they find should match the 51-year legacy.

## What Gets Built

### PDF 1: "The DJ Conley Digital Presence Report" (4-5 pages)
A visual before/after comparison — NOT a sales pitch. Framed as a "report" so it feels informative, not salesy.

**Page 1 — Cover**: "Digital Presence Assessment — D.J. Conley Associates" with their logo colors (navy/red), their address, the date. Clean, professional, no fluff.

**Page 2 — "What Your Customers See Today"**: Side-by-side screenshots showing their current site on mobile vs. one of your demos on mobile. Visual impact — no paragraphs needed. Simple caption: "Your reputation is 51 years strong. Your website should match."

**Page 3 — "The 3 Things Costing You Calls"**: Three visual blocks with icons:
1. **Mobile Experience** — screenshot of their current site on phone (broken/cramped) vs. your demo (clean/tappable)
2. **Google First Impression** — mock Google search result showing how their listing looks now vs. with proper meta/schema
3. **Speed** — simple gauge graphic: "Current site: 4.2s load / Your new site: 1.1s load"

**Page 4 — "What We'd Build For You"**: Three phone-sized mockup frames showing v1, v2, v3 demos — labeled "Option A: Classic Steel", "Option B: Dark Industrial", "Option C: Clean Corporate". Caption: "Pick the one that feels like DJ Conley."

**Page 5 — "The Package"**: Simple, clean breakdown — NO pricing tiers, just ONE number:
- Custom 10+ page website
- Mobile-optimized
- Google Business Profile optimization
- Emergency service banner
- Product catalog with all Cleaver-Brooks lines
- 51 years of history told right
- **$3,499 one-time + $99/mo maintenance**
- "60-day free marketing tools included"

### PDF 2: "Revenue You're Leaving on the Table" (3-4 pages)
This is the automation pitch — but framed as **money lost**, not technology gained. Visual-heavy.

**Page 1 — Cover**: "Revenue Preventer Report — What Happens When You Miss a Call" — dark, bold, urgent.

**Page 2 — "The Missed Call Problem"**: Visual flowchart:
- Phone rings → You're on a job site → Call goes to voicemail → Customer calls your competitor → **You lost $8,000**
- VS: Phone rings → You're on a job site → **Auto-text in 60 seconds**: "Hey, DJ Conley here — saw your call. What do you need?" → Customer responds → **You got the job**
- Big stat callout: "67% of callers who go to voicemail never call back" (industry stat)

**Page 3 — "The Follow-Up Gap"**: Visual timeline showing what happens after you send a quote:
- Day 1: Quote sent → silence
- Day 3: Nothing
- Day 7: Customer went with someone else
- VS with automation: Day 1: Quote sent → Day 2: "Just checking in" text → Day 5: "Any questions?" email → Day 7: "Ready when you are" → **Close rate up 40%**

**Page 4 — "Your Numbers"**: Simple math visual:
- "If you miss 2 calls/week..."
- "And each job averages $5,000..."
- "That's $40,000/month walking out the door"
- "Missed Call Text-Back: $included with maintenance"
- No tech jargon. Just money.

### Design Approach
- **Color palette**: Navy `#003B71` + Red `#C0392B` + Concrete `#f5f0eb` — matches DJ Conley's existing brand
- **Typography**: Plus Jakarta Sans (bold headers) + DM Sans (body) — same as the demo sites
- **Style**: Clean, industrial, zero fluff. Every page is 70% visual, 30% text. No bullet-point walls.
- **Generated with**: ReportLab (Python PDF generation) with embedded images

### Image Generation
- Use Nano banana (gemini-2.5-flash-image) to generate:
  1. A mobile phone mockup frame showing the DJ Conley demo
  2. A "missed call" visual scenario (phone with missed call notification on a job site)
  3. Before/after Google search result comparison
  4. Speed gauge comparison graphic

## Implementation Steps
1. Generate 4 visual assets using AI image generation (edge function or script)
2. Build PDF 1 with ReportLab — cover + 4 content pages
3. Build PDF 2 with ReportLab — cover + 3 content pages
4. QA both PDFs — convert to images, inspect every page
5. Output to `/mnt/documents/djconley-presence-report.pdf` and `/mnt/documents/djconley-revenue-report.pdf`

## Meeting Strategy Note
- **$3,499 is the right number** — it's your Business tier. For a 51-year-old company with industrial clients, this is a no-brainer if positioned right.
- **Don't show the pricing sheet with tiers** — showing cheaper options lets him negotiate down. Show ONE price, ONE package, everything included.
- **"Good ol' boys" translation**: He trusts people, not websites. So your pitch is: "Your website should do for strangers what your handshake does for everyone who already knows you."
- **Don't sell automation hard** — mention it as "included tools" that come with the maintenance. If he bites, expand. If not, the website alone justifies $3,499.

