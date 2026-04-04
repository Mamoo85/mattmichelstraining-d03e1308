
CREATE TABLE IF NOT EXISTS public.dark_web_monitor_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  email text NOT NULL,
  monitored_domain text NOT NULL,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  plan_type text DEFAULT 'direct',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.dark_web_monitor_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on dark_web_monitor_clients" ON public.dark_web_monitor_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.dark_web_monitor_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.dark_web_monitor_clients(id) ON DELETE CASCADE,
  breach_name text,
  breach_date text,
  data_classes text[],
  email_found text,
  domain text,
  severity text DEFAULT 'medium',
  notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.dark_web_monitor_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on dark_web_monitor_findings" ON public.dark_web_monitor_findings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.gov_contract_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  email text NOT NULL,
  naics_codes text,
  keywords text,
  set_aside_types text,
  min_contract_value integer,
  max_contract_value integer,
  preferred_states text,
  customer_name text,
  active boolean DEFAULT true,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.gov_contract_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on gov_contract_clients" ON public.gov_contract_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.gov_contract_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.gov_contract_clients(id) ON DELETE CASCADE,
  notice_id text,
  title text,
  agency text,
  posted_date text,
  response_deadline text,
  naics_code text,
  set_aside text,
  url text,
  ai_score integer,
  ai_summary text,
  notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.gov_contract_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on gov_contract_opportunities" ON public.gov_contract_opportunities FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.regulatory_monitor_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  email text NOT NULL,
  industry text,
  keywords text,
  active boolean DEFAULT true,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.regulatory_monitor_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on regulatory_monitor_clients" ON public.regulatory_monitor_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.regulatory_monitor_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.regulatory_monitor_clients(id) ON DELETE CASCADE,
  document_number text,
  title text,
  abstract text,
  publication_date text,
  document_type text,
  agencies text,
  url text,
  ai_summary text,
  relevance_score integer,
  notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.regulatory_monitor_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on regulatory_monitor_items" ON public.regulatory_monitor_items FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.competitor_pricing_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  email text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.competitor_pricing_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on competitor_pricing_clients" ON public.competitor_pricing_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.competitor_pricing_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.competitor_pricing_clients(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text,
  last_hash text,
  last_checked_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.competitor_pricing_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on competitor_pricing_urls" ON public.competitor_pricing_urls FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.competitor_pricing_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url_id uuid REFERENCES public.competitor_pricing_urls(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.competitor_pricing_clients(id) ON DELETE CASCADE,
  old_hash text,
  new_hash text,
  diff_summary text,
  notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.competitor_pricing_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on competitor_pricing_changes" ON public.competitor_pricing_changes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.trademark_watch_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  email text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.trademark_watch_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on trademark_watch_clients" ON public.trademark_watch_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.trademark_watch_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.trademark_watch_clients(id) ON DELETE CASCADE,
  mark_text text NOT NULL,
  serial_number text,
  last_checked_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.trademark_watch_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on trademark_watch_marks" ON public.trademark_watch_marks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.trademark_watch_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mark_id uuid REFERENCES public.trademark_watch_marks(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.trademark_watch_clients(id) ON DELETE CASCADE,
  similar_mark text,
  serial_number text,
  filing_date text,
  applicant text,
  similarity_score integer,
  status text,
  notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.trademark_watch_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on trademark_watch_findings" ON public.trademark_watch_findings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.re_newsletter_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  email text NOT NULL,
  agent_name text,
  brokerage text,
  zip_codes text[],
  active boolean DEFAULT true,
  last_sent_at timestamptz,
  send_count integer DEFAULT 0,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.re_newsletter_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on re_newsletter_clients" ON public.re_newsletter_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.re_newsletter_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.re_newsletter_clients(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.re_newsletter_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on re_newsletter_contacts" ON public.re_newsletter_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.re_newsletter_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.re_newsletter_clients(id) ON DELETE CASCADE,
  zip_code text,
  subject text,
  html_content text,
  recipients integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.re_newsletter_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on re_newsletter_issues" ON public.re_newsletter_issues FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.podcast_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  email text NOT NULL,
  podcast_name text,
  rss_url text,
  active boolean DEFAULT true,
  last_checked_at timestamptz,
  episode_count integer DEFAULT 0,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.podcast_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on podcast_clients" ON public.podcast_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.podcast_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.podcast_clients(id) ON DELETE CASCADE,
  episode_title text,
  episode_url text,
  published_at text,
  content_pieces jsonb,
  notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on podcast_episodes" ON public.podcast_episodes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.pet_memorial_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  customer_name text,
  pet_name text NOT NULL,
  pet_species text,
  personality_traits text,
  favorite_memories text,
  poem text,
  tribute text,
  memorial_html text,
  status text DEFAULT 'pending',
  stripe_session_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.pet_memorial_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on pet_memorial_submissions" ON public.pet_memorial_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);
