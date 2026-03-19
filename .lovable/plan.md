

# Secure Biomechanics Pipeline & Admin Firewall

## Overview
Build the full backend pipeline for a "Biomechanics & Posture AI" module: storage bucket, database table, edge function with admin-only RBAC, and an admin UI component for uploading media, viewing AI findings, editing drafts, and approving assessments.

## Changes

### 1. Database Migration — `client_assessments` table
Create table with columns:
- `id` (uuid, PK, default gen_random_uuid())
- `client_user_id` (uuid, references profiles.user_id — the athlete being assessed)
- `admin_user_id` (uuid, not null — the admin who uploaded)
- `media_url` (text, not null)
- `ai_findings` (jsonb)
- `draft_program` (jsonb)
- `status` (text, default 'draft', check in ('draft','approved','rejected'))
- `created_at`, `updated_at` timestamps

RLS policies: only admins (via `has_role()`) can SELECT, INSERT, UPDATE.

### 2. Storage Bucket — `biomechanics_media`
Create bucket via migration. RLS policies on `storage.objects`:
- Admin-only INSERT (upload) where `bucket_id = 'biomechanics_media'` and `has_role(auth.uid(), 'admin')`
- Admin-only SELECT (view) with same check

### 3. Edge Function — `analyze-biomechanics`
- **File**: `supabase/functions/analyze-biomechanics/index.ts`
- **Config**: `verify_jwt = false` in config.toml, validate JWT in code via `getClaims()`
- **Admin check**: After JWT validation, call `has_role` RPC — if not admin, return 403
- **Input**: `{ mediaUrl, clientUserId }`
- **AI call**: Lovable AI Gateway with `google/gemini-2.5-flash`, vision-capable prompt
- **Structured output**: Use tool calling to force JSON with `findings` (string[]) and `program` (8-week structured block)
- **Save**: Insert result into `client_assessments` with status `'draft'`
- **Return**: The created assessment row

### 4. Admin UI Component — `AdminBiomechanics.tsx`
- **File**: `src/components/admin/AdminBiomechanics.tsx`
- Upload interface: file picker → upload to `biomechanics_media` bucket → call edge function
- Client selector dropdown (from profiles table)
- Draft list: fetch `client_assessments` where status = 'draft'
- Editable findings + program text areas
- "Approve & Assign" button → updates status to 'approved'
- Housed exclusively in the Training Engine tab of `/admin`

### 5. Wire into Admin Page
Add `AdminBiomechanics` as a new sub-tab "Biomechanics" under the Training Engine master tab in `src/pages/Admin.tsx`.

## Files
- **New**: `src/components/admin/AdminBiomechanics.tsx`, `supabase/functions/analyze-biomechanics/index.ts`
- **Edit**: `src/pages/Admin.tsx` (add import + sub-tab), `supabase/config.toml` (add function config)
- **Migrations**: Create `client_assessments` table + RLS, create `biomechanics_media` bucket + storage RLS

## Security
- No public access to any of these resources
- All gated behind `has_role(auth.uid(), 'admin')` at every layer (RLS, edge function, frontend route)
- The `/admin` route already has `useIsAdmin` guard — no additional route protection needed

