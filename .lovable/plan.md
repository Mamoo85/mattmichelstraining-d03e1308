

## Plan: Admin Command Bar v4 — Safety Banner, Inline Edits, E2E Tests, Mobile QA, Replay

All 5 enhancements are additive. Zero breaking changes to existing scanners, crons, Stripe, or admin tabs. Touches the same 2 files (edge function + UI component) plus a small migration to extend `admin_command_log`.

---

### 1. Safety banner — pre-flight whitelist guard

**Where:** new "preview" action in `admin-command/index.ts` runs the planner ONLY (no executor) and returns the plan + risk assessment.

**Server-side risk scan** of plan JSON before any execution:
- Detects `table` args not in `WHITELIST_TABLES` → `risk: "block"`
- Detects `product` args not in `PRODUCTS` → `risk: "block"`
- Detects M2 keywords in reasoning ("training", "athlete", "coach", "M2", "fitness") → `risk: "block"`
- Detects `web_research` / `firecrawl_url` → `risk: "warn"` (cost notice)
- Detects bulk size >25 → `risk: "warn"`

**UI flow:**
1. User taps **Run** → bar calls `action: "preview"` first
2. If `risk: "block"` → red banner appears above results: `🚫 Blocked: Tries to access "training_programs" (M2 territory). Refine your prompt.` No executor runs. No tokens past planner spent.
3. If `risk: "warn"` → amber banner with **[Proceed]** / **[Cancel]** buttons. Tapping Proceed sends `action: "run"` with `confirmed: true`.
4. If `risk: "ok"` → executes immediately (current behavior, no extra click).

Banner is sticky-styled, full-width on mobile, uses existing teal/amber/red palette.

---

### 2. Inline per-recipient regeneration

**New tool:** `regenerate_single_draft({ recipient, product, tone, hook })` — same prompt as `generate_bulk_outreach` but for ONE recipient. Returns `{ ok, rows: [draft] }`. Cost ~$0.0005.

**UI:** in each draft card's edit mode, add a small toolbar above the textarea:
- **Tone:** pill selector → `direct | warm | urgent | curious`
- **Angle:** free-text input (e.g. "lead with their recent permit", "focus on cost savings")
- **🔄 Regenerate this one** button → calls `action: "regenerate"` with that single recipient + new tone/angle + original hook from result
- Spinner on that card only; siblings untouched
- Returned draft replaces only that index in `drafts` state via existing `updateDraft(i, patch)`
- Manual text edits (typing in textarea) continue to work and persist as today

No state-shape changes to the bulk array, so Queue All / Skip / Copy keep working unchanged.

---

### 3. End-to-end test mode (5 products)

**New tab in command bar:** small `🧪 Test Mode` link in the sticky bar header (admin-only, no extra route).

**5 hardcoded test prompts** — one per flagship product:
| # | Product | Test prompt |
|---|---|---|
| 1 | Demand Radar | `Find 3 high-confidence demand radar signals and draft outreach to one buyer per signal` |
| 2 | Talent Radar | `Find 3 hot Talent Radar candidates and draft pitches to matching clients` |
| 3 | Contractor Leads | `Find 3 unclaimed plumbing leads and draft 5 buyer pitches` |
| 4 | FieldDesk | `Find 3 HVAC shops and draft FieldDesk pitches` |
| 5 | Missed Call Catch | `Find 3 small businesses with no website and draft Missed Call Catch pitches` |

**Test runner:**
- Tapping `🧪 Test Mode` opens an accordion with 5 rows (one per product)
- Each row: product name + status dot (⚪ idle / 🟡 running / ✅ pass / ❌ fail) + collapsible details
- **[Run All]** button executes sequentially (not parallel — keeps cost predictable, ~$0.05 total)
- For each test, runs a full mini-flow client-side: `preview → run → assert drafts.length > 0 → simulate edit → simulate queue (dry-run flag, no DB insert)`
- `dry_run: true` flag added to queue action — skips actual `email_reply_drafts` insert, just validates shape
- Results render as: ✅ `5 drafts generated · edit applied · queue validated · $0.012` or ❌ with the failing step's error
- All 5 results saved to `admin_command_log` with `is_test: true` for history

Audit "What stays the same": tests use the same code paths as live commands → if tests pass, live works. No mocks.

---

### 4. 396px mobile QA hardening

