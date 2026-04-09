

# White-Label Lead Generation SaaS — Build Plan

## Overview
Build a multi-tenant "Lead Gen as a Service" dashboard where your agency clients log in and see only their own enriched B2B leads. Includes an embeddable capture widget and webhook edge functions.

## Architecture

```text
┌─────────────────────────────────────────────┐
│  Supabase Database                          │
│                                             │
│  tenants (id, user_id, company, branding)   │
│       ↕ RLS: user_id = auth.uid()           │
│                                             │
│  tenant_leads (id, tenant_id FK, name,      │
│    company, job_title, email, validated_email│
│    enrichment_data JSONB,                   │
│    drip_campaign_status JSONB, ...)         │
│       ↕ RLS: tenant_id via tenants.user_id  │
│                                             │
│  capture_submissions (id, tenant_id,        │
│    email, source_url, ...)                  │
│       ↕ RLS: anon INSERT, tenant SELECT     │
└─────────────────────────────────────────────┘

┌───────────────┐  ┌──────────────────────┐
│ /client-dash  │  │ /embed/capture/:tid  │
│ (Protected)   │  │ (Public, no nav,     │
│ Lead table +  │  │  transparent bg,     │
│ expand modal  │  │  iframe-ready)       │
└───────────────┘  └──────────────────────┘

Edge Functions:
  • rb2b-webhook — receives RB2B visitor data, maps to tenant, inserts lead
  • capture-enrich — triggered on capture submission, placeholder for enrichment
```

## Step-by-Step Execution

### Step 1: Database Schema & RLS

**Migration SQL:**
1. Create `tenants` table — `id (uuid PK)`, `user_id (uuid, references auth.users, unique)`, `company_name`, `domain`, `branding JSONB`, `created_at`. RLS: users can only SELECT/UPDATE their own row. Service role bypass.

2. Create `tenant_leads` table — `id`, `tenant_id (FK tenants)`, `first_name`, `last_name`, `company_name`, `job_title`, `email`, `validated_email`, `phone`, `website`, `linkedin_url`, `enrichment_data JSONB`, `drip_campaign_status JSONB DEFAULT '{}'`, `source`, `created_at`, `updated_at`. RLS: SELECT/UPDATE/DELETE only where `tenant_id` matches the authenticated user's tenant. Service role full access.

3. Create `capture_submissions` table — `id`, `tenant_id`, `email`, `name`, `source_url`, `processed BOOLEAN DEFAULT false`, `created_at`. RLS: anon/public INSERT allowed (for iframe widget), SELECT restricted to tenant owner.

4. Security-definer helper function `get_tenant_id(_user_id uuid)` to avoid recursive RLS lookups.

### Step 2: Client Dashboard UI

- **New page**: `src/pages/ClientDashboard.tsx` at route `/client-dash`
- Dark theme, minimal layout — no existing site chrome (separate from M2 training nav)
- Components:
  - `LeadTable` — columns: Name, Company, Job Title, Email. Pagination. Search filter.
  - `LeadDetailModal` — full enrichment data + drip campaign status timeline
  - Top stats bar: Total Leads, Verified Emails, Active Drips
- Data fetched via Supabase client; RLS ensures tenant isolation automatically
- Protected by `ProtectedRoute`
- Seeded with ~10 dummy rows per tenant for demo purposes

### Step 3: Embeddable Capture Widget

- **New page**: `src/pages/EmbedCapture.tsx` at route `/embed/capture/:tenantId`
- Completely isolated: no `<BottomTabBar>`, no nav, transparent `body` background
- Minimal form: Name + Email + Submit button
- On submit: inserts into `capture_submissions` with the `tenantId` from URL params
- Styled as a floating card with dark glass aesthetic
- Provides embed instructions snippet: `<iframe src="https://m2training.lovable.app/embed/capture/TENANT_ID" ...>`

### Step 4: Edge Function Webhooks

1. **`rb2b-webhook`** (`supabase/functions/rb2b-webhook/index.ts`)
   - POST endpoint, `verify_jwt = false`
   - Receives RB2B visitor payload (email, name, company, job title, LinkedIn)
   - Looks up tenant by domain mapping
   - Upserts into `tenant_leads`
   - Returns 200 OK

2. **`capture-enrich`** (`supabase/functions/capture-enrich/index.ts`)
   - POST endpoint, accepts `{ submission_id }`
   - Reads from `capture_submissions`, placeholder logic to call enrichment APIs
   - Upserts enriched data into `tenant_leads`
   - Marks submission as `processed = true`

## Technical Notes
- The existing `prospect_pipeline` table is for Matt's internal use and will NOT be modified. This is a separate, isolated multi-tenant system.
- Auth uses the existing Supabase auth system. New clients sign up via the standard Auth page. A `tenants` row is auto-created via a database trigger on signup (or manually by admin).
- The `get_tenant_id` security-definer function prevents RLS recursion when `tenant_leads` policies reference the `tenants` table.

