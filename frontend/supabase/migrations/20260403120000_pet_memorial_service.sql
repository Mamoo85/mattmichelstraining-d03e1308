-- ═══════════════════════════════════════════════════════════════
-- AI Pet Memorial & Tribute Service
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pet_memorial_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pet_name TEXT NOT NULL,
  pet_species TEXT,
  pet_breed TEXT,
  pet_age TEXT,
  personality_traits TEXT,
  favorite_memories TEXT,
  special_message TEXT,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  -- Aliases so AdminOpsCenter generic query works (selects email, business_name)
  email TEXT GENERATED ALWAYS AS (customer_email) STORED,
  business_name TEXT GENERATED ALWAYS AS (COALESCE(customer_name, customer_email)) STORED,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  active BOOLEAN NOT NULL DEFAULT false,
  stripe_session_id TEXT,
  memorial_url_slug TEXT UNIQUE,
  poem_generated TEXT,
  tribute_generated TEXT,
  social_caption TEXT,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pet_memorial_submissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own submissions
CREATE POLICY "user_reads_own_pet_memorial"
  ON pet_memorial_submissions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "service_role_all_pet_memorial"
  ON pet_memorial_submissions
  FOR ALL
  USING (true);

-- Public can read published memorials (slug is set and email was sent)
CREATE POLICY "public_reads_published_pet_memorial"
  ON pet_memorial_submissions
  FOR SELECT
  USING (memorial_url_slug IS NOT NULL AND email_sent = true);
