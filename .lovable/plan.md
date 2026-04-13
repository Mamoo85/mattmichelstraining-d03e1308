

# Launch QA Fix: 5 Surgical Changes

## Verified Facts (from live DB + code)

| Claim | Verified | Action |
|-------|----------|--------|
| `email_reply_drafts` table missing | **TRUE** — query returns empty | CREATE TABLE migration |
| `chargeContractor()` missing `res.ok` | **FALSE** — line 44 already has it | SKIP |
| `release-pending-replies` missing | **FALSE** — file exists in repo | SKIP |
| `hire-alert-scanner` wrong FROM email | **TRUE** — 26 occurrences of `mattmichelstraining` | FIX |
| `contact_preference` column missing | **TRUE** — column doesn't exist | ADD |
| `ai-reply-detector` cancel URL `id=undefined` | **TRUE** — no null guard at line 166 | FIX |

---

## Changes

### 1. Migration: Create `email_reply_drafts` + add `contact_preference`

```sql
-- email_reply_drafts (ghost delay queue)
CREATE TABLE IF NOT EXISTS email_reply_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_email text NOT NULL,
  draft_subject text,
  draft_body text NOT NULL,
  category text,
  send_after timestamptz NOT NULL,
  sent boolean DEFAULT false,
  cancelled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE email_reply_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON email_reply_drafts FOR ALL TO service_role USING (true);

-- contact_preference on contractor_leads
ALTER TABLE contractor_leads
  ADD COLUMN IF NOT EXISTS contact_preference text NOT NULL DEFAULT 'call';
```

### 2. Fix `hire-alert-scanner` FROM addresses

Replace all 26 occurrences of `mattmichelstraining.com` with `detroitwebagent.com`:
- Line 23: `from` → `matt@detroitwebagent.com`
- Line 24: `to` → `matt@detroitwebagent.com`
- Line 506: `from` → `matt@detroitwebagent.com`
- Line 578/864: image URLs → `detroitwebagent.com/images/matt-boat.jpg`
- Line 587: unsubscribe mailto → `matt@detroitwebagent.com`

### 3. Update `GetQuote.tsx` — add contact preference

Add a `contact_preference` field (default "call") with 3 styled radio buttons: Call Me / Text Me / Email Me. Pass it in the `contractor_leads` insert.

### 4. Rewrite `contractor-lead-notify` SMS copy

Add `contact_preference` to the select query (line 38). Branch SMS copy:

- **call**: `"LEAD UNLOCKED: [Name] — [Phone]. [Project]. CALL THEM NOW — exclusive to you. — DWA Lead Engine"`
- **text**: `"LEAD UNLOCKED: [Name] — [Phone]. Prefers TEXT. [Project]. Reach out now. — DWA Lead Engine"`
- **email**: `"LEAD UNLOCKED: [Name] prefers EMAIL at [email]. [Project]. Email them — follow up within 24 hours. — DWA Lead Engine"`

Remove `"— Matt (313) 992-1219"` sign-off. This is an automated dispatch system.

### 5. Guard null draft ID in `ai-reply-detector`

At line 166, wrap the cancel URL:
```typescript
const cancelUrl = draft?.id
  ? `${SUPABASE_URL}/functions/v1/cancel-reply-draft?id=${draft.id}`
  : null;
const cancelNote = cancelUrl ? ` Cancel: ${cancelUrl}` : "";
```

Use `cancelNote` in the SMS body instead of always including the URL.

---

## Files Changed

| File | Change |
|------|--------|
| New migration | Create `email_reply_drafts` table + add `contact_preference` column |
| `supabase/functions/hire-alert-scanner/index.ts` | Replace 26 `mattmichelstraining` → `detroitwebagent` |
| `src/pages/GetQuote.tsx` | Add contact preference radio buttons |
| `supabase/functions/contractor-lead-notify/index.ts` | Preference-branched SMS, add `contact_preference` to select, remove personal sign-off |
| `supabase/functions/ai-reply-detector/index.ts` | Guard null `draft.id` before building cancel URL |

## What We Are NOT Changing
- `chargeContractor()` — already has `res.ok` guard (line 44)
- `release-pending-replies` — already exists and is cron-wired
- `hire-alert-phantom-alert` / `hire-alert-trial-convert` — both exist
- FieldDesk welcome email — already using `matt@detroitwebagent.com`

