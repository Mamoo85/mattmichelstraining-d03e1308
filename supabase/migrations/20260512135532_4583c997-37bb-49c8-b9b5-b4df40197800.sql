INSERT INTO public.field_crm_clients (id, business_name, owner_name, email, phone, industry, website, status, plan, monthly_price)
VALUES ('d1c00910-9c0a-4d00-9c01-d1c0fd000001'::uuid, 'D.J. Conley Sales & Service','Pat Michels','pmichels@djconley.com','+12485855340','industrial_boiler','https://djconley.com','active','fielddesk',19900)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.missed_call_clients (id, email, business_name, contact_name, phone, business_phone, custom_message, response_message, active, dashboard_token)
VALUES ('d1c00910-9c0a-4d00-9c01-d1c0fd000002'::uuid,'pmichels@djconley.com','D.J. Conley Sales & Service','Pat Michels','+13135904404','+12485855340','Thanks for calling D.J. Conley. We''ll text you right back.','Sorry we missed you — what can we help with?',true,'djc-sandbox-missedcall-token')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.hire_alert_clients (id, company_name, owner_name, owner_email, owner_phone, plan, target_roles, target_zip_codes, active, trial_status, dashboard_token)
VALUES ('d1c00910-9c0a-4d00-9c01-d1c0fd000003'::uuid,'D.J. Conley Sales & Service','Pat Michels','pmichels@djconley.com','+12485855340','founders',
  ARRAY['Plant Engineer','Facilities Director','Boiler Operator','Chief Engineer'],
  ARRAY['48201','48202','48207','48226','48075','48084','48089'], true,'active','djc-sandbox-hirealert-token')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contractor_clients (id, email, name, business_name, industry, trade, city, state, service_area, phone, active, average_ticket_value)
VALUES ('d1c00910-9c0a-4d00-9c01-d1c0fd000004'::uuid,'pmichels@djconley.com','Pat Michels','D.J. Conley Sales & Service','industrial_boiler','hvac','Detroit','MI','Wayne / Oakland / Macomb / Washtenaw / Genesee','+12485855340',true,4500)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.trade_radar_clients (id, email, contact_name, business_name, phone, vertical, zip_codes, active, dashboard_token, coverage_counties)
VALUES ('d1c00910-9c0a-4d00-9c01-d1c0fd000005'::uuid,'pmichels@djconley.com','Pat Michels','D.J. Conley Sales & Service','+12485855340','hvac',
  ARRAY['48201','48202','48207','48226','48075','48084','48089','48091','48092'], true,'djc-sandbox-traderadar-token',
  ARRAY['Wayne','Oakland','Macomb','Washtenaw','Genesee'])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.sandbox_tenant_config ADD COLUMN IF NOT EXISTS client_ids jsonb DEFAULT '{}'::jsonb;

UPDATE public.sandbox_tenant_config
SET client_ids = jsonb_build_object(
  'field_crm',   'd1c00910-9c0a-4d00-9c01-d1c0fd000001',
  'missed_call', 'd1c00910-9c0a-4d00-9c01-d1c0fd000002',
  'hire_alert',  'd1c00910-9c0a-4d00-9c01-d1c0fd000003',
  'contractor',  'd1c00910-9c0a-4d00-9c01-d1c0fd000004',
  'trade_radar', 'd1c00910-9c0a-4d00-9c01-d1c0fd000005'
), updated_at = now()
WHERE tenant_slug = 'djconley';