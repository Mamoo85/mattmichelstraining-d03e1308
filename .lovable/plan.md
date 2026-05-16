## Goal

1. Fire this week's M2 training newsletter immediately.
2. Make sure next Monday (and every Monday after) it sends automatically.
3. Add a personalized hero banner at the top of every email — each subscriber gets their own weekly "scorecard" pulled from their profile, points, transactions, and leaderboard rank. Witty, grunge-Midwestern, visually stunning.

---

## Part 1 — Send this week's now + fix the cron

The `training-newsletter-send` edge function exists and works, but **has no cron job**. That's why no email went out this week (and won't next week either).

- Invoke `training-newsletter-send` manually right now to send this week's issue.
- Add a pg_cron job: `training-newsletter-weekly` → every **Monday 12:00 UTC (8am ET)**, using the canonical hardcoded URL + `SUPABASE_SERVICE_ROLE_KEY_VAULT` pattern (same fix used for the other 19 broken crons in Phase 45).
- Migration file: `supabase/migrations/<ts>_training_newsletter_weekly_cron.sql`.

Also worth fixing while we're in there: the existing `newsletter-send` and `sports-newsletter-weekly` crons have been failing weekly with `job startup timeout`. Same root cause (cold start past cron window). I'll patch both to the same hardcoded-URL + service-role-vault pattern in the same migration so no Monday silently fails again.

---

## Part 2 — Personalized "Your Week" hero banner

### Brainstorm — what goes in the banner

Each subscriber's banner is dynamically built from their data. Witty Midwestern voice, grunge aesthetic (orange `#e8621a` on dark slate `#1e293b`, mono accents, hand-drawn-feeling dividers). Pulled per-recipient at send time.

**Sections (we'll pick 3–4 to display, prioritized by what changed most):**

1. **The Scorecard** — Big number: points earned this week, level, weekly streak.
  - *"You banked 340 pts this week. That's 4 workouts and a check-in. Not bad, Grinder."*
  - *"Streak: 6 weeks. Don't be the guy who breaks it for a Tigers game."*
2. **Level-up celebration** (if they crossed a tier this week)
  - *"You just hit GRINDER. Welcome to the part where it actually starts working."*
  - Glowing badge animation (CSS, email-safe).
3. **Leaderboard movement**
  - *"You climbed 12 spots. You're #34. The guy ahead of you logged 5 sessions. Just sayin'."*
  - *"You're top 10%. Stay there."*
4. **Achievement unlocks** (derived from `point_transactions` actions this week)
  - First studio check-in, first workout log, referral made, challenge entered.
  - *"You shared your first workout. That counts as bravery in 2026."*
5. **Streak alert** (only if streak is alive)
  - Visual flame icon, week count, and a "don't break it" line.
6. **Comeback kid** (if they were dormant 14+ days then logged something)
  - *"Welcome back. We didn't delete your account."*
7. **Quiet-week roast** (if 0 points this week)
  - *"Zero points. We're not mad, we're just disappointed. The barbell misses you."*
  - Gentle, never mean — opt-in tone toggle later if needed.
8. **Goal nudge** (if they have macro goals set in profile but logged no nutrition)
  - *"You set a 180g protein goal. You logged 0 meals. The goal is judging you."*
9. **Weekly truth tag** (one of: "First Plate Club", "Weekend Warrior", "Comeback Kid", "Clockwork", "Ghost") — small badge under name.

### Visual treatment

- Full-bleed dark hero (`#1e293b` → subtle gradient to `#0f172a`).
- Bold orange accent rule + serif-display headline ("YOUR WEEK").
- 2-up grid for the two most important stats (e.g., points + streak), each in its own card with thin orange border.
- A "ticker tape" style row of unlocked achievements (uppercase mono, separated by `·`).
- Then a quote-style line in italics — Matt's voice — commenting on what they did.
- Subtle texture: 1px dotted dividers, fake "stamp" treatment ("WEEK 19 / 2026" in the corner).
- Mobile-safe table-based HTML, all inline styles, no external CSS.

### Voice samples (Midwestern, grunge, witty — Matt would say these)

- "You showed up 4x. The guy who hates Mondays only got 2."
- "Detroit weather sucks. Your training didn't. Respect."
- "12-week streak. At this point you'd feel weird skipping."
- "Top 5%. Don't get cocky — the off-season is when people fold."
- "You earned 340 pts. Spend them on nothing, because that's how points work."

---

## Part 3 — Implementation

### A. New helper module

`supabase/functions/_shared/training-personalization.ts`

- `getWeeklyScorecard(sb, userId)` — pulls in parallel:
  - `user_points` (current totals, level, streak)
  - `point_transactions` this week (sum, action breakdown, level-up detection by comparing to last week's total)
  - Leaderboard rank now vs. 7 days ago (computed from `user_points` ordered desc)
  - `profiles` (athlete_name, daily goals)
- Returns a typed `WeeklyScorecard` object (points_this_week, total_points, level, level_changed, streak, rank_now, rank_delta, achievements[], quiet_week, comeback).

### B. Banner renderer

`buildPersonalizedBanner(scorecard, recipientName)` → email-safe HTML string.

- Picks the 3–4 most relevant modules based on the scorecard.
- Generates one Matt-voice line per module (template strings, no LLM call needed for the first version — keeps it fast and cheap; we can add a per-user LLM rewrite pass later).
- Fully inline-styled, mobile responsive table layout, dark hero block.

### C. Wire into `training-newsletter-send/index.ts`

- Map subscriber emails → `auth.users.id` → personalize.
- For subscribers without an account (cold list), render a **generic "Join the leaderboard" banner** instead — same visual language, with a CTA to sign up.
- Inject the banner HTML at the top of `buildEmailHtml`, **above** the existing header block, by changing `buildEmailHtml` to accept an optional `personalBanner` arg.
- Send loop becomes: for each recipient, build banner → splice into HTML → send. Still batched in groups of 50 with `Promise.allSettled`.

### D. Performance

- Pre-fetch all subscriber `user_points` + last-week comparison in **one query each** before the send loop, not per-email. Banner rendering is pure string templating — sub-millisecond per recipient.

### E. Testing

- Add `?preview_only=true&personalize_test=<email>` mode that sends just one recipient's personalized version to Matt for visual QA before blasting.

---

## Files touched

- `supabase/functions/training-newsletter-send/index.ts` — wire personalization
- `supabase/functions/_shared/training-personalization.ts` — **new**
- `supabase/migrations/<ts>_training_newsletter_weekly_cron.sql` — **new** (training cron + repair `newsletter-send` + `sports-newsletter-weekly`)

## Out of scope (call out so we don't scope-creep)

- LLM-rewritten per-user voice lines (fast-follow if the templated version feels stale)
- Subscriber preferences (mute roast tone, choose stats shown) — fast-follow
- Banner image generation (we're doing pure HTML/CSS for deliverability; no remote images per recipient)

---

## Order of operations after approval

1. Apply cron migration (also fires next Monday).
2. Build personalization helper + banner renderer.
3. Wire into newsletter function.
4. Send Matt a preview to his inbox.
5. On his "go", invoke the function to blast this week's issue to the full list.
6. Fix all other cron errors after searching for them