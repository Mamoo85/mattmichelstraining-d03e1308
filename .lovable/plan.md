

# Tier Feature Fulfillment Audit

## Summary

Cross-referencing every feature promised on the Pricing page against the backend (`tier_features` table, edge functions, database tables, and frontend gating).

---

## Feature-by-Feature Verification

### ALL TIERS (Basic through Team)

| # | Feature Promised | Backend Exists? | Status |
|---|---|---|---|
| 1 | Monthly Focus Plan | `monthly_focus` table + admin generation + dashboard display | **Working** |
| 2 | 85+ exercise library with sport filters | `exercise_library` table + `ExerciseLibrary` component + PaywallGate `requiredTier="basic"` | **Working** but uses legacy `requiredTier`, not `featureKey` |
| 3 | Filter by sport | Sport column on `exercise_library`, filter UI in component | **Working** |
| 4 | Member challenges & leaderboard | `monthly_challenges` + `challenge_participants` + `challenge_entries` tables, dashboard UI | **Working** |

### PRO TIER AND ABOVE

| # | Feature Promised | Backend Exists? | Status |
|---|---|---|---|
| 5 | Custom program from intake form | `generate-program` edge function + `purchased_programs` table | **Working** (admin-generated) |
| 6 | Flag Coach Matt | `flag_for_coach` on `logged_exercises` + `AdminCoachDashboard` + `WorkoutLogger` | **Working** |
| 7 | Optional postural video assessment | `form-check-videos` storage bucket + video upload in `AskCoachMatt` | **Working** |
| 8 | Monthly program updates | Admin can update programs manually; no automated edge function | **Manual only** — acceptable |
| 9 | Full 'Fix It' rehab library | `fix_it_library` feature key in `tier_features` table | **Missing** — no `fix_it_library` feature key exists. Only `exercise_library` exists. No separate "Fix It" content or filtering. |

### ELITE TIER AND ABOVE

| # | Feature Promised | Backend Exists? | Status |
|---|---|---|---|
| 10 | 1-on-1 monthly check-ins | Schedule system exists (`schedule_slots`, `session_bookings`, `create-session-checkout`) | **Working** — but not gated to Elite+ specifically; anyone can book |
| 11 | Priority postural assessments | No priority queue or ordering logic | **Not enforced** — same queue as Pro |
| 12 | Direct messaging support | `CoachMessaging` component is **mock data only** — hardcoded messages, no real DB writes | **Broken** — not connected to any real messaging table |
| 13 | Priority Flag Coach Matt responses | No priority field or sorting by tier in `AdminCoachDashboard` | **Not enforced** — admin sees all flags equally |

### TEAM TIER

| # | Feature Promised | Backend Exists? | Status |
|---|---|---|---|
| 14 | Bulk programming for full teams | `batch-generate-programs` edge function exists | **Working** |
| 15 | Seasonal periodization plans | No specific table or generation logic | **Not implemented** — relies on manual admin work |
| 16 | Multi-athlete management | `team_management` feature key exists in tier_features | **Partially** — feature key exists but no dedicated team roster UI |

---

## Issues Found (7 items to fix)

### Critical

1. **Direct Messaging (Elite/Team) is mock-only**: `CoachMessaging.tsx` uses hardcoded messages. It's not connected to `lift_messages` or `program_messages`. Elite members paying $42.99/mo are promised "Direct messaging support" but cannot actually message Matt outside of the flag/lift-chat system.

2. **Fix It Library has no content separation**: The Pricing page promises a "Full 'Fix It' rehab library" for Pro+, but there's no separate rehab/fix-it category in `exercise_library` and no `featureKey="fix_it_library"` gating anywhere in the codebase. The feature key exists in `tier_features` but nothing in the app checks for it.

### Medium

3. **Exercise Library uses legacy `requiredTier` instead of `featureKey`**: The Shop page gates it with `requiredTier="basic"` instead of the dynamic `featureKey="exercise_library"`. This means admin changes in the Tier Access Manager won't affect it.

4. **No priority sorting for Elite flag responses**: Admin coach dashboard shows all flagged exercises in chronological order. Elite members who pay for "Priority Flag Coach Matt responses" see no actual prioritization.

5. **1-on-1 check-ins not tier-gated**: The session booking flow (`create-session-checkout`) doesn't verify the user is Elite+ before allowing booking. Any user can book.

### Low

6. **Seasonal periodization (Team) not automated**: No edge function or AI generation for seasonal plans. Admin must manually create these.

7. **Multi-athlete management UI missing**: The `team_management` feature key exists in `tier_features` but there's no team roster or multi-athlete dashboard component.

---

## Recommended Plan

### Phase 1 — Fix critical gaps

1. **Build real Direct Messaging for Elite/Team**: Create a `coach_direct_messages` table and replace the mock `CoachMessaging` component with a real chat using the DB. Gate it with `featureKey="coach_messaging"`.

2. **Add "Fix It" category to exercise library**: Add a `category` or `is_fix_it` boolean to `exercise_library` table. Create a separate "Fix It Library" section gated with `featureKey="fix_it_library"` that filters exercises tagged as rehab/fix-it.

### Phase 2 — Enforce tier gating

3. **Migrate PaywallGate usages to `featureKey`**: Replace `requiredTier="basic"` on Exercise Library (and any other legacy usages) with the corresponding `featureKey`.

4. **Add tier-based priority to coach flag queue**: Add a `user_tier` or sort priority to the admin coach dashboard so Elite/Team flagged exercises appear first.

5. **Gate session booking to Elite+**: Add a tier check in `create-session-checkout` edge function, or add a PaywallGate around the booking UI with `featureKey="priority_scheduling"`.

### Phase 3 — Team features

6. **Build multi-athlete management UI**: A Team dashboard where coaches/parents can manage multiple athletes under one subscription.

7. **Add seasonal periodization templates**: AI-assisted or admin-created seasonal plan templates for Team tier.

