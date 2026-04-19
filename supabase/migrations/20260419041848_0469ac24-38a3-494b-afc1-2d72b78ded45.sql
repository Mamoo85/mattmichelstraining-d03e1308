-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Augment llm_response_cache for semantic search + content-type TTL
ALTER TABLE public.llm_response_cache
  ADD COLUMN IF NOT EXISTS prompt_embedding vector(768),
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS model_family text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS prompt_preview text;

-- IVFFlat index for cosine similarity (lists=100 is reasonable up to ~1M rows)
CREATE INDEX IF NOT EXISTS idx_llm_cache_embedding
  ON public.llm_response_cache
  USING ivfflat (prompt_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_llm_cache_family_type
  ON public.llm_response_cache (model_family, content_type)
  WHERE prompt_embedding IS NOT NULL;

-- 2. Track cache tier on every AI call for ROI dashboards
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_call_log' AND column_name='cache_tier'
  ) THEN
    ALTER TABLE public.ai_call_log
      ADD COLUMN cache_tier text NOT NULL DEFAULT 'miss'
      CHECK (cache_tier IN ('exact_hit','semantic_hit','negative_hit','miss'));
  END IF;
END$$;

-- 3. Semantic match function — returns the single best hit above threshold
CREATE OR REPLACE FUNCTION public.match_llm_cache(
  _embedding vector(768),
  _threshold float DEFAULT 0.92,
  _model_family text DEFAULT NULL,
  _content_type text DEFAULT NULL
) RETURNS TABLE(
  id uuid,
  response jsonb,
  similarity float,
  hit_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.response,
    1 - (c.prompt_embedding <=> _embedding) AS similarity,
    c.hit_count
  FROM public.llm_response_cache c
  WHERE c.prompt_embedding IS NOT NULL
    AND c.expires_at > now()
    AND (_model_family IS NULL OR c.model_family = _model_family)
    AND (_content_type IS NULL OR c.content_type = _content_type)
    AND 1 - (c.prompt_embedding <=> _embedding) >= _threshold
  ORDER BY c.prompt_embedding <=> _embedding ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.match_llm_cache(vector, float, text, text) TO service_role;