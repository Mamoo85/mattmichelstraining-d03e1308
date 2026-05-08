-- Trial Re-Send Queue: maps every prior prospect with a valid email to a best-fit trial product
-- and queues a one-off "we built this for you" invite. Honors all suppression lists.

CREATE TABLE IF NOT EXISTS public.trial_resend_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT,
  industry TEXT,
  city TEXT,
  state TEXT,
  product_key TEXT NOT NULL,
  product_label TEXT,
  source_table TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | skipped | failed
  skip_reason TEXT,
  send_attempted_at TIMESTAMPTZ,
  send_completed_at TIMESTAMPTZ,
  resend_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trial_resend_queue_email_uq ON public.trial_resend_queue (lower(email));
CREATE INDEX IF NOT EXISTS trial_resend_queue_status_idx ON public.trial_resend_queue (status, created_at);

ALTER TABLE public.trial_resend_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access trial_resend_queue"
  ON public.trial_resend_queue FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "admins read trial_resend_queue"
  ON public.trial_resend_queue FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Best-fit mapping helper
CREATE OR REPLACE FUNCTION public.map_industry_to_trial_product(_industry TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN _industry IS NULL THEN 'site_radar'
    WHEN lower(_industry) ~ '(roof)' THEN 'trade_radar_roofing'
    WHEN lower(_industry) ~ '(hvac|heating|cooling|air conditioning)' THEN 'trade_radar_hvac'
    WHEN lower(_industry) ~ '(plumb)' THEN 'trade_radar_plumbing'
    WHEN lower(_industry) ~ '(electric)' THEN 'trade_radar_electrical'
    WHEN lower(_industry) ~ '(pest|exterminat)' THEN 'trade_radar_pest_control'
    WHEN lower(_industry) ~ '(gutter)' THEN 'trade_radar_gutters'
    WHEN lower(_industry) ~ '(siding|painting|painter|exterior|window)' THEN 'trade_radar_exterior'
    WHEN lower(_industry) ~ '(tree|arborist|landscap)' THEN 'trade_radar_tree'
    WHEN lower(_industry) ~ '(restorat|water damage|mold|fire damage)' THEN 'trade_radar_restoration'
    WHEN lower(_industry) ~ '(demo|junk|haul|dumpster)' THEN 'trade_radar_demo_junk'
    WHEN lower(_industry) ~ '(foundation|basement|waterproof)' THEN 'trade_radar_foundation'
    WHEN lower(_industry) ~ '(general contractor|remodel|home build|construction)' THEN 'trade_radar_roofing'
    WHEN lower(_industry) ~ '(mortgage|loan officer|lender)' THEN 'mortgage_radar'
    WHEN lower(_industry) ~ '(staffing|recruit|hire)' THEN 'techalert'
    WHEN lower(_industry) ~ '(dentist|dental|chiropract|physical therapy|urgent care|clinic|medical|doctor)' THEN 'missed_call_catch'
    WHEN lower(_industry) ~ '(law|attorney|legal|injury)' THEN 'missed_call_catch'
    WHEN lower(_industry) ~ '(restaurant|food)' THEN 'missed_call_catch'
    WHEN lower(_industry) ~ '(clean|moving|pressure wash|landscap)' THEN 'missed_call_catch'
    WHEN lower(_industry) ~ '(machine shop|manufactur|injection|industrial)' THEN 'site_radar'
    WHEN lower(_industry) ~ '(property management|commercial)' THEN 'site_radar'
    ELSE 'site_radar'
  END;
$$;