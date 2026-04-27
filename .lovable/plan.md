# Trojan Horse Outreach v2 — Enrich → Opus → One-Click Gmail Send

## What you'll get

A 3-step flow on the existing Trojan Horse tab:

1. **Cherry-Pick** the proof candidate (already works)
2. **Enrich** the agency → finds the real decision-maker's name + verified email via Apollo → Hunter → Snov waterfall
3. **Draft with Opus** → uses the enriched contact name in greeting, builds a beautifully-formatted HTML email with teaser candidate cards (no PII leak), inline CTA buttons, and your DWA branding
4. **Send via Gmail** → one click sends from `matt@detroitwebagent.com` through your Gmail account (no copy-paste)

## How it will look

```text
┌─────────────────────────────────────────────────────────────┐
│ Aerotek                          [INDUSTRIAL]               │
│ Director of Recruiting · Largest skilled trades MI          │
│                                                             │
│ ✓ Cherry-picked: Bhagya Sree (Data Analyst · Southfield)   │
│ ✓ Enriched: Sarah Chen <sarah.chen@aerotek.com> (Apollo)   │
│                                                             │
│ [🎯 Cherry-Pick] [⚡ Enrich Contact] [✨ Draft with Opus]   │
│ ─────────────────────────────────────────────────────────── │
│ ┌─ HTML PREVIEW ──────────────────────────────────────┐    │
│ │ Subject: Pre-market Data Analyst — Oakland County   │    │
│ │                                                      │    │
│ │ Hi Sarah,                                            │    │
│ │ Matt Michels here from Detroit Web Agency...        │    │
│ │                                                      │    │
│ │ ┌─ CANDIDATE TEASER ──────────────────────┐        │    │
│ │ │ ✓ Data & Apps Analyst · Oakland County  │        │    │
│ │ │ ✓ Exceptional signal · pre-market       │        │    │
│ │ │ [👁 View Full Profile →]                 │        │    │
│ │ └──────────────────────────────────────────┘        │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                             │
│ [📤 Send via Gmail]  [📋 Copy HTML]  [✉ Open in mail]      │
└─────────────────────────────────────────────────────────────┘
```

## Technical plan

### 1. Gmail connector (new)

Connect the **Google Mail** standard connector to your project, scoped to `gmail.send` and `gmail.compose`. This authorizes YOUR Gmail (`matt@detroitwebagent.com`) — exactly the use case the connector is designed for. Lovable handles OAuth.

### 2. New table: `agency_contact_enrichments`

Stores resolved decision-makers per agency so you don't pay Apollo twice.

```sql
create table public.agency_contact_enrichments (
  id uuid primary key default gen_random_uuid(),
  agency_name text not null unique,
  contact_first_name text,
  contact_last_name text,
  contact_title text,
  contact_email text,
  email_status text,             -- verified | guessed | failed
  source text,                    -- apollo | hunter | snov | pattern
  enriched_at timestamptz default now(),
  meta jsonb
);
alter table ... enable row level security;
create policy "admin manage" on ... using (public.has_role(auth.uid(),'admin'));
```

### 3. New edge function: `agency-contact-enrich`

Reuses your unified enrichment waterfall pattern:
- **Stage 1 — Apollo** `mixed_people/search` filtered by `organization_name=agency` + `person_titles=[Director of Recruiting, VP Recruiting, Branch Manager, ...]` based on the agency's role hint
- **Stage 2 — Hunter.io** domain search if Apollo misses (`agency-domain.com` → highest-confidence person)
- **Stage 3 — Snov** as final fallback
- **Stage 4 — pattern guess** (`first.last@domain.com`) tagged `email_status='guessed'`
- Caches result in `agency_contact_enrichments`, returns the contact object

### 4. Upgrade edge function: `agency-outreach-draft`

- Accept new fields: `contact_first_name`, `contact_email`, `cherry_picked_candidate` (full object with role/county/signal)
- Update Opus prompt to greet by **first name**, reference enriched title, and produce **two outputs**:
  - `subject` (string)
  - `html_body` (rich HTML — uses the DWA email template skeleton from `_shared/email-templates/`, with a styled "candidate teaser card" section and a `[View Full Profile]` button linking to a tokenized preview URL)
  - `plain_body` (fallback)
- Strip all PII from the teaser per `sanitize-candidate.ts` rules (role + county + signal tier only — no name, license, or source)

### 5. New edge function: `gmail-send-outreach`

- Verifies caller is admin
- Reads Gmail token from the linked connector via the connector gateway (`https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send`)
- Builds RFC 2822 MIME message (HTML + plain text alternative, From: `matt@detroitwebagent.com`)
- Base64url encodes, POSTs to Gmail API
- Logs send to `system_comms_log` with `channel='email_gmail'`
- Inserts row in `ai_action_queue` with `status='sent'` for audit

### 6. Frontend: `AdminAgencyOutreach.tsx` rewrite

- Add `enrichments` state keyed by agency name
- New "Enrich Contact" button (between Cherry-Pick and Draft) with loading state
- Show enrichment chip: `✓ Sarah Chen <sarah.chen@aerotek.com> (Apollo, verified)` or amber chip for guessed
- Render draft as **HTML preview** in an iframe sandbox (not raw `<pre>`)
- Replace "Open in mail" with **`📤 Send via Gmail`** primary button (calls `gmail-send-outreach`), keep Copy HTML as secondary
- Send button disabled until: enriched contact has email + draft exists + admin confirms via toast

### 7. Email design upgrade

New shared template `_shared/email-templates/trojan-horse-outreach.ts` exports `buildTrojanHorseHtml({ greeting, intro_paragraph, candidate_teaser, cta_url, signature })`:
- DWA branded header (teal `#00d4ff` accent bar, white background per email rules)
- Personal-feeling typography (Inter/system, no marketing-email feel — looks like Matt typed it)
- Candidate teaser card: subtle gray border, role/county/signal tier badges, single CTA button
- Footer with Matt's actual signature block + DWA wordmark

## Files

**New:**
- `supabase/migrations/<ts>_agency_contact_enrichments.sql`
- `supabase/functions/agency-contact-enrich/index.ts`
- `supabase/functions/gmail-send-outreach/index.ts`
- `supabase/functions/_shared/email-templates/trojan-horse-outreach.ts`

**Modified:**
- `supabase/functions/agency-outreach-draft/index.ts` (HTML output + first-name greeting)
- `src/components/dwa-admin/AdminAgencyOutreach.tsx` (enrich button, HTML preview, Gmail send)
- `supabase/config.toml` (`verify_jwt = true` for both new functions — admin-only)

## Required setup before I can ship this

1. **Connect Gmail** — I'll trigger the connector flow; you'll click "Authorize" once and grant `gmail.send` + `gmail.compose` to your `matt@detroitwebagent.com` account
2. Apollo/Hunter/Snov keys — already configured ✓

## Out of scope (ask if you want them)

- Auto-send on a timer (intentionally manual per TCPA-safe note in your current UI)
- Reply tracking / inbox sync (would need `gmail.readonly` + a polling cron)
- A/B subject line testing
