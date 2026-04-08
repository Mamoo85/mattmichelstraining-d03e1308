## Plan: Switch Prospector Emails to detroitwebagent.com + Add Sent Tracking & Clear Functionality

### Problem Summary

1. **Wrong sender domain**: All prospector drip emails send from `matt@mattmichelstraining.com` — need to switch to `matt@detroitwebagent.com`
2. **No sent tracking**: No way to see which businesses have been emailed, open rates, or email history
3. **No clear/reset**: Can't clear out the pipeline or move sent leads out of the way
4. **Resend domain**: User says `detroitwebagent.com` is set up at Resend directly (not via Lovable Emails). The prospector functions already use Resend API directly, so this is just a `from` address change — the domain must be verified in Resend's dashboard.

### Changes

**1. Update sender address in 3 edge functions**


| File                                          | Current `from`                 | New `from`                 |
| --------------------------------------------- | ------------------------------ | -------------------------- |
| `pipeline-drip-send/index.ts` (line 173)      | `matt@mattmichelstraining.com` | `matt@detroitwebagent.com` |
| `pipeline-batch-drip/index.ts` (line 171)     | `matt@mattmichelstraining.com` | `matt@detroitwebagent.com` |
| `neo-outreach/index.ts` (lines 283, 348, 393) | `matt@mattmichelstraining.com` | `matt@detroitwebagent.com` |


Also add `reply-to: matt@detroitwebagent.com` header so replies go to the new inbox. Keep BCC to `matthewmichels4@gmail.com` so everything lands in Gmail.

**2. Create `prospect_email_log` table (migration)**

```sql
CREATE TABLE public.prospect_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_lead_id uuid REFERENCES prospect_pipeline(id) ON DELETE CASCADE,
  business_name text,
  recipient_email text NOT NULL,
  subject text,
  drip_step integer,
  status text DEFAULT 'sent',  -- sent, opened, clicked, bounced, failed
  resend_id text,              -- Resend message ID for tracking
  sent_at timestamptz DEFAULT now(),
  opened_at timestamptz,
  clicked_at timestamptz
);
ALTER TABLE public.prospect_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_prospect_email_log" ON public.prospect_email_log
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

**3. Log every send in edge functions**

Update `pipeline-drip-send` and `pipeline-batch-drip` to insert into `prospect_email_log` after each successful Resend send, capturing the Resend message ID.

**4. Add "Sent" tab + Clear functionality to AdminProspector.tsx**

- Add a 5th pipeline stage: `{ key: "sent_complete", label: "Sent", color: "..." }` — or better, add a **"Sent Log" sub-tab** within the Pipeline tab
- **Sent Log view**: Table showing all emails sent with columns: Business, Email, Subject, Step, Sent Date, Status
- **Clear Pipeline button**: Bulk action to archive/delete leads from the pipeline (move to a `pipeline_stage = "archived"` state or hard delete)
- **Clear filters**: "Clear Sent" moves all `outreach_sent` leads to archived, keeping the active pipeline clean

**5. Gmail forwarding note**

For `matt@detroitwebagent.com` to show up in Gmail (both sent and received):

- **Receiving**: Set up email forwarding in the domain provider (or Resend inbound) to forward to `matthewmichels4@gmail.com`
- **Sending**: In Gmail Settings → Accounts → "Send mail as" → add `matt@detroitwebagent.com` (requires SMTP or alias verification)
- This is a DNS/Gmail config step outside the codebase — will provide instructions
- Then we need to test and make sure its working before we stop working.

### Files Modified


| File                                              | Change                                            |
| ------------------------------------------------- | ------------------------------------------------- |
| New migration                                     | Create `prospect_email_log` table                 |
| `supabase/functions/pipeline-drip-send/index.ts`  | Change `from` to `detroitwebagent.com`, log sends |
| `supabase/functions/pipeline-batch-drip/index.ts` | Change `from` to `detroitwebagent.com`, log sends |
| `supabase/functions/neo-outreach/index.ts`        | Change `from` to `detroitwebagent.com`            |
| `src/components/admin/AdminProspector.tsx`        | Add Sent Log tab, Clear/Archive actions           |


### No Impact On

- M² Training email flows (newsletter, welcome emails, etc.) — those stay on `mattmichelstraining.com`
- Lovable Email infrastructure (notify.mattmichelstraining.com) — unaffected