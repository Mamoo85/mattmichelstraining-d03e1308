
-- Missing fulfillment tables
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  business_name text NOT NULL,
  email text NOT NULL,
  phone text,
  industry text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on appointment_reminders" ON public.appointment_reminders FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.review_request_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  email text NOT NULL,
  phone text,
  industry text,
  google_review_url text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.review_request_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on review_request_clients" ON public.review_request_clients FOR ALL USING (true) WITH CHECK (true);

-- Legal compliance tables for Lawyer Bot Jess
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  version integer DEFAULT 1,
  status text DEFAULT 'draft',
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on legal_documents" ON public.legal_documents FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.sms_consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  contact_phone text NOT NULL,
  contact_name text,
  consent_method text DEFAULT 'web_form',
  consent_text text,
  consented_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  ip_address text
);
ALTER TABLE public.sms_consent_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on sms_consent_log" ON public.sms_consent_log FOR ALL USING (true) WITH CHECK (true);
