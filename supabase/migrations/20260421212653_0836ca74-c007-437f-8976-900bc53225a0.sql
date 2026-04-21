-- Prospect Nudges tracker
CREATE TABLE public.prospect_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  name text,
  business text,
  city text,
  trade text,
  link_token text NOT NULL UNIQUE DEFAULT substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12),
  notes text,
  clicked_at timestamptz,
  signup_started_at timestamptz,
  account_created_at timestamptz,
  profile_completed_at timestamptz,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospect_nudges_token ON public.prospect_nudges(link_token);
CREATE INDEX idx_prospect_nudges_phone_digits ON public.prospect_nudges(regexp_replace(phone, '\D', '', 'g'));
CREATE INDEX idx_prospect_nudges_status ON public.prospect_nudges(status);

ALTER TABLE public.prospect_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_prospect_nudges"
  ON public.prospect_nudges FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins_select_prospect_nudges"
  ON public.prospect_nudges FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_insert_prospect_nudges"
  ON public.prospect_nudges FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_update_prospect_nudges"
  ON public.prospect_nudges FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_delete_prospect_nudges"
  ON public.prospect_nudges FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Match contractor signups to nudged prospects by phone (digits-only compare)
CREATE OR REPLACE FUNCTION public.match_prospect_on_contractor_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_digits text;
  v_is_paid boolean;
BEGIN
  BEGIN
    IF NEW.phone IS NULL THEN
      RETURN NEW;
    END IF;

    v_phone_digits := regexp_replace(NEW.phone, '\D', '', 'g');
    IF length(v_phone_digits) < 10 THEN
      RETURN NEW;
    END IF;

    v_is_paid := COALESCE(NEW.contractor_lead_subscription, false);

    UPDATE public.prospect_nudges
       SET account_created_at = COALESCE(account_created_at, now()),
           profile_completed_at = COALESCE(profile_completed_at, now()),
           paid_at = CASE WHEN v_is_paid THEN COALESCE(paid_at, now()) ELSE paid_at END,
           status = CASE WHEN v_is_paid THEN 'converted' ELSE status END
     WHERE regexp_replace(phone, '\D', '', 'g') = v_phone_digits
       AND status <> 'dead';

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
END;
$$;

CREATE TRIGGER trg_match_prospect_on_contractor_signup
  AFTER INSERT ON public.contractor_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.match_prospect_on_contractor_signup();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.prospect_nudges;

-- Seed Livonia electrician
INSERT INTO public.prospect_nudges (phone, city, trade, notes)
VALUES ('+17346207178', 'Livonia', 'electrical', 'Initial nudge sent via SMS');