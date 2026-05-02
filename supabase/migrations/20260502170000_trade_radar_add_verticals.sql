-- Extend Trade Radar to 10 verticals: add tree, restoration, demo_junk, foundation, exterior.
-- Fold painting into exterior (mark painting inactive, keep data).
-- No new tables needed — same schema as existing 7 verticals.

-- 1. Update radar_trials product CHECK (was 15 values, now 20)
ALTER TABLE public.radar_trials
  DROP CONSTRAINT IF EXISTS radar_trials_product_check;

ALTER TABLE public.radar_trials
  ADD CONSTRAINT radar_trials_product_check CHECK (
    product IN (
      'mortgage_radar',
      'techalert',
      'site_radar',
      'contractor_leads',
      'missed_call',
      'industry_pulse',
      'fielddesk',
      'bundle_revenue_suite',
      'roofing_radar',
      'hvac_radar',
      'plumbing_radar',
      'electrical_radar',
      'pest_control_radar',
      'gutters_radar',
      'painting_radar',
      'tree_radar',
      'restoration_radar',
      'demo_junk_radar',
      'foundation_radar',
      'exterior_radar'
    )
  );

-- 2. Mark painting vertical inactive for all clients (fold into exterior).
--    Data is preserved — historical painting leads stay in trade_radar_leads.
UPDATE public.trade_radar_clients
  SET active = false
  WHERE vertical = 'painting';
