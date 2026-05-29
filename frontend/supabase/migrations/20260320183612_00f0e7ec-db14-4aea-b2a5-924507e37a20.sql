CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role') <> 'service_role' AND NOT has_role(auth.uid(), 'admin') THEN
    NEW.subscription_tier := OLD.subscription_tier;
    NEW.is_pro            := OLD.is_pro;
    NEW.account_role      := OLD.account_role;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.is_vip            := OLD.is_vip;
    NEW.is_in_person      := OLD.is_in_person;
  END IF;
  RETURN NEW;
END;
$function$;