Specific fixes against current component (already mostly mobile-friendly, this closes the gaps):

| Element | Current | Fix |
|---|---|---|
| Sticky bar `top-14` | Can collide with mobile nav | Use `top-[env(safe-area-inset-top,0)]` + check `useIsMobile` to set `top-12` on mobile |
| Textarea `rows={2}` | Fine on mobile | Add `text-base` (prevents iOS auto-zoom on focus) |
| Quick chips horizontal scroll | Already good | Add `scroll-snap-type: x mandatory` for thumb-flick precision |
| Step pills | Wrap fine | No change — keep |
| Data accordion rows | `min-w-[80px]` label | Stacks `flex-col` under 480px (key on top, value below) — prevents truncation |
| Draft card buttons (`Skip`, `Edit`, `Copy`) `min-h-[32px]` | Below 44px target | Bump to `min-h-[44px]` and `px-3` |
| Edit mode textarea `rows={6}` | Can push card off screen | Switch to bottom-sheet drawer on mobile (full-height, swipe-down close) using a native `<dialog>` element — no new dep |
| Preview drawer | None today | Add a read-only drawer for `[👁 Preview]` (rendered email view with subject + body in a styled card) — same drawer mechanism |
| Queue All / Copy All buttons | `flex-col sm:flex-row` already | Add `safe-area-inset-bottom` padding so they don't sit under iOS home bar |
| Layout shift | Drafts accordion auto-opens after run | Reserve `min-h-[120px]` on result container to prevent jump |

**QA checklist component:** small `✅ Mobile QA` badge in test mode that runs `window.matchMedia` checks + reports any element under 44px tap-target. Pure client-side, dev aid.

---

### 5. Command logging + one-click replay

**Migration `<ts>_admin_command_log_v2.sql`:**
- Add columns to `admin_command_log`: `is_test boolean default false`, `replay_of_log_id uuid null references admin_command_log(id)`, `result_summary jsonb` (stores the final response shape so replays can diff)
- No data loss, no breaking changes

**New action:** `action: "history"` returns last 20 commands for current admin (id, prompt, cost, draft count, created_at, is_test).

**UI — new accordion `📜 History`:** 
- Lists last 10 commands as cards: prompt preview · cost · time ago · draft count
- Each card has **[🔁 Replay]** button → re-runs the exact prompt, sets `replay_of_log_id` on the new log row
- After replay finishes, shows a **diff strip**: 
  - `Cost: $0.012 → $0.011 (−8%)`  
  - `Drafts: 5 → 5 (same count)`  
  - `Steps: 3 → 3 (same plan)`  
  - `Top recipient changed: 2 of 5`
- Diff is a simple count comparison (rows returned, drafts generated, steps, cost) — no deep semantic diff

**Storage:** result_summary stays under 4KB (just counts + first 3 recipient names). Full results stay queryable in `draft_output` jsonb as today.

---

### Files

| File | Change |
|---|---|
| `supabase/functions/admin-command/index.ts` | +`action: "preview"`, +`action: "regenerate"`, +`action: "history"`, +`dry_run` flag on queue, +risk-scan helper, +`regenerate_single_draft` tool, +`is_test`/`replay_of_log_id` writes |
| `src/components/dwa-admin/AdminCommandBar.tsx` | +SafetyBanner, +PreviewGate logic, +per-card tone/angle toolbar + regenerate, +TestMode panel (5 product runners), +HistoryAccordion with Replay + Diff, +mobile drawer for edit/preview, tap-target bumps |
| `supabase/migrations/<ts>_admin_command_log_v2.sql` | +3 columns on `admin_command_log` |

### Audit — what won't break

- All 14 existing tools untouched — only ADD `regenerate_single_draft`
- Queue action unchanged unless `dry_run: true` passed
- Existing `action: "run"` and `action: "queue"` keep current behavior when no new fields supplied
- All scanners, crons, webhooks, Stripe, M2 site untouched
- Cost cap ($5/24h) still enforced; preview action is cheap (~$0.005, planner only)
- Test mode uses real code paths but `dry_run` flag prevents actual queue inserts

### Cost ceiling (updated)

| Action | Cost |
|---|---|
| Preview only (block path) | ~$0.005 |
| Single regenerate | ~$0.0005 |
| Full test suite (all 5) | ~$0.05 |
| Replay | same as original command |
| Daily cap | $5 (unchanged) |

