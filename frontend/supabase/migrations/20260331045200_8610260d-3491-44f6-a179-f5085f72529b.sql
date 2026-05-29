
-- Phase 2 Ventures: 5 client tables + 2 contact tables

CREATE TABLE public.permit_monitor_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  email text NOT NULL UNIQUE,
  industry text,
  city text,
  permits jsonb DEFAULT '[]'::jsonb,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.permit_monitor_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_permit" ON public.permit_monitor_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.osha_compliance_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  email text NOT NULL UNIQUE,
  industry text,
  employee_count integer,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.osha_compliance_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_osha" ON public.osha_compliance_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.collections_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  email text NOT NULL UNIQUE,
  industry text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.collections_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_collections" ON public.collections_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.collections_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.collections_clients(id) ON DELETE CASCADE NOT NULL,
  debtor_name text NOT NULL,
  debtor_email text,
  debtor_phone text,
  amount_owed numeric DEFAULT 0,
  days_overdue integer DEFAULT 0,
  escalation_level integer DEFAULT 0,
  last_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.collections_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_coll_contacts" ON public.collections_contacts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.inventory_alert_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  email text NOT NULL UNIQUE,
  industry text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.inventory_alert_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_inventory" ON public.inventory_alert_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.inventory_alert_clients(id) ON DELETE CASCADE NOT NULL,
  item_name text NOT NULL,
  par_level integer DEFAULT 0,
  current_stock integer DEFAULT 0,
  avg_daily_usage numeric DEFAULT 0,
  last_alerted_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_inv_items" ON public.inventory_items FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.birthday_campaign_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  email text NOT NULL UNIQUE,
  industry text,
  twilio_number text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.birthday_campaign_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_birthday" ON public.birthday_campaign_clients FOR ALL USING (true) WITH CHECK (true);
