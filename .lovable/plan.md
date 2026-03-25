

# Plan: Add Social Proof Strip to Pricing Page

## What Changes

**Modify `src/pages/Pricing.tsx`** — Add a 3-testimonial social proof strip after the tier grid (line 549) and before the AI Generator Showcase (line 551).

### Testimonial Data

Three hardcoded testimonial cards targeting different client types:
1. **Adult strength** — Derek R., Foundation Member, Warren MI
2. **Youth parent** — Parent, Grosse Pointe North HS, Pro Member
3. **Online/remote** — Amanda K., Foundation Member, Online

### Layout & Style

- Dark cards (`bg-card border border-border`), orange 5-star row, italic quote, bold white name, orange uppercase tag
- **Desktop**: 3-column grid
- **Mobile**: Horizontal scroll (`flex overflow-x-auto snap-x`) with `min-w-[280px]` cards
- Placed inside a section with heading "What Our Clients Say" in the M² style (small uppercase primary label)

### Implementation

- Add a `PRICING_TESTIMONIALS` array constant with the 3 quotes
- Render after the tier grid closing `</div>` (after line 549), before the AI Generator Showcase
- Uses existing `Star` import from lucide-react and `motion` for fade-in
- No new files, no database changes

## Files Changed

| File | Action |
|------|--------|
| `src/pages/Pricing.tsx` | Add testimonial strip after tier cards grid |

