

# Zone Dashboard — Immersive 4-Tab Portal (Test Route)

New page at `/zone-dashboard`. Completely isolated from live site. Uses the Zone aesthetic with your real M² logo and a brand-orange-driven color system.

---

## Tab Structure

| Tab | Icon | Content |
|-----|------|---------|
| **Lifts** | BarChart3 | ProgressCharts (Body Avatar, Tron Charts, Log Form, Stats, Recovery, AI Advisor, Lift Insights) — **default tab, first thing users see** |
| **Generate** | Sparkles | AI Workout Generator + Fix It Generator side-by-side launchers, interval timer auto-config callout badge, gym photo upload |
| **Train** | Dumbbell | WorkoutsTab (Mine/AI/Community) + MyPrograms + Today's Training Card |
| **Home** | Home | Everything else: Coach Chat, Monthly Focus, Challenges, Community Feed, Referrals, Sessions, Shared Workouts |

Lifts is the hero tab — opens by default. Priority order matches your ranking.

---

## Design

- **Background**: `#050505` ultra-dark
- **Cards**: Glassmorphism — `rgba(255,255,255,0.03)`, `backdrop-blur-xl`, `border: 1px solid rgba(255,255,255,0.06)`
- **Primary accent**: Brand orange gradient (`#f97316` → `#ea580c`) — used on active tab pill, CTAs, glow shadows
- **Secondary accents**: Cyan `#00f0ff` (data/charts), Purple `#a855f7` (AI features), Green `#22c55e` (streaks/status)
- **Gradient border glow** on the hero "Log a Lift" card (orange → cyan → purple sweep)
- **Real M² logo**: `src/assets/m2-logo-official.png` in the sticky header
- **Standard BottomTabBar stays** visible underneath
- Mobile-first `max-w-lg mx-auto`, 48px+ tap targets

---

## Files

### 1. Create `src/pages/ZoneDashboard.tsx` (~600 lines)

**Zone Header** — Sticky dark glassmorphic bar with real M² logo image, athlete name + tier badge, green pulse dot. No AppNavbar.

**Quick Stats** — 3 glass cards below header: Streak (green), Sessions This Week (orange), Current Program (cyan). Real data from Supabase.

**4-Tab Pill Bar** — Horizontal pills: Lifts (default), Generate, Train, Home. Orange active state with glow.

**Lifts Tab**: Wraps `ProgressCharts` in the Zone theme. Adds a prominent "Log a Lift" hero card with gradient border at the top.

**Generate Tab**: Two large launcher cards side-by-side — "Smart Workout" (orange glow) and "Fix It Protocol" (purple glow). Each launches `AiWorkoutSuggest` inline with appropriate `initialPath`. Below them, a glowing info badge: "⚡ Timer auto-configures to your generated workout" with cyan accent.

**Train Tab**: Stacks `TodaysTrainingCard`, then `WorkoutsTab`, then `MyPrograms`. All Zone-themed.

**Home Tab**: Coach Chat button, Monthly Focus, Challenge Preview, Community Feed, Referral Card, Shared Workouts, Sessions. Same components as current `DashboardHome` but in Zone wrapper.

**Modals**: WelcomeGiftModal, NamePromptModal, FeatureLearningModal, PortalOnboarding, TrialPaywallModal — all preserved.

### 2. Create `src/components/zone/ZoneThemeWrapper.tsx` (~25 lines)

Wrapper div that overrides CSS custom properties:
- `--background: 0 0% 2%`
- `--card: 0 0% 5%`
- `--border: 0 0% 10%`
- `--muted: 0 0% 8%`
- `--foreground: 0 0% 90%`
- `--muted-foreground: 0 0% 55%`

All child components (ProgressCharts, WorkoutsTab, MyPrograms, etc.) auto-inherit the dark Zone look.

### 3. Modify `src/index.css`

Add `.zone-theme` class with CSS variable overrides + utility classes `.zone-glass` and `.zone-glow`.

### 4. Modify `src/App.tsx`

Add one lazy route: `/zone-dashboard` → `ZoneDashboard`. No nav links added.

---

## Generate Tab — Timer Callout Detail

After the two generator launcher cards, a compact glassmorphic banner reads:

```text
⚡ Auto-Timer — When the AI builds your workout, the Interval Timer 
   automatically configures work/rest/rounds to match. Just press play.
```

Styled with cyan left-border accent and subtle glow. Tapping it could navigate to `/timer` in the future.

---

## No existing files modified

All existing components (`ProgressCharts`, `WorkoutsTab`, `MyPrograms`, `FixItLibrary`, `DashboardHome`, `ChallengeHub`) stay untouched — they inherit the Zone look through CSS variable overrides in the wrapper.

