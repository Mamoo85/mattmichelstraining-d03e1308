
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
  status TEXT NOT NULL DEFAULT 'pending',
  admin_edit TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.coach_ai_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes see own approved drafts"
  ON public.coach_ai_drafts FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND status = 'approved');

CREATE POLICY "Admins manage all drafts"
  ON public.coach_ai_drafts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Athletes can ask questions"
  ON public.coach_ai_drafts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
