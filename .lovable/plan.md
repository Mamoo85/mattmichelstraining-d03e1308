## Root cause (confirmed in DB)

Pulled the last 5 sends of `newsletter_sends` for the M² Brief. **Every one has the same MD5 body hash (`0f820be3...`)** — the AI call has been failing silently every Monday since April 6, and the function falls back to a hardcoded "Most youth athletes aren't limited by talent…" template that is byte-for-byte identical. So Christina has been receiving the same email since Issue #1.

```text
Issue #5 (Apr 27) ─┐
Issue #4 (Apr 20)  │
Issue #3 (Apr 13)  ├─ all body MD5 = 0f820be34d746d33c8b421d817e04dcf
Issue #2 (Apr 7)   │
Issue #1 (Apr 6)  ─┘
```

Three separate failures stacked:

1. **AI generation fails silently.** `sports-newsletter-weekly/index.ts` tries two Lovable AI Gateway endpoints (`api.lovable.dev` and `api.lovable.ai`). Neither is the canonical Cloud endpoint we use everywhere else (`https://ai.gateway.lovable.dev/v1/chat/completions`). Both 404, the function logs the error to console, and falls through to the fallback template. Matt is never notified.
2. **The fallback template is fully static.** No date, no rotation, no variation — the same paragraphs every week.
3. **Stale source data.** The "active" `monthly_challenge` is from March 19 ("The March To Not Being A Statue"). The April challenge exists but `is_active=false`. Even if AI worked, it would be referencing a March challenge in late April.

The cron job is healthy: `0 13 * * 1` (Mon 8am ET) → fires `sports-newsletter-weekly`. That's why Christina gets it like clockwork — bad content, perfect delivery.

---

## Fix plan

### 1. Fix the AI call so the M² Brief is actually generated each week
In `supabase/functions/sports-newsletter-weekly/index.ts`:
- Replace the two broken endpoints with the canonical Lovable AI Gateway URL `https://ai.gateway.lovable.dev/v1/chat/completions` (the same one already used by ~30 other working functions in this repo, including `generate-signal-dossier` and `growth-radar-pdf-report`).
- Switch model to `google/gemini-2.5-flash` (already in payload) and verify response shape parsing.
- Bump `max_tokens` to 1100 so the 5-section structure isn't truncated.

### 2. Make the fallback impossible to repeat
Even when AI works, defense-in-depth so this never happens again:
- Before insert, hash the new `body` and check `newsletter_sends` for the **same hash within the last 4 issues**. If duplicate detected:
  - Do NOT send.
  - Insert a row with `template_name = 'sports_weekly_blocked_dupe_<n>'` for audit.
  - Send Matt an SMS via `_shared/twilio.ts` `sendSMS()`: `"M² Brief #N blocked — content matched last week. Check sports-newsletter-weekly logs."`
- Rewrite the hardcoded fallback into a **rotating bank of 8 distinct fallback briefs** (different training truth, drill, nutrition tip, Matt's take), keyed off `issueNumber % 8`, so even in a worst-case AI outage the email still varies week to week.

### 3. Make the prompt content-aware so AI can't write the same thing twice
- Pull the **last 3 sent bodies** from `newsletter_sends` (template_name like `sports_weekly_%`) and pass their headlines into the system prompt as: `"Do not repeat these recent topics: [topic1], [topic2], [topic3]."`
- Add the current ISO week number and a rotating **seed angle** from a 12-item bank (recovery, deload weeks, rotational power, Achilles loading, in-season strength, sleep, hydration timing, mental load, injury early-warning signs, stride mechanics, posterior chain, mobility) so each week starts from a fresh hook.

### 4. Refresh the stale source data
- Insert a fresh April monthly_challenge and flip `is_active`:
  ```sql
  UPDATE monthly_challenges SET is_active = false WHERE is_active = true;
  INSERT INTO monthly_challenges (title, description, metric_label, is_active) VALUES
    ('The Late-April Recovery Reset', '7 nights of 8+ hours sleep + daily 5-min mobility flow. Track and report.', 'nights logged', true);
  ```
- Optionally insert a new `monthly_focus` row dated April so the "monthly focus" referenced in the prompt is current.

### 5. Self-healing observability
- After every send, write a row to `error_logs` (table already exists, used by `code-fixer-watchdog`) when AI fails, classified as `category='newsletter_ai_fail'`. This automatically triggers the existing autonomous fixer agent and SMS Matt — same pattern used by Mortgage Radar and TechAlert.
- Send Matt a one-time **preview SMS** at send-time: `"M² Brief #N sent to X subs. Preview: <subject>. View: <admin url>."` so he sees what went out without checking email.

### 6. Backfill action (one-time, optional)
Christina (and the other 25 subs) have received the same content 5x. Optionally queue a one-time **make-good email** with this week's actually-good Brief, subject `"M² Brief — fresh edition (sorry about the repeat)"`. Recommend yes, but flag for Matt's approval before sending.

---

## Files to touch

| File | Change |
|---|---|
| `supabase/functions/sports-newsletter-weekly/index.ts` | New AI endpoint + model; rotating 8-bank fallback; recent-body dedup hash check; SMS Matt on dupe; recent-topics in prompt; error_logs insert on AI fail |
| `supabase/migrations/<ts>_refresh_m2_brief_source_data.sql` | Activate fresh April challenge + monthly_focus |
| `src/components/admin/AdminAutomationHub.tsx` (or nearest admin panel) | Add "Preview This Week's M² Brief" button that calls the function with `dry_run: true` so Matt can vet content before Monday 8am sends |

---

## Why this matters beyond Christina

The same anti-pattern (AI fails → silent hardcoded fallback → no alert) likely exists in 5+ other newsletter senders in this repo (`industrial-newsletter-send`, `staff-newsletter-sender`, `church-newsletter-sender`, `crime-digest-sender`, `vet-marketing-sender`). Once this fix pattern proves out for M² Brief, I'll port the **same dedup-hash + error_logs + SMS alert** trio to all of them in a follow-up so Matt finds out before clients do.

**Approve and I'll ship steps 1–5 in one pass.**