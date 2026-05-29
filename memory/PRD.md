# Detroit Web Agency — PRD

## Products & Pricing
TechAlert ($99-149/mo) | Demand Radar ($99-499/mo) | FieldDesk ($199/mo) | Missed Call ($49/mo) | Dead Lead ($50/reply) | Reviews ($79/mo) | Website+SEO ($299/mo)

## Session Summary — Everything Built

### Landing Pages
- `/staffing` — Staffing agency page (healthcare + trades variants via ?industry=)
- `/staffing?industry=healthcare` — "We Find Licensed Nurses Before Anyone Else"
- `/staffing?industry=trades` — "We Find Licensed Techs Before Your Competitors"
- `/demand-radar` — 3-tier pricing: Basic $99 / Pro $199 / Enterprise $499
- `/jobs` — Reverse marketplace for candidates to browse employer listings
- `/go/techalert` — City-configurable (9 MI cities via ?city=)
- `/field-service/dispatch` — 3-panel FieldDesk with mobile responsive + FAB

### Postcard Operations Hub
- `AdminPostcardOps.tsx` — Full postcard campaign generator in DWA Admin
- 5 postcard variants: Healthcare Agency, Trades Agency, Nursing Home, Contractor, Supply House
- Each includes: Matt's photo, DWA badge, QR code, "Free 10 Names" offer, "(313) 992-1219"
- Print-ready 6x4 HTML, single download, city batch, or full everything batch
- City-aware QR codes linking to personalized landing pages

### MANDATE: Never mention LARA, scraping, databases, or methods. Always say "We invented a way."

### Key URLs for Postcards
| Audience | Landing URL |
|---|---|
| Healthcare Agency | /staffing?industry=healthcare&src=postcard&city=X |
| Trades Agency | /staffing?industry=trades&src=postcard&city=X |
| Nursing Home | /staffing?industry=healthcare&src=postcard-facility&city=X |
| Contractor | /go/techalert?src=postcard&city=X |
| Supply House | /demand-radar?src=postcard&city=X |

### Edge Functions (10 total this session)
- techalert-sms-alerts, demand-radar-sms-alerts, techalert-weekly-roi
- techalert-drip-processor, techalert-winback, demand-radar-webhook

### Testing: 56/56 tests passed across 4 iterations

## Backlog
- Deploy edge functions to Supabase + schedule crons
- Run LARA scraper to populate real candidate data
- Signal history timeline + leaderboard features
