

## Updated Plan: LinkedIn Rebrand + Critical Supabase URL Migration

### Phase 0: CRITICAL — Supabase Project Reference Migration

The old project ref `zmyczlfuufhngzovkjdh` is hardcoded in **25+ locations across 4 runtime files and 4+ migration files**. This is breaking OAuth, storage, and webhook pipelines.

#### Runtime Files to Fix (4 files, immediate)

| File | Line(s) | What's Broken | Fix |
|---|---|---|---|
| `supabase/functions/post-to-linkedin/index.ts` | 107 | LinkedIn OAuth redirect URL in re-auth email | Replace with `${SUPABASE_URL}` |
| `supabase/functions/stripe-webhook/index.ts` | 3603, 3683 | Voicemail + Phone Answering setup URLs in onboarding emails | Replace with `${SUPABASE_URL}` |
| `src/components/admin/AdminImageMatcher.tsx` | 7 | Storage bucket base URL | Use `import.meta.env.VITE_SUPABASE_URL` |
| `src/integrations/supabase/client.ts` | 5-6 | **DO NOT EDIT** — auto-generated, but currently has old fallback. Env vars override it at runtime. No action needed. |

#### Migration Files (4+ files, ~300+ refs)

These are SQL cron jobs calling `http_post` with hardcoded old URLs:
- `20260329120000_automate_revenue_crons.sql` (~12 cron URLs)
- `20260330000001_agent_smith_cron.sql` (1 URL)
- `20260330210005_social_captions_clients.sql` (1 URL)
- `20260403010000_new_product_crons.sql` (many URLs)

**Fix**: Create a new migration that drops and recreates all affected cron jobs with `eauvubfpanpeuxsrqesu` URLs. Old migration files are historical and won't re-run.

#### URL Architecture Audit

Also found `public/chatbot.js` with a placeholder `YOUR_PROJECT.supabase.co` — will update to use the widget's `data-supabase-url` attribute properly (no hardcode needed).

### Phase 1: LinkedIn System Rebrand (from previous plan)

- Rebrand `post-to-linkedin` topics from M2 Training to Detroit Web Agency
- Update `linkedin-auth-callback` success page branding
- Update `linkedin-ghostwriter` email templates to DWA cyan theme
- Update email senders from `matt@mattmichelstraining.com` to `matt@detroitwebagent.com`

### Phase 2: LinkedIn Banner Generation

Generate a 1584x396px LinkedIn banner with DWA branding for manual upload.

### Phase 3: Verification

- Provide curl commands to test LinkedIn OAuth callback and Stripe webhook endpoints
- List every file modified

### Execution Order

1. New migration to fix all cron job URLs (old ref -> new ref)
2. Fix 3 runtime files (post-to-linkedin, stripe-webhook, AdminImageMatcher)
3. Rebrand LinkedIn edge functions (topics, emails, branding)
4. Generate LinkedIn banner image
5. Output full file manifest + test commands

### Files Modified

| File | Changes |
|---|---|
| `supabase/functions/post-to-linkedin/index.ts` | URL fix + full DWA rebrand (topics, emails, signature) |
| `supabase/functions/stripe-webhook/index.ts` | Replace 2 hardcoded old URLs with `${SUPABASE_URL}` |
| `src/components/admin/AdminImageMatcher.tsx` | Dynamic storage URL from env var |
| `supabase/functions/linkedin-auth-callback/index.ts` | Success page DWA rebrand |
| `supabase/functions/linkedin-ghostwriter/index.ts` | Email template DWA rebrand |
| New DB migration | Drop/recreate all cron jobs with new project ref |
| Generated asset | LinkedIn banner (1584x396px) |

