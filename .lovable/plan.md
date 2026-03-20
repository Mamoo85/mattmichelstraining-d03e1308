

# RAG Coaching Assistant — Full-Text Search + Admin Approval

## Overview
Build an "Ask Coach" floating chat on the dashboard. Uses full-text search (no embedding API needed) to retrieve relevant coaching documents, then generates AI answers via Lovable AI (Gemini Flash). **All AI responses are queued as drafts — only admin-approved answers reach athletes.**

## Database Migration

```sql
-- Coaching documents table (admin-managed knowledge base)
CREATE TABLE public.coaching_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  content TEXT NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title,'') || ' ' || content)
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_coaching_docs_search ON public.coaching_documents USING GIN (search_vector);

ALTER TABLE public.coaching_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read coaching docs"
  ON public.coaching_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage coaching docs"
  ON public.coaching_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Full-text search function
CREATE OR REPLACE FUNCTION public.search_coaching_documents(query TEXT, match_count INT DEFAULT 5)
RETURNS TABLE (id UUID, title TEXT, content TEXT, rank REAL)
LANGUAGE sql STABLE AS $$
  SELECT cd.id, cd.title, cd.content,
    ts_rank(cd.search_vector, plainto_tsquery('english', query)) AS rank
  FROM public.coaching_documents cd
  WHERE cd.search_vector @@ plainto_tsquery('english', query)
  ORDER BY rank DESC
  LIMIT match_count;
$$;

-- AI draft answers table (admin approval queue)
CREATE TABLE public.coach_ai_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  ai_answer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  admin_edit TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.coach_ai_drafts ENABLE ROW LEVEL SECURITY;

-- Athletes see only their own approved answers
CREATE POLICY "Athletes see own approved drafts"
  ON public.coach_ai_drafts FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND status = 'approved');

-- Admins see all
CREATE POLICY "Admins manage all drafts"
  ON public.coach_ai_drafts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Athletes can insert (ask questions)
CREATE POLICY "Athletes can ask questions"
  ON public.coach_ai_drafts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
```

## Edge Function — `ask-coach`

- Accepts `{ message }` + auth token
- Calls `search_coaching_documents` RPC for top-5 matches
- Sends context + question to Gemini Flash with Coach Matt system prompt
- **Does NOT stream back to user.** Instead, inserts the AI answer into `coach_ai_drafts` with `status: 'pending'`
- Returns `{ queued: true }` to the client
- Registered in `config.toml` with `verify_jwt = false`, validates JWT in code

## Frontend Components

### 1. `src/components/dashboard/AskCoachBubble.tsx`
- Floating chat bubble (bottom-right corner) on Dashboard
- User types question → calls `ask-coach` edge function
- Shows confirmation: "Your question has been sent to Coach Matt. You'll be notified when he responds."
- Below the input, shows history of **approved** answers (fetched from `coach_ai_drafts` where `status = 'approved'`)
- No AI text is ever shown to the user without admin approval

### 2. Admin: `src/components/admin/AdminCoachAiQueue.tsx`
- New tab/section in Admin dashboard
- Lists all `pending` drafts with: athlete name, question, AI-generated answer
- Admin can: **Approve** (as-is), **Edit & Approve** (modify the answer), or **Reject**
- On approval, updates `status = 'approved'` and inserts a notification for the athlete
- On reject, updates `status = 'rejected'` (optionally with a note)

### 3. Admin: Coaching Documents Manager
- Simple CRUD in Admin dashboard to add/edit/delete coaching documents (title + content)
- These form the knowledge base the AI searches against

## File Changes

| File | Action |
|------|--------|
| Migration SQL | `coaching_documents` + `coach_ai_drafts` tables + search function |
| `supabase/functions/ask-coach/index.ts` | New edge function |
| `supabase/config.toml` | Register `ask-coach` |
| `src/components/dashboard/AskCoachBubble.tsx` | New floating chat UI |
| `src/components/admin/AdminCoachAiQueue.tsx` | New admin approval queue |
| `src/pages/Dashboard.tsx` | Add `<AskCoachBubble />` |
| `src/pages/Admin.tsx` | Add AI Queue tab + Documents manager |

## Security Summary
- AI never contacts a user directly — all answers go through `coach_ai_drafts` with `pending` status
- Only `approved` answers are visible to athletes (enforced by RLS)
- Admin approval is the only path from AI generation to athlete visibility
- Coaching documents are admin-only write, authenticated read

