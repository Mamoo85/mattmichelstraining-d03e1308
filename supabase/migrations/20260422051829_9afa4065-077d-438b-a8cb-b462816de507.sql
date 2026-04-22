-- 1. Add paid_at column
ALTER TABLE public.prospect_pipeline
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_prospect_pipeline_paid_at
  ON public.prospect_pipeline(paid_at DESC) WHERE paid_at IS NOT NULL;

-- 2. Trigger function — auto-stamp paid_at from lead_activities
CREATE OR REPLACE FUNCTION public.stamp_prospect_paid_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_table = 'prospect_pipeline'
     AND NEW.type IN ('paid', 'deal_won', 'converted') THEN
    UPDATE public.prospect_pipeline
       SET paid_at = COALESCE(paid_at, NEW.created_at, NOW())
     WHERE id = NEW.lead_id
       AND paid_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_prospect_paid_at ON public.lead_activities;
CREATE TRIGGER trg_stamp_prospect_paid_at
AFTER INSERT ON public.lead_activities
FOR EACH ROW
EXECUTE FUNCTION public.stamp_prospect_paid_at();

-- 3. Backfill from existing activity log
UPDATE public.prospect_pipeline pp
   SET paid_at = sub.first_paid
  FROM (
    SELECT lead_id, MIN(created_at) AS first_paid
      FROM public.lead_activities
     WHERE lead_table = 'prospect_pipeline'
       AND type IN ('paid', 'deal_won', 'converted')
     GROUP BY lead_id
  ) sub
 WHERE pp.id = sub.lead_id
   AND pp.paid_at IS NULL;