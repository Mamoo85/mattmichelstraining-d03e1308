

# Draft-and-Hold AI Customer Acquisition Engine

This builds on the existing `outreach_leads` table and `AdminOutreach.tsx` — no new `prospects` table needed since `outreach_leads` already serves this purpose. The user's "CRITICAL ISOLATION RULE" is already satisfied: `outreach_leads` is completely separate from `users`, `profiles`, and `b2b_clients`.

---

## Step 1: Database Migration

Add 3 columns to `outreach_leads`:
- `ai_drafted_subject TEXT` — AI-generated subject line
- `ai_drafted_pitch TEXT` — AI-generated email body
- `ai_drafted_at TIMESTAMPTZ` — when draft was generated

Add `awaiting_approval` as a valid Kanban status in the UI (no enum constraint exists, status is a text column).

## Step 2: Fix Build Error

Fix `process-email-queue/deno.json` — remove the broken `esm.sh` import map. The `nodeModulesDir: auto` setting already handles `npm:` specifiers natively.

## Step 3: Update `generate-audit-pitch` Edge Function

- Migrate from direct Anthropic API to Lovable AI Gateway (`google/gemini-2.5-flash-lite`)
- Accept an optional `leadId` parameter
- Generate both a subject line and email body
- When `leadId` is provided: save `ai_drafted_subject`, `ai_drafted_pitch`, `ai_drafted_at` to the lead row and set `status = 'awaiting_approval'`
- When no `leadId`: return the email text as before (backward compatible)

## Step 4: Create `send-approved-pitch` Edge Function

New function at `supabase/functions/send-approved-pitch/index.ts`:
- Accepts `leadId` + optional edited `subject` and `body`
- Fetches the lead from `outreach_leads`
- Validates the lead has an email address and a draft
- Sends via Resend from `matt@mattmichelstraining.com`, BCC `matthewmichels4@gmail.com`
- Updates status to `contacted` and sets `last_contact_date`
- Returns success/failure with proper CORS

## Step 5: Update `AdminOutreach.tsx`

- Add `awaiting_approval` column to the Kanban board (between AI Audited and Contacted)
- Update the `Lead` interface with the 3 new columns
- Add an **Approval Queue** section above the Kanban: fetches leads with `status = 'awaiting_approval'`
- Each approval card shows: business name, city, industry, editable subject input, editable body textarea
- "Send Email" button calls `send-approved-pitch` edge function
- "Reject" button moves status back to `lead_found`
- Update the existing "Audit Pitch" modal to also save drafts to DB (calls `generate-audit-pitch` with `leadId`)
- Loading states and error toasts on all actions

## File Changes

| File | Action |
|------|--------|
| Migration | Add 3 columns to `outreach_leads` |
| `supabase/functions/process-email-queue/deno.json` | Fix broken import map |
| `supabase/functions/generate-audit-pitch/index.ts` | Rewrite: Lovable AI + save to DB |
| `supabase/functions/send-approved-pitch/index.ts` | New: 1-click send via Resend |
| `src/components/admin/AdminOutreach.tsx` | Add approval queue + send button |

