## Audit Findings — why 0 conversions in the last 8 days

I traced every step of the funnel (cold email → landing → checkout → DB) and found **3 real bugs** plus 2 deliverability concerns. The links themselves resolve (HTTP 200), but data is being lost and friction is too high.

---

### 🔴 Bug #1 — Funnel tracking is silently broken (BLOCKING analytics, not conversions)

`trial_funnel_events` table has only **2 rows in 8 days** despite the analytics dashboard showing **71 visitors to `/start-trial`**.

Root cause: an anon `INSERT` to the table returns **HTTP 401 / `42501 row violates RLS`**.
- Policy `anon_insert_trial_funnel_events` exists with `WITH CHECK (true)` — looks correct on paper.
- But `information_schema.role_table_grants` shows **no `INSERT` grant to the `anon` role** (only `sandbox_exec`). RLS allows it, but Postgres-level `GRANT` is missing, so PostgREST rejects.

Result: we have **zero visibility** into form submits, checkout redirects, or errors — meaning we literally cannot tell if people clicked the button and the checkout function failed, or if they bounced from the form. Fix: `GRANT INSERT ON public.trial_funnel_events TO anon, authenticated;`

---

### 🔴 Bug #2 — `/unsubscribe` is the #1 page (105 hits) but the unsub system is barely recording anything

- 651 emails sent in 8 days → 105 unsubscribe page hits → **only 29 rows in `email_unsubscribe_tokens`**.
- Means ~76 people clicked unsubscribe but the token either expired, didn't match, or the handler silently failed.
- High unsub-rate (16%) is itself a signal that cold-email frequency/targeting is hurting deliverability — a few recipients got the same email **6–8 times in 8 days** (`info@localedge.com`: 8, `info@tristarelectrical.com`: 6).

---

### 🔴 Bug #3 — `/dwa-admin` shows 20 visits from "Direct" traffic

The admin panel is being indexed/probed publicly. Either:
- A bot is scanning it (acceptable, route is auth-gated), OR
- It's leaking from the sitemap / a public link.

Need to confirm `/dwa-admin` has `<meta name="robots" content="noindex">` and is not in `robots.txt` / sitemap.

---

### ⚠️ Issue #4 — `/start-trial` UX is a wall, not a slope

71 visits → 0 trials. Looking at `StartTrial.tsx`:
- Form requires email + business name + phone (or website). That's **3 required fields before the user sees pricing or knows what they're signing up for**.
- No pricing shown on the page ("No credit card required" is the only context).
- No product hero image, no "what you get on day 1" preview, no testimonial.
- If the checkout edge function returns an error, the user just sees red text — no fallback "talk to Matt" CTA inline.

Combined with broken funnel tracking, we can't even tell where in this form they're dropping. Almost certainly a Step-1-form-abandonment problem.

---

### ⚠️ Issue #5 — Cold-email landing flow has a domain mismatch risk

All cold emails point to `https://detroitwebagent.com/start-trial?...`. That URL serves correctly today, **but** the project's "Primary URL" in Lovable hosting is `m2training.lovable.app` (per project_urls). If the m2training preview ever takes over routing, every cold email CTA breaks.

Confirmed today both `detroitwebagent.com` and `www.detroitwebagent.com` return 200, so this is a future-proofing concern, not active.

---

## Recommended Fix Plan

### Phase 1 — Restore visibility (10 min)
1. Migration: `GRANT INSERT, SELECT ON public.trial_funnel_events TO anon, authenticated;` — also grant `usage` on the sequence if any. Verify with same `curl` test.
2. Migration: ensure `email_unsubscribe_tokens` has same anon-INSERT grants so the unsub handler can write.

### Phase 2 — Diagnose the unsub gap (15 min)
3. Read `handle-email-unsubscribe` (or whichever handles `/unsubscribe`) and check why 105 hits → only 29 token rows. Likely: token mismatch logic, or it's writing to `suppressed_emails` instead and we should query that.
4. Add `noindex` meta to `/dwa-admin`, `/unsubscribe`, all admin routes; confirm `public/robots.txt` excludes them.

### Phase 3 — Fix the funnel UX (30–45 min)
5. Add a **pricing + "what happens next"** preview block to `StartTrial.tsx` above the form (per-product, e.g. "Mortgage Radar — $149/mo after trial. First leads in your inbox within 4 hours.")
6. Add a phone fallback CTA next to the submit button: "Prefer to talk first? Text Matt: (313) 992-1219"
7. On error, show inline mailto AND sms link — not just red text.
8. Capture `form_focus` event on email field (already wired in trial-funnel lib but not called from StartTrial.tsx) so we can see step-level dropoff.

### Phase 4 — Deliverability + frequency cap (20 min)
9. Audit cold-email frequency: nobody should receive >2 emails from us in 7 days unless they replied. The 6–8x sends to single recipients explain the 16% unsub rate. Add a global per-recipient cap in `_shared/outreach-blocklist.ts` or a new check.

### Phase 5 — Verify end-to-end (10 min)
10. After Phase 1 fix, hit `/start-trial?product=field_desk` from incognito, fill the form, confirm a `view`, `form_submit`, `checkout_redirect` row appears in `trial_funnel_events`.
11. Run `e2e-link-auditor` edge function (already exists per `supabase/functions/e2e-link-auditor/index.ts`) to confirm every product key resolves.

---

**Honest take**: the system *works* (links resolve, Stripe is wired, webhooks exist). It's two compounding silent failures — analytics writes are RLS-blocked so we're flying blind, and the form itself is friction-heavy with zero pricing context. Nobody's "missing" something hidden — they're hitting a generic form with no context, no proof, no price, and bouncing.

Want me to switch to build mode and ship Phase 1 + Phase 2 first (the data-visibility fixes), then iterate on the StartTrial UX?