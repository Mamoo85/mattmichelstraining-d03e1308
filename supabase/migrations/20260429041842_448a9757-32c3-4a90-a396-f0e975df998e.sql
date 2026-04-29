-- 1. Audit table for prospector_targets toggles
CREATE TABLE IF NOT EXISTS public.prospector_targets_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid,
  city text,
  state text,
  trade text,
  old_active boolean,
  new_active boolean,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prospector_targets_audit_changed_at_idx
  ON public.prospector_targets_audit (changed_at DESC);

ALTER TABLE public.prospector_targets_audit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY "service_role bypass prospector_targets_audit" ON public.prospector_targets_audit FOR ALL TO service_role USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY "admin read prospector_targets_audit" ON public.prospector_targets_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role))';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Trigger function: log only when active flips
CREATE OR REPLACE FUNCTION public.log_prospector_targets_active_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.active IS DISTINCT FROM NEW.active) THEN
    INSERT INTO public.prospector_targets_audit (
      target_id, city, state, trade, old_active, new_active, changed_by
    ) VALUES (
      NEW.id, NEW.city, NEW.state, NEW.trade, OLD.active, NEW.active, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prospector_targets_audit_trg ON public.prospector_targets;
CREATE TRIGGER prospector_targets_audit_trg
AFTER UPDATE ON public.prospector_targets
FOR EACH ROW
EXECUTE FUNCTION public.log_prospector_targets_active_change();

-- 3. processed_stripe_events.product_type for checkout-events dashboard filter
ALTER TABLE public.processed_stripe_events
  ADD COLUMN IF NOT EXISTS product_type text;

CREATE INDEX IF NOT EXISTS processed_stripe_events_product_type_idx
  ON public.processed_stripe_events (product_type);

CREATE INDEX IF NOT EXISTS processed_stripe_events_processed_at_idx
  ON public.processed_stripe_events (processed_at DESC);