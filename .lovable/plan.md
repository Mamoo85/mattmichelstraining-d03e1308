

# Coach & Team System — "M² Teams"

## The Vision

A GameChanger-inspired team management layer on top of your existing training platform. You (Matt) onboard the coach. The coach sends a join link. Athletes land in your ecosystem with full access to your tools — but scoped to their team. The coach gets a dashboard to manage, assign, and monitor. The kids get a social, competitive experience that hooks them.

## Who Uses What

```text
┌─────────────────────────────────────────────────┐
│  MATT (Admin)                                    │
│  • Onboards coaches via admin panel              │
│  • Sets team plan/pricing                        │
│  • Sees all teams, all athletes                  │
└──────────────────────┬──────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
┌────────▼─────────┐     ┌──────────▼────────┐
│  COACH            │     │  COACH             │
│  /coach-hub       │     │  /coach-hub        │
│  • Team roster    │     │  • Team roster     │
│  • Assign workouts│     │  • Leaderboard     │
│  • View progress  │     │  • Announcements   │
│  • Team feed      │     │  • PDF exports     │
└────────┬──────────┘     └──────────┬─────────┘
         │                           │
    ┌────┴────┐                ┌─────┴────┐
    │Athletes │                │Athletes  │
    │(app/PDF)│                │(app/PDF) │
    └─────────┘                └──────────┘
```

## The Pitch to the Athletic Director

"Every kid gets it on their phone. If they don't want the app, they download the PDF. The coach sees everything from one dashboard. I either come monthly to teach or the coach learns it at my gym. Either way — professional programming, zero guesswork."

## Database Changes (4 new tables, 2 altered)

1. **`coach_profiles`** — Links a user to the coach role with permissions
   - `user_id`, `created_by` (admin who onboarded them), `school_name`, `sport`, `is_active`, `max_athletes`

2. **`team_rosters`** (already exists) — Add columns:
   - `coach_user_id` (references coach_profiles), `school_name`, `season`, `invite_code` (unique short code for join links)

3. **`team_feed`** — Social feed scoped to a team
   - `id`, `roster_id`, `user_id`, `type` (pr, workout_log, shoutout, coach_announcement), `content`, `media_url`, `created_at`

4. **`team_feed_reactions`** — Likes/fire/emoji reactions
   - `id`, `feed_item_id`, `user_id`, `reaction` (fire, muscle, clap, 100)

5. **`team_workouts`** — Coach-assigned workouts for the team
   - `id`, `roster_id`, `assigned_by`, `title`, `description`, `exercises` (jsonb), `due_date`, `created_at`

6. **`team_workout_completions`** — Track who did it
   - `id`, `team_workout_id`, `user_id`, `completed_at`, `notes`

## Frontend Pages & Components

### 1. Coach Hub (`/coach-hub`) — The coach's command center
- **My Teams tab** — List of their rosters, athlete count, invite link generator
- **Roster tab** — Athletes with status badges, quick-add by email or share link
- **Assign Workout tab** — Pick from your workout library or build one, set due date, push to team
- **Team Progress tab** — Grid view of who completed what, PR highlights, attendance %
- **Team Feed tab** — See what athletes are posting, pin announcements
- **Export tab** — PDF roster, PDF workout sheets (for kids who want paper)

### 2. Athlete Team View (`/my-team`)
- **Team Feed** — Snapchat/Instagram Stories-style vertical feed with:
  - PR celebrations auto-posted (with fire emoji reactions)
  - Workout completions ("Jake just crushed Leg Day 🔥")
  - Coach announcements pinned at top
  - Shoutouts (athlete → athlete)
- **Today's Workout** — What coach assigned, tap to log it
- **Team Leaderboard** — Points, PRs, streak days, completion %
- **My Stats** — Personal progress within team context

### 3. Join Flow (`/join/TEAM_CODE`)
- Public page, no login required to view team info
- Shows team name, sport, coach name, athlete count
- "Join Team" → signup/login → auto-added to roster
- Option to just download the PDF workout instead

### What Hooks High School Kids

- **🔥 Fire Reactions** — tap fire on teammates' PRs (like Snapchat streaks but for lifting)
- **Streaks** — consecutive days completing assigned workouts (already have streak system)
- **Team Leaderboard** — competitive by nature, ranked by points
- **PR Cards** — auto-generated shareable cards (already built) scoped to team
- **Coach Shoutouts** — coach can spotlight an athlete ("Athlete of the Week")
- **Completion Badges** — visual progress rings showing % of assigned workouts done
- **Dark Mode + Neon Orange** — already your brand, already cool

## Coach Onboarding Flow (Admin Side)

1. Matt goes to Admin → Teams → "Add Coach"
2. Enters: coach name, email, school, sport, max athletes
3. System creates account invite + coach_profile
4. Coach gets email with setup link → creates password → lands on `/coach-hub`
5. Coach generates invite link → shares with team via text/GroupMe/etc.
6. Athletes click link → sign up → auto-joined to team

## PDF Fallback (No App Required)

- Coach can export any assigned workout as a branded PDF
- Athletes on the join page can "Download This Week's Workout" without creating an account
- PDFs include: exercises, sets/reps, notes, QR code back to the app

## Pricing Model (for the pitch)

- **Per-team**: $X/mo per team (coach gets full dashboard)
- **Per-athlete**: or $X/athlete/mo (scales with roster size)
- **School Package**: bulk deal for multiple teams at one school
- You decide pricing — the system supports any model

## RLS Security Model

- Coaches can only see/manage their own teams
- Athletes can only see their own team's feed and workouts
- Coach cannot see other coaches' teams
- Matt (admin) sees everything
- Feed reactions visible to team members only

## Implementation Order

1. Database migrations (coach_profiles, team_feed, team_feed_reactions, team_workouts, team_workout_completions, alter team_rosters)
2. Coach role system (new `coach` value in app_role enum + `has_role` support)
3. Join flow page (`/join/:code`)
4. Coach Hub page with tabs
5. Athlete team view with social feed
6. PDF export edge function
7. Admin "Add Coach" panel
8. Invite email edge function

## Technical Notes

- Leverages existing `team_rosters` and `team_members` tables — extends them rather than replacing
- Reuses existing PR celebration, points, and streak systems — just scopes them to team context
- Social feed uses polling (5-10s) consistent with existing security architecture (no Realtime on sensitive tables)
- Coach role is separate from admin — coaches get a subset of permissions, not full admin access

