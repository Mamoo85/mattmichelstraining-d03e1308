-- 1. Add dashboard_token + missing helper columns to missed_call_clients
ALTER TABLE public.missed_call_clients
  ADD COLUMN IF NOT EXISTS dashboard_token TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS response_message TEXT,
  ADD COLUMN IF NOT EXISTS call_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS text_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS bundled_with TEXT,
  ADD COLUMN IF NOT EXISTS business_phone TEXT;

UPDATE public.missed_call_clients
  SET dashboard_token = encode(gen_random_bytes(16), 'hex')
  WHERE dashboard_token IS NULL;

ALTER TABLE public.missed_call_clients
  ALTER COLUMN dashboard_token SET DEFAULT encode(gen_random_bytes(16), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS uq_missed_call_clients_dashboard_token
  ON public.missed_call_clients (dashboard_token);

-- 2. Backfill Matt across every product table
DO $$
DECLARE
  v_email text := 'matt@detroitwebagent.com';
BEGIN
  -- field_crm_clients (FieldDesk + SiteRadar)
  IF NOT EXISTS (SELECT 1 FROM public.field_crm_clients WHERE lower(email) = v_email) THEN
    INSERT INTO public.field_crm_clients (email, business_name, owner_name, phone, industry, status, plan, monthly_price, dispatch_token, visitor_script_key, created_at)
    VALUES (v_email, 'Detroit Web Agency', 'Matt Michels', '+13139921219', 'agency', 'active', 'standalone', 0, encode(gen_random_bytes(16),'hex'), gen_random_uuid(), now());
  ELSE
    UPDATE public.field_crm_clients SET status='active' WHERE lower(email)=v_email;
  END IF;

  -- industry_pulse_clients
  IF NOT EXISTS (SELECT 1 FROM public.industry_pulse_clients WHERE lower(email) = v_email) THEN
    INSERT INTO public.industry_pulse_clients (email, company_name, contact_name, phone, active, dashboard_token, buyer_type, created_at)
    VALUES (v_email, 'Detroit Web Agency', 'Matt Michels', '+13139921219', true, encode(gen_random_bytes(24),'hex'), 'supplier', now());
  ELSE
    UPDATE public.industry_pulse_clients SET active=true WHERE lower(email)=v_email AND active IS NOT TRUE;
  END IF;

  -- contractor_clients
  IF NOT EXISTS (SELECT 1 FROM public.contractor_clients WHERE lower(email) = v_email) THEN
    INSERT INTO public.contractor_clients (email, name, business_name, phone, trade, city, state, active, roi_token, created_at)
    VALUES (v_email, 'Matt Michels', 'Detroit Plumbing Pros', '+13139921219', 'plumbing', 'Grosse Pointe', 'MI', true, encode(gen_random_bytes(16),'hex'), now());
  ELSE
    UPDATE public.contractor_clients SET active=true WHERE lower(email)=v_email AND active IS NOT TRUE;
  END IF;

  -- missed_call_clients
  IF NOT EXISTS (SELECT 1 FROM public.missed_call_clients WHERE lower(email) = v_email) THEN
    INSERT INTO public.missed_call_clients (email, business_name, phone, active, dashboard_token, created_at)
    VALUES (v_email, 'Detroit Web Agency', '+13139921219', true, encode(gen_random_bytes(16),'hex'), now());
  ELSE
    UPDATE public.missed_call_clients
      SET active=true,
          dashboard_token = COALESCE(dashboard_token, encode(gen_random_bytes(16),'hex'))
      WHERE lower(email)=v_email;
  END IF;

  -- mortgage_radar_clients
  UPDATE public.mortgage_radar_clients SET active=true WHERE lower(email)=v_email AND active IS NOT TRUE;

  -- hire_alert_clients (TechAlert) — ensure active row with dashboard_token
  IF NOT EXISTS (SELECT 1 FROM public.hire_alert_clients WHERE lower(owner_email) = v_email) THEN
    INSERT INTO public.hire_alert_clients (owner_email, owner_name, company_name, plan, target_roles, active, dashboard_token, created_at)
    VALUES (v_email, 'Matt Michels', 'Detroit Web Agency', 'founder', ARRAY['plumber','electrician','hvac_tech'], true, encode(gen_random_bytes(16),'hex'), now());
  ELSE
    UPDATE public.hire_alert_clients
      SET active=true,
          dashboard_token = COALESCE(dashboard_token, encode(gen_random_bytes(16),'hex'))
      WHERE lower(owner_email)=v_email;
  END IF;
END $$;