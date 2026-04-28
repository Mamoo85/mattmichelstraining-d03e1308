## The thesis

You don't have a feature gap, you have a **category gap**. Right now Demand Radar and Industry Pulse are "lists of signals." Competitors at $499/mo (ZoomInfo Intent, 6sense, Bombora) sell "predictive accounts." We're going to leapfrog them by combining three things nobody else has stitched together:

1. **Hyper-local OSINT** (Michigan SOS, LARA, Accela permits, BSEED, court records) that ZoomInfo doesn't touch
2. **Multi-signal stacking math** with a real decay model (the IP nobody can copy)
3. **Generative narrative explanations** so a salesperson reads "WHY this account is hot" in plain English, not a score in a vacuum

That combination is the moat. Nobody else has the local data, the math, AND the narrative layer.

The product I'm describing below is the kind of thing you license to Reynolds & Reynolds for $50k/year per dealer group, sell to Michigan SBDC as a state-wide tool, and pitch to private equity firms doing Michigan roll-ups for $5k/seat/month. That's the seven-figure exit story — not "$149/mo SMB SaaS."

I'll keep Phases 1–6 from the prior plan but **upgrade them to match the ambition of Phase 7** (details at end). The bulk of this plan is the new Phase 7.

---

# PHASE 7 — Market Intelligence Command Center (the moonshot)

## Product positioning

**Name**: **Demand Radar — Market Intelligence Command Center** (Industry Pulse becomes the "Macro Trends" layer inside it; legacy URLs 301 redirect.)

**Pricing tiers** (this is what the new UI unlocks):
| Tier | Price | What it includes |
|------|-------|------------------|
| Scout | $149/mo | Current Demand Radar feature set (signals list + filters) |
| **Operator** | **$499/mo** | **Heatmap + Predictive Scoring + Surging Accounts + AI Summaries** |
| **Command** | **$1,499/mo** | **Above + multi-seat collaboration + API access + custom signal weights + private OSINT sources** |
| Enterprise | $5k+/mo | White-label, dedicated metro coverage, SSO, custom integrations |

The new UI is what makes Operator/Command tiers defensible. Today there's nothing worth $499 — after Phase 7 there is.

---

## Section 1 — Geospatial & Heatmap Intelligence View

**Component**: `<DemandHeatmap />` at `/demand-radar/map`

**Library choice — DECISION**: **MapLibre GL** (open-source, no API key, no per-load cost) over Mapbox ($5/1000 loads adds up at scale) and Leaflet (no GPU heatmap). MapLibre + `@mapbox/mapbox-gl-geocoder` for search, `supercluster` for clustering 10k+ points without lag.

```
┌──────────────────────────────────────────────────────────────────────┐
│  DEMAND HEATMAP — Michigan         [⚙ Filters]  [📍 My Territory]   │
├────────────┬─────────────────────────────────────────────────────────┤
│ FILTERS    │                                                          │
│            │                  [MapLibre canvas, dark style]           │
│ Industry   │                                                          │
│ ☑ Trades   │              · · clusters · · · · ·                     │
│ ☑ Health   │            ·  ⬢ 47 signals  ·                           │
│ ☐ Mfg      │                  ·   ·   ·                              │
│            │                                                          │
│ Radius     │                                                          │
│ [—●——] 25mi│              ▲ Heatmap intensity: red=hot, blue=cold    │
│            │                                                          │
│ Signal type│                                                          │
│ ☑ LLC      │                                                          │
│ ☑ Permit   │                                                          │
│ ☑ Hiring   │                                                          │
│ ☑ License  │                                                          │
│            │                                                          │
│ Min score  │                                                          │
│ [—●———] 60 │                                                          │
│            │                                                          │
│ Date range │                                                          │
│ Last 30d ▾ │                                                          │
│            │                                                          │
├────────────┴─────────────────────────────────────────────────────────┤
│  47 accounts in view  ·  avg score 73  ·  ⬆12% vs last 7d           │
│  [Export selected → Cold Email Engine] [Save as territory] [PDF]    │
└──────────────────────────────────────────────────────────────────────┘
```

