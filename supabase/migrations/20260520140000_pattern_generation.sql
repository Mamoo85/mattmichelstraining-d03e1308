-- Pattern Generation Pipeline — Seamless Surface Pattern Generator
-- Stores Midjourney job state and collection assembly for digital pattern bundles.

-- ── 1. Pattern jobs tracking ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pattern_jobs (
  id            bigserial    PRIMARY KEY,
  niche         text         NOT NULL,
  aesthetic     text         NOT NULL,
  mj_job_id     text,
  mj_prompt     text         NOT NULL,
  status        text         NOT NULL DEFAULT 'submitted',  -- submitted|completed|failed
  image_url     text,                                       -- GoAPI.ai CDN URL (raw output)
  storage_path  text,                                       -- Supabase Storage path after download
  collection_id bigint,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

-- ── 2. Pattern collection bundles ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pattern_collections (
  id            bigserial    PRIMARY KEY,
  title         text         NOT NULL,
  niche         text         NOT NULL,
  aesthetic     text         NOT NULL,
  pattern_count int          NOT NULL DEFAULT 0,
  target_count  int          NOT NULL DEFAULT 5,    -- 5 or 10 per niche tier
  status        text         NOT NULL DEFAULT 'assembling',  -- assembling|ready|packaged|published
  zip_path      text,
  queue_id      bigint       REFERENCES pod_product_queue(id),
  created_at    timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE pattern_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pattern_jobs
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service role full access" ON pattern_collections
  FOR ALL USING (auth.role() = 'service_role');

-- ── 3. Seed fabric/paper niches into pod_niche_library ────────────────────────
INSERT INTO pod_niche_library (niche, active, source)
VALUES
  ('moody celestial goth fabric pattern', true, 'pattern'),
  ('retro 90s checkered coquette bow digital paper', true, 'pattern'),
  ('boho muted cottagecore floral surface design', true, 'pattern'),
  ('dark academia vintage botanical seamless print', true, 'pattern'),
  ('pastel kawaii seamless scrapbook paper pattern', true, 'pattern'),
  ('maximalist chinoiserie wallpaper repeat pattern', true, 'pattern')
ON CONFLICT (niche) DO NOTHING;
