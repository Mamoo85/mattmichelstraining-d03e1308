## Goal

Two tightly-linked features for the Fax / Outreach panels:

1. **Lead Email Enrichment** — for every fax/lead row in `outreach_leads`, look up and store the best email address using the existing 6-stage waterfall (Snov → Apollo → pattern-verify → Hunter → PDL → site_scrape). Persist the result, the source, and a confidence score so we never re-enrich the same lead twice.
2. **"Send from My Gmail" one-click button** — once a lead has an enriched email, a single button on each row sends a personalized message **from the operator's connected Gmail account** (not Resend, not Twilio) to that enriched email. Uses the Gmail connector gateway so the message lands in the recipient's inbox as a real human-to-human email — perfect for warm follow-up after a fax.

Both pieces are gated behind the existing manual-only compliance flow (no automation, no bulk send) — the operator clicks "Enrich" then "Send" per row.

---

## What the user sees

In the "Recent FAX Sends" table on the Fax tab (and Postcard / SMS tabs), each row gets two new chips next to the existing "View Copy" eye icon:

```text
[Acme Roofing]  Detroit · roofer · 2026-04-26  [SENT]
   Fax #: +13135551234
   Email: bob@acmeroof.com  ✓ verified (snov)        [📧 Send from Gmail]
```

If no email yet:
```text
[Acme Roofing]  Detroit · roofer · 2026-04-26  [SENT]
   Fax #: +13135551234
   Email: —                                          [🔍 Find Email]
```

Click **🔍 Find Email** → toast progress ("Trying Snov…", "Trying Apollo…", "Verified via pattern-match"). When it finds one, the chip updates inline.

Click **📧 Send from Gmail** → opens a small dialog pre-filled with subject + body (editable), shows the Gmail account it'll send from (e.g. *matt@detroitwebagent.com*), confirm → message sends via Gmail API, audit log row written, button changes to `✓ Sent 2:41 PM`.

If Gmail isn't connected yet, the button opens the connector picker first (Lovable's standard `connect` flow).

---

## Technical plan

### 1. Database — extend `outreach_leads`

Migration `add_lead_email_enrichment.sql`:

```sql
ALTER TABLE outreach_leads
  ADD COLUMN IF NOT EXISTS enriched_email text,
  ADD COLUMN IF NOT EXISTS enriched_email_source text,    -- snov | apollo | pattern | hunter | pdl | site
  ADD COLUMN IF NOT EXISTS enriched_email_confidence int, -- 0-100
  ADD COLUMN IF NOT EXISTS enriched_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_trace jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gmail_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS gmail_message_id text;

CREATE INDEX IF NOT EXISTS idx_outreach_leads_enriched_email
  ON outreach_leads (enriched_email) WHERE enriched_email IS NOT NULL;
```

New audit table for Gmail sends:

```sql
CREATE TABLE outreach_gmail_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outreach_lead_id uuid REFERENCES outreach_leads(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES auth.users(id),
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  gmail_message_id text,
  status text NOT NULL,           -- sent | failed
  error text,
  sent_at timestamptz DEFAULT now()
);
ALTER TABLE outreach_gmail_sends ENABLE ROW LEVEL SECURITY;
-- service_role bypass + admin SELECT via has_role('admin')
```

### 2. Edge function — `outreach-lead-enrich-email`

New function. Input: `{ outreach_lead_id }`. Reuses the **existing** 6-stage waterfall logic from `lead-enrichment-waterfall` / `agency-contact-enrich` — does NOT duplicate provider code, just orchestrates against the lead's `business_name + city + industry + website` (derived from the Maps payload already on the row).

Returns:
```json
{ ok: true, email: "bob@acme.com", source: "snov", confidence: 92, trace: [...] }
```

Persists `enriched_email*` columns and pushes the trace into `enrichment_trace`. If all 6 stages fail, returns `{ ok: false, trace: [...] }` so the UI can surface "why".

### 3. Edge function — `outreach-gmail-send`

New function — uses the **Gmail connector gateway**, NOT Resend.