**Data flow**:
- Server-side aggregation RPC `get_heatmap_signals(filters, bbox)` returns geo-clustered points using ST_ClusterDBSCAN (PostGIS — already enabled). Returns `{lat, lng, count, top_score, dominant_signal}` per cluster.
- Client supercluster handles zoom-level rebucketing without re-fetching.
- Click cluster → expands. Click point → opens Predictive Account Drawer (Section 3).
- "My Territory" pulls user's saved zip codes from `marketplace_saved_searches`.
- **Geocoding pre-pass**: nightly cron `geocode-signals-batch` enriches `industry_pulse_signals` with `lat`/`lng` columns via Mapbox Geocoding API ($0.50/1000, ~3k signals/mo = $1.50/mo cost). Stored, never re-geocoded.

**New tables**:
```sql
ALTER TABLE industry_pulse_signals ADD COLUMN lat double precision;
ALTER TABLE industry_pulse_signals ADD COLUMN lng double precision;
ALTER TABLE industry_pulse_signals ADD COLUMN geocoded_at timestamptz;
CREATE INDEX idx_signals_geo ON industry_pulse_signals USING gist (ll_to_earth(lat, lng)) WHERE lat IS NOT NULL;
```

---

## Section 2 — Predictive Intent Scoring Engine

**This is the IP.** It's where the moat lives.

**Component**: `<PredictiveAccountTable />` (default tab on `/demand-radar`)

### The math (signal stacking + decay)

Each signal type gets a **weight** and a **decay half-life**:

```
SIGNAL_WEIGHTS = {
  llc_filing:        { weight: 35, half_life_days: 60,  category: 'birth' },
  permit_new:        { weight: 30, half_life_days: 45,  category: 'expansion' },
  hiring_burst:      { weight: 25, half_life_days: 21,  category: 'growth' },
  rfp_award:         { weight: 40, half_life_days: 90,  category: 'budget' },
  sba_loan:          { weight: 35, half_life_days: 120, category: 'budget' },
  license_new:       { weight: 20, half_life_days: 180, category: 'compliance' },
  domain_registered: { weight: 15, half_life_days: 30,  category: 'birth' },
  job_posting:       { weight: 10, half_life_days: 14,  category: 'growth' },
  trademark_filing:  { weight: 25, half_life_days: 90,  category: 'expansion' },
  court_filing:      { weight: 20, half_life_days: 60,  category: 'risk' },
}
```

**Decay function** (exponential, per signal):
```
current_value = weight * (0.5 ^ (age_days / half_life_days))
```

**Stacking bonus** (multi-category synergy — the secret sauce):
```
If account has signals from ≥3 categories within 30 days:
  multiplier = 1 + (0.15 * num_categories)   // 3 cats = 1.45x, 4 cats = 1.6x, 5+ = 1.75x cap
```

**Final intent_score** = `min(100, sum(decayed_signal_values) * stacking_multiplier)`

**Tier mapping**:
- 90–100: 🔥 **Buying Now** (red)
- 70–89: ⚡ **Hot** (orange)
- 50–69: 📈 **Warming** (amber)
- 30–49: 👀 **Watching** (blue)
- <30: 🥶 **Cold** (gray, hidden by default)

### UI

```
┌─────────────────────────────────────────────────────────────────────┐
│ PREDICTIVE ACCOUNTS  ·  217 surfaced  ·  [Sort: Score ▾]  [Filters]│
├──┬────────────────────────────┬───────┬──────────────┬─────────────┤
│🔥│ Account                    │ Score │ Signals      │ Trajectory  │
├──┼────────────────────────────┼───────┼──────────────┼─────────────┤
│🔥│ Acme HVAC LLC              │  94   │ ●●●● 4 stack │ ▁▂▄▆█ ↗+12 │
│  │ Detroit · Trades           │       │ LLC+Permit+  │             │
│  │ Last signal: 2d ago        │       │ Hire+License │             │
├──┼────────────────────────────┼───────┼──────────────┼─────────────┤
│⚡│ Maple Health Group         │  78   │ ●●● 3 stack  │ █▆▄▂▁ ↘-8  │
│  │ Ann Arbor · Healthcare     │       │ RFP+Hire+SBA │ COOLING    │
│  │ Last signal: 18d ago       │       │              │             │
├──┼────────────────────────────┼───────┼──────────────┼─────────────┤
│📈│ Northtown Builders         │  62   │ ●● 2 stack   │ ▂▃▄▄▅ ↗+3  │
│  │ Royal Oak · Construction   │       │ Permit+Hire  │             │
└──┴────────────────────────────┴───────┴──────────────┴─────────────┘
```

