
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('role') <> 'service_role' AND NOT has_role(auth.uid(), 'admin') THEN
    NEW.subscription_tier := OLD.subscription_tier;
    NEW.is_pro            := OLD.is_pro;
    NEW.account_role      := OLD.account_role;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_profile_sensitive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();
