
CREATE OR REPLACE FUNCTION public.search_coaching_documents(query TEXT, match_count INT DEFAULT 5)
RETURNS TABLE (id UUID, title TEXT, content TEXT, rank REAL)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT cd.id, cd.title, cd.content,
    ts_rank(cd.search_vector, plainto_tsquery('english', query)) AS rank
  FROM public.coaching_documents cd
  WHERE cd.search_vector @@ plainto_tsquery('english', query)
  ORDER BY rank DESC
  LIMIT match_count;
$$;