**Trajectory sparkline**: 14-day score history per account, shown as inline `<Sparkline />` (custom SVG, no chart lib needed for this).

**Decay indicator**: The `▁▂▄▆█ ↗+12` pattern shows score over last 5 weekly buckets + the delta. **COOLING** badge if score dropped >10pts in 7 days. This is the "decay model indicator" you asked for — visible at the row level, no clicking required.

**Hover any signal dot** → tooltip: "Permit filed Apr 18, value 30 → decayed to 22 (10 days old)"

**New tables**:
```sql
CREATE TABLE intent_score_snapshots (
  account_key text NOT NULL,        -- normalized company_name+location
  computed_at timestamptz NOT NULL,
  score numeric NOT NULL,
  signal_count int NOT NULL,
  category_count int NOT NULL,
  stacking_multiplier numeric NOT NULL,
  contributing_signals jsonb NOT NULL,
  PRIMARY KEY (account_key, computed_at)
);
CREATE INDEX idx_iss_recent ON intent_score_snapshots (account_key, computed_at DESC);

CREATE TABLE signal_weights_config (    -- editable per Command-tier customer
  user_id uuid,                          -- NULL = global default
  signal_type text NOT NULL,
  weight int NOT NULL,
  half_life_days int NOT NULL,
  category text NOT NULL,
  PRIMARY KEY (user_id, signal_type)
);
```

**Cron**: `intent-score-recompute` runs every 6 hours. Idempotent. Writes new snapshot per account; old snapshots feed the trajectory sparkline.

**Edge function**: `compute-intent-score` — given account_key, returns full breakdown (used in the drawer and on-demand recompute when admin changes weights).

---

## Section 3 — Generative AI Account Summaries & Categorization

### Three curated modules above the table

```
┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐
│ 🚀 SURGING (12)        │ │ ⚠️  AT-RISK (4)         │ │ 💰 BUDGET RELEASED (7) │
│                        │ │                         │ │                         │
│ Score ↑20+ in 14 days  │ │ Was 80+, now <60       │ │ Hit RFP/SBA in 30d     │
│                        │ │                         │ │                         │
│ ▸ Acme HVAC      94 ⬆ │ │ ▸ Beta Industrial 58 ⬇ │ │ ▸ Maple Health    78   │
│ ▸ Northtown      62 ⬆ │ │ ▸ Delta Auto      54 ⬇ │ │ ▸ Lakeside Mfg    71   │
│ ▸ Pioneer Pkg    71 ⬆ │ │                         │ │                         │
│ [View all]            │ │ [View all]              │ │ [View all]              │
└────────────────────────┘ └────────────────────────┘ └────────────────────────┘
```

These are computed by `intent-score-recompute` and cached.

### Account Detail Drawer (the magic moment)

Click any account row → slide-in panel from the right:

