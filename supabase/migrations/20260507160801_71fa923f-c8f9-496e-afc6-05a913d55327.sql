ALTER TABLE public.radar_trials DROP CONSTRAINT IF EXISTS radar_trials_product_check;
ALTER TABLE public.radar_trials ADD CONSTRAINT radar_trials_product_check CHECK (product = ANY (ARRAY[
  'mortgage_radar','techalert','site_radar','contractor_leads','missed_call','industry_pulse','fielddesk','bundle_revenue_suite',
  'roofing_radar','hvac_radar','plumbing_radar','electrical_radar','pest_control_radar','gutters_radar','painting_radar',
  'exterior_radar','tree_radar','restoration_radar','demo_junk_radar','foundation_radar'
]));