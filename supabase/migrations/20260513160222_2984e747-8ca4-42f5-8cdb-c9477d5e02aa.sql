-- Enroll Matt in Demand Radar (buyer_type='contractor') and Growth Radar (buyer_type='growth')
INSERT INTO public.industry_pulse_clients (
  company_name, email, contact_name, buyer_type, active, dashboard_token, plan, pricing_tier
)
VALUES
  ('Detroit Web Agency', 'matt@detroitwebagent.com', 'Matt Michels', 'contractor', true, 'matt-test-demand-radar-0001', 'founder', 'founder'),
  ('Detroit Web Agency', 'matt@detroitwebagent.com', 'Matt Michels', 'growth',     true, 'matt-test-growth-radar-0001', 'founder', 'founder')
ON CONFLICT DO NOTHING;