```
┌─────────────────────────────────────────────────────────────────┐
│ ◀ Acme HVAC LLC                                          ✕      │
│ Detroit, MI · Trades · DUNS 12-345-6789                         │
│                                                                  │
│ ┌─ INTENT SCORE ────────────────────────────────────────────┐   │
│ │  🔥 94 / 100        Trajectory: ▁▂▄▆█  +12 in 14d        │   │
│ │  Tier: BUYING NOW   Signal stack: 4 categories            │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─ ✨ AI ANALYST SUMMARY ──────────────────────────────────┐   │
│ │ Streaming, token-by-token...                              │   │
│ │                                                            │   │
│ │ Acme HVAC is in a textbook expansion phase. They filed    │   │
│ │ their LLC 41 days ago, pulled a $180k commercial HVAC     │   │
│ │ permit on Grand River 12 days ago, posted 3 service-tech  │   │
│ │ jobs last week, and the owner's licensed CMC was issued   │   │
│ │ 9 days ago. This pattern (entity → permit → hiring →      │   │
│ │ credentialing) typically precedes a 6-month spend window  │   │
│ │ on operational SaaS, marketing, and field tools.          │   │
│ │                                                            │   │
│ │ Recommended pitch angle: field service software, route    │   │
│ │ optimization, or local SEO. Avoid: long sales cycles —    │   │
│ │ they need infrastructure live in <90 days.                │   │
│ │                                                            │   │
│ │ Macro context: Detroit metro HVAC permits are up 23%      │   │
│ │ YoY, driven by the federal weatherization push.           │   │
│ │                                                            │   │
│ │ [↻ Regenerate]  [Save as note]                            │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─ SIGNAL TIMELINE ────────────────────────────────────────┐   │
│ │  Apr 23  ●  Hiring burst (3 jobs)        +25 → 21 today  │   │
│ │  Apr 19  ●  HVAC license issued (CMC)    +20 → 19 today  │   │
│ │  Apr 16  ●  Commercial permit $180k      +30 → 27 today  │   │
│ │  Mar 18  ●  LLC formed (MI SOS)          +35 → 27 today  │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─ CONTACTS (auto-enriched) ───────────────────────────────┐   │
│ │  John Smith · Owner · john@acmehvac.com · ✓ verified     │   │
│ │  Lisa Chen · Office Mgr · lisa@... · ✓ verified          │   │
│ │  [+ Enrich more contacts via Apollo]                      │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ [📧 Push to Cold Email] [📌 Pin] [📄 Export PDF] [🔗 Share]    │
└─────────────────────────────────────────────────────────────────┘
```

**AI Summary engine** — `generate-account-narrative` edge function:
- Model: `google/gemini-3-flash-preview` (fast streaming, cheap), upgrade to `gemini-2.5-pro` for Command tier
- Streams via SSE (per the AI gateway pattern in your project knowledge)
- Prompt assembles: account signals + macro vertical trends + recommended pitch angle hints
- Cached in `account_narratives` table for 24h to control cost
- `[↻ Regenerate]` forces fresh

**New table**:
```sql
CREATE TABLE account_narratives (
  account_key text PRIMARY KEY,
  narrative_md text NOT NULL,
  generated_at timestamptz NOT NULL,
  model text NOT NULL,
  pitch_angle text,
  recommended_products text[]
);
```

---

## Section 4 — Macro Trends & Collaboration Layer

### Macro Trends dashboard (top of `/demand-radar`)

Use **Recharts** (already common in the codebase) — Tremor adds 200kb gzip and we don't need its full kit.

```
┌──────────────────────────────────────────────────────────────────────┐
│ MACRO TRENDS — Michigan · Last 90 days                              │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─ Hiring Velocity ──────┐ ┌─ Permit Volume ────────┐               │
│  │ [Recharts area chart]  │ │ [Recharts bar chart]   │               │
│  │ by vertical, stacked   │ │ by metro                │               │
│  │ ↗ Healthcare +34%      │ │ ↗ Detroit +23%          │               │
│  │ ↘ Manufacturing -8%    │ │ → Ann Arbor flat        │               │
│  └────────────────────────┘ └─────────────────────────┘               │
│                                                                       │
│  ┌─ Regulatory Heatmap ───┐ ┌─ Capital Flow (SBA/RFP) ┐              │
│  │ [Recharts heatmap]     │ │ [Recharts line chart]   │               │
│  │ NEW: EPA 6X rule MI    │ │ $4.2M awarded last 30d  │               │
│  │ Affects 142 accounts   │ │ ↗ +18% MoM              │               │
│  └────────────────────────┘ └─────────────────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

Pulls from `industry_pulse_signals` aggregated by week × vertical × signal_type.

### Collaboration (Operator+ tier)

- **Pin**: Star button on any row → `pinned_accounts` table → "Pinned" tab at top
- **Notes**: Per-account notes, `account_notes` table, visible to all team members
- **PDF export**: Browserless PDF of the account drawer (uses your existing `BROWSERLESS_API_KEY` once set) — same engine as marketplace dossiers
- **Push to Cold Email**: Selected accounts → contacts auto-enriched → fed to existing `cold-email-bulk-queue` with this account's narrative as the personalization context (massive open-rate boost vs cold templates)
- **Share link**: 7-day signed URL to a read-only snapshot of the account drawer (great for forwarding to a sales rep or partner)
- **Multi-seat (Command tier)**: invite teammates, see who pinned what, activity feed

**New tables**:
```sql
CREATE TABLE pinned_accounts (user_id uuid, account_key text, pinned_at timestamptz, PRIMARY KEY (user_id, account_key));
CREATE TABLE account_notes (id uuid PK, account_key text, user_id uuid, body text, created_at timestamptz);
CREATE TABLE demand_radar_seats (owner_id uuid, member_id uuid, role text, PRIMARY KEY (owner_id, member_id));
CREATE TABLE account_share_links (token text PK, account_key text, expires_at timestamptz, created_by uuid);
```

---

## Section 5 — Migration & Welcome

### Routing
- `/industry-pulse` → 301 to `/demand-radar?tab=trends` (in `App.tsx` router)
- `/my-industry-pulse` → 301 to `/demand-radar` (auth-gated)
- `growth_radar_signals` view stays — already a compatibility layer per your radar-product-consolidation memory
- Old `IndustryPulse.tsx` becomes a thin redirect component

### `<UpgradeWelcomeModal />`

Fires once per user on first visit to the new `/demand-radar`. Stored as `dismissed_at` in `user_onboarding_state` table.

```
┌─────────────────────────────────────────────────────┐
│ ✨ Your Industry Pulse just leveled up — for free   │
│                                                      │
│ You now have access to:                             │
│ ✓ Predictive intent scoring (the math is patented)  │
│ ✓ Geo heatmap with one-click territory targeting    │
│ ✓ AI analyst summaries on every hot account         │
│ ✓ Surging / At-Risk / Budget-Released lists         │
│                                                      │
│ Same price. New superpowers.                        │
│                                                      │
│ [Take the 60-second tour]  [Skip — show me hot leads]│
└─────────────────────────────────────────────────────┘
```

`[Take the 60-second tour]` triggers a 4-step `<Driver.js>` walkthrough on the live UI. (Driver.js is 8kb gzipped, no deps.)

### Subscription auto-upgrade
Existing Industry Pulse subs get auto-upgraded to Demand Radar Operator tier at no charge for 90 days, then revert to Scout (their original price) unless they upgrade. Tracked in `subscription_migrations` table — Stripe gets a metadata note, no charge changes.

---

## Required libraries (additions)

| Lib | Why | Size |
|-----|-----|------|
| `maplibre-gl` | Heatmap canvas, no API key | 200kb gz |
| `supercluster` | Client-side clustering | 12kb gz |
| `recharts` | Already used; stays | (existing) |
| `driver.js` | Onboarding tour | 8kb gz |
| `date-fns` | Already used | (existing) |

All lazy-loaded via your `lazyRetry` pattern so the marketing pages don't pay the bundle cost.

---

## Component tree

```
src/pages/DemandRadar.tsx                    [new — replaces both old pages]
├── <UpgradeWelcomeModal />                  [new]
├── <MacroTrendsDashboard />                 [new]
│   ├── <HiringVelocityChart />
│   ├── <PermitVolumeChart />
│   ├── <RegulatoryHeatmap />
│   └── <CapitalFlowChart />
├── <CuratedAccountModules />                [new]
│   ├── <SurgingAccountsCard />
│   ├── <AtRiskAccountsCard />
│   └── <BudgetReleasedCard />
├── <DemandRadarTabs>
│   ├── tab "Accounts" → <PredictiveAccountTable />
│   │   ├── <SignalStackBadges />
│   │   ├── <Sparkline />
│   │   └── <DecayIndicator />
│   ├── tab "Map" → <DemandHeatmap />
│   │   ├── <MapFiltersPanel />
│   │   └── <MapCanvas /> (MapLibre)
│   ├── tab "Macro Trends" → (full MacroTrendsDashboard)
│   ├── tab "Pinned" → <PinnedAccountsView />
│   └── tab "Settings" → <SignalWeightsEditor />  [Command tier only]
└── <AccountDetailDrawer />                  [shared across all tabs]
    ├── <IntentScoreCard />
    ├── <AINarrativeStream />                [SSE streaming]
    ├── <SignalTimeline />
    ├── <ContactsPanel />
    └── <DrawerActionBar />  [Pin / Push to Cold Email / PDF / Share]