```ts
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_mail/gmail/v1';
// POST /users/me/messages/send  with base64url RFC2822 body
// Headers: Authorization: Bearer ${LOVABLE_API_KEY}, X-Connection-Api-Key: ${GOOGLE_MAIL_API_KEY}
```

Flow:
1. Auth-check JWT (verify_jwt = true on this one — only logged-in admins can send from their Gmail).
2. Validate body with Zod: `{ outreach_lead_id, subject, body }`.
3. Load lead, ensure `enriched_email` is present and not in `sms_opt_outs` / suppression list.
4. Build RFC 2822 message (To/Subject/Content-Type) → base64url encode.
5. POST to gateway `/users/me/messages/send`.
6. On 200 → update `outreach_leads.gmail_sent_at` + `gmail_message_id`, insert `outreach_gmail_sends` row with `status='sent'`.
7. On 403 `insufficient authentication scopes` → return `{ ok: false, needs_reconnect: true, missing_scope: 'gmail.send' }` so UI can trigger reconnect.
8. On other errors → log to `outreach_gmail_sends` with `status='failed'` + error.

Compliance: every send recorded; manual-only (one click per row, no batch endpoint); honors suppression list before sending.

### 4. Connector setup (one-time, by user)

When the operator first clicks "Send from Gmail", if Gmail isn't connected we call:
```text
standard_connectors--connect(connector_id="google_mail")
```
The Lovable picker handles OAuth. Required scope: `https://www.googleapis.com/auth/gmail.send` (and `gmail.readonly` for "from" address display).

### 5. Frontend changes — `ChannelOutreachTab.tsx`

Per row:
- New `LeadEmailCell` subcomponent: shows enriched email + source badge, or a "🔍 Find Email" button when missing. Clicking calls `outreach-lead-enrich-email` with progress toasts using `sonner`'s `toast.loading()` updated as the function streams trace events back (single round trip — toast advances on `setTimeout` based on the trace timeline returned).
- New `GmailSendDialog` component: opens on "📧 Send from Gmail" click. Pre-fills subject (`"Following up on the fax we sent to {{business}}"`) and body (operator-editable, with merge tokens for `{{business_name}}`, `{{city}}`, `{{trade}}`). Footer shows the connected Gmail account; "Send" calls `outreach-gmail-send`.
- After successful send: row chip shows `✓ Sent {time}` and disables the button.

### 6. Files

**New**:
- `supabase/migrations/{ts}_outreach_lead_email_enrichment.sql`
- `supabase/functions/outreach-lead-enrich-email/index.ts`
- `supabase/functions/outreach-gmail-send/index.ts`
- `src/components/admin/outreach/LeadEmailCell.tsx`
- `src/components/admin/outreach/GmailSendDialog.tsx`

**Edited**:
- `src/components/admin/ChannelOutreachTab.tsx` — render the two new components per row, expand the `select(...)` to include the new enrichment + gmail columns
- `supabase/config.toml` — `verify_jwt = false` for `outreach-lead-enrich-email` (admin-only via service-role check inside), `verify_jwt = true` for `outreach-gmail-send`

### 7. Out of scope (explicitly)

- No bulk "Enrich All" button — manual one-row-at-a-time only (TCPA / CAN-SPAM safety).
- No automatic Gmail send after enrichment — operator must click Send.
- No Gmail thread tracking / reply ingestion in this pass (reply ingestion via Gmail watch can be a follow-up).
- No changes to the existing fax/postcard/SMS sending paths — Gmail is an *additional* channel triggered by the operator after a fax goes out.

---

## Risks + mitigations

- **Gmail send-rate limits** (Google: ~500/day per Gmail account, ~2k/day for Workspace). We're manual-click — well below. UI shows a counter `"Gmail sends today: 12 / 500"` pulled from `outreach_gmail_sends` count.
- **OAuth scope drift** — if the user only granted `gmail.readonly`, the send call returns 403; UI catches `needs_reconnect: true` and prompts a one-click reconnect with `gmail.send` pre-selected.
- **Enrichment cost** — each click hits up to 6 paid providers. We persist the result so a second click on the same lead is free. Trace shows which provider succeeded so we can tune order over time.

**Approve and I'll build it.**