
-- Create category enum for product wiki
CREATE TYPE public.wiki_category AS ENUM ('core_product', 'add_on', 'system', 'process');

-- product_wiki table
CREATE TABLE public.product_wiki (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL,
  category wiki_category NOT NULL DEFAULT 'core_product',
  description TEXT DEFAULT '',
  client_description TEXT DEFAULT '',
  priority_rank INTEGER DEFAULT 0,
  tech_stack TEXT[] DEFAULT '{}',
  monthly_operating_cost NUMERIC DEFAULT 0,
  dev_hours_spent NUMERIC DEFAULT 0,
  active_hooks_count INTEGER DEFAULT 0,
  agent_connections TEXT[] DEFAULT '{}',
  printable_steps JSONB DEFAULT '[]',
  updated_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_wiki ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_product_wiki" ON public.product_wiki FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_product_wiki" ON public.product_wiki FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_product_wiki_updated_at BEFORE UPDATE ON public.product_wiki FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_product_wiki_category ON public.product_wiki (category);

-- business_strategy table (single-row config)
CREATE TABLE public.business_strategy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  primary_targets TEXT[] DEFAULT '{}',
  secondary_targets TEXT[] DEFAULT '{}',
  monthly_overhead_target NUMERIC DEFAULT 0,
  monthly_revenue_target NUMERIC DEFAULT 0,
  mission_statement TEXT DEFAULT '',
  competitive_advantages TEXT[] DEFAULT '{}',
  key_risks TEXT[] DEFAULT '{}',
  quarterly_goals JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_strategy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_business_strategy" ON public.business_strategy FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_business_strategy" ON public.business_strategy FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_business_strategy_updated_at BEFORE UPDATE ON public.business_strategy FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ad_spend_allocation table
CREATE TABLE public.ad_spend_allocation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  percentage_allocation NUMERIC DEFAULT 0,
  monthly_budget NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'planned',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_spend_allocation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_ad_spend" ON public.ad_spend_allocation FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_ad_spend" ON public.ad_spend_allocation FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ad_spend_updated_at BEFORE UPDATE ON public.ad_spend_allocation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