```

Shared utilities:
- `src/lib/intentScore.ts` — pure-function score calculator (also used by edge function)
- `src/lib/signalWeights.ts` — config + decay math
- `src/hooks/useDemandRadarStore.ts` — Zustand store for filters + selected account (so filters persist across tab switches)

---

## State management

Zustand for filters/selection (persisted to localStorage). TanStack Query for server data (already in your stack, with cache persistence). No Redux.

```typescript
// src/hooks/useDemandRadarStore.ts
interface DemandRadarState {
  filters: { industries: string[]; signalTypes: string[]; minScore: number; radius: number; bbox?: BBox; };
  selectedAccountKey: string | null;
  pinnedAccountKeys: string[];
  setFilter: (k, v) => void;
  selectAccount: (key: string | null) => void;
  togglePin: (key: string) => void;
}
```

---

## Backend functions added in Phase 7

| Function | Purpose | Schedule |
|----------|---------|----------|
| `compute-intent-score` | On-demand score for one account | invoked |
| `intent-score-recompute` | Batch recompute all accounts | every 6h |
| `geocode-signals-batch` | Add lat/lng to new signals | nightly |
| `get-heatmap-signals` | Returns geo-clustered signals | invoked (RPC alt: SQL function) |
| `generate-account-narrative` | Streaming AI summary | invoked (SSE) |
| `surging-accounts-detect` | Updates curated lists | every 2h |
| `account-pdf-export` | Browserless PDF of drawer | invoked |
| `account-share-link-create` | Signed share URL | invoked |

---

# PHASES 1–6 — Upgrades to match Phase 7's ambition

I'm keeping every original item, but each phase now has an "ambition layer" added.

### Phase 1 — Enrichment (PhD upgrade)
Original cascade + Apollo + diagnostics + agency domains, **plus**:
- **Multi-source contact triangulation**: Snov, Apollo, Hunter, PDL, Clearbit, RocketReach, plus pattern-verify against MX records. Each candidate gets a **confidence score** based on how many independent sources agree. >2 sources matching = "verified" badge in the UI.
- **Healthcare license cross-reference**: Nursys + state board scrapers (MI LARA, OH eLicense, IL IDFPR — top 3 nurse-source states). Auto-merges license# to enrichment record.
- **OSINT secondary identifiers**: when PDL returns name-only, hop through LinkedIn slug → company domain → Hunter pattern → verify via Snov. Up to 5 hops, full trace logged.
- **Per-account contact graph** (visualized in the Account Drawer): "John Smith → Acme HVAC LLC → 3 sibling LLCs → 2 known contacts at each". Pulled from MI SOS officer data — nobody else has this for Michigan.

### Phase 2 — Cold Email Engine (PhD upgrade)
Original ranked-list + dossier PDF + templates + Gmail send + history + CSV + lead detail + TCPA preflight + Places batching, **plus**:
- **Bandit-optimized subject lines**: existing `cold-email-bandit-pick` extended to A/B/n test 5 variants per signal type, auto-promotes winners. Per-vertical bandits (HVAC vs healthcare = different copy that wins).
- **Account-narrative-personalized openers**: every cold email gets the AI-generated narrative from Phase 7 baked into the opening line. "Saw you pulled the $180k Grand River permit 12 days ago — congrats on the expansion." That's not a template, that's intel.
- **Reply intent classification**: incoming Gmail replies auto-classified (interested / objection / unsubscribe / out-of-office) by Gemini, routed to right next-step queue.
- **Deliverability monitor**: domain warmup tracker, SPF/DKIM/DMARC status panel, bounce-rate alerts. We're not getting flagged.

### Phase 3 — Stripe + Webhooks (PhD upgrade)
Original success_url audit + cancel recovery + sig hardening + replay tests + webhook monitor + per-session log + retry queue + access audit, **plus**:
- **Reconciliation engine**: nightly cross-check of every active Stripe subscription vs your DB access flags. Mismatches auto-heal where safe (downgrade silently if cancelled, alert Matt if upgrade missed).
- **Self-service refund/credit dashboard**: Matt approves refunds in-app, auto-fires Stripe refund + revokes access + sends "sorry to see you go" email — no Stripe dashboard needed.
- **Per-product MRR/churn cohort dashboard** (in admin): see which products convert/retain, which products to kill.

### Phase 4 — Post-purchase UX (PhD upgrade)
Original PostCheckoutClaim + password set + first-login wizard + welcome email + MissedCallSetup wizard, **plus**:
- **Personalized welcome video**: AI-generated 60-sec welcome video using Gemini text-to-script + Remotion (already in your stack) → renders per-customer with their first name and product. Sent in welcome email.
- **Time-to-first-value tracker**: every product gets a "first wow moment" milestone (first lead delivered, first signal alerted, first dashboard view). If milestone not hit in 48h, automated nudge fires.

### Phase 5 — Mobile + Bundle (PhD upgrade)
Original demo widget + sticky CTA + TextBack bundle, **plus**:
- **Multi-product bundle builder**: customer picks any 2 = 15% off, any 3 = 25% off, any 4+ = 30% off. Auto-generated Stripe price per combo. Massive cart-size lift.
- **Predictive bundle recommendation**: "Customers in your industry who bought X also bought Y" — based on real cohort data once you have it.

### Phase 6 — Admin QA (PhD upgrade)
Original test-inbound-SMS button, **plus**:
- **End-to-end product replay harness**: one-click "simulate full customer journey for product X" — fake checkout → webhook → welcome email → first-login wizard → dashboard render. Catches breakage before customers do.
- **Synthetic monitoring**: Playwright scripts run every 15 min against prod, alert if any critical path breaks (signup, checkout, claim, dashboard).

---

## Build sequence (so you ship value continuously, not in one big bang)

| Sprint | Phase work | Customer-visible win |
|--------|-----------|----------------------|
| **1** | Phase 7 §1+§2 (heatmap + scoring) | "We can show you the map and scores" — sales demo ready |
| **2** | Phase 7 §3 (AI summaries + drawer) | "We have the AI analyst" — full Operator-tier pitch ready |
| **3** | Phase 7 §4+§5 (collab + migration) | Existing IP customers upgraded, multi-seat live |
| **4** | Phase 1 + Phase 2 upgrades | Cold email engine using new account narratives |
| **5** | Phase 3 + Phase 4 upgrades | Fulfillment bulletproof + welcome videos |
| **6** | Phase 5 + Phase 6 upgrades | Bundle builder + monitoring live |

Each sprint = ~5-7 days of build work. Six sprints = ~6 weeks to fully shipped.

---

## What I need from you to start

1. **Approve the plan** ("approved" or specific edits)
2. **Mapbox geocoding key** (~$1.50/mo cost — needed for one-time signal geocoding; MapLibre tiles are free)
3. **Confirm the pricing tiers** ($149 / $499 / $1499 / $5k+) — these are my recommendation; you may want different numbers
4. **Confirm Apollo + Browserless secrets** are loaded (I see them as "pending" in your secrets list)

On approval I start Sprint 1 immediately: PostGIS lat/lng columns + geocoding cron + MapLibre canvas + filter panel + heatmap RPC. You'll see a working map within the first build cycle.

---

## Why this is a $1M+ valuation product

- **Defensible data**: Michigan SOS officer data + LARA license cross-ref isn't on ZoomInfo. Local OSINT is the moat.
- **Defensible math**: signal stacking + decay model is original IP (you can patent the weighting methodology).
- **Defensible UX**: AI narrative on every account is what makes salespeople actually use it instead of ignoring scores.
- **Defensible economics**: $499–$1499/mo per seat × 200 seats = $1.2M–$3.6M ARR. SMB SaaS at >$1M ARR with <10% churn = 5–8x revenue exit multiple. That's your $5M–$25M outcome.
- **Strategic acquirers**: Reynolds & Reynolds (auto), Constellation (vertical SaaS), CRMNext, even ZoomInfo or 6sense as a "regional intelligence" tuck-in.

This is the product. Approve and I build.
