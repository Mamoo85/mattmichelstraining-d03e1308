-- Add promoted_at marker so we can audit when sources first went live
ALTER TABLE public.source_registry
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz;

-- Trigger function: fire pg_net call to notify-source-promoted on status -> 'live'
CREATE OR REPLACE FUNCTION public.notify_source_promoted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_key text;
  fn_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/notify-source-promoted';
BEGIN
  -- Only fire when status transitions INTO 'live' from something else
  IF NEW.status = 'live' AND (OLD.status IS DISTINCT FROM 'live') THEN
    NEW.promoted_at := COALESCE(NEW.promoted_at, now());

    -- Best-effort fetch service role key from vault; skip notify if unavailable
    BEGIN
      SELECT decrypted_secret INTO service_key
      FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      service_key := NULL;
    END;

    IF service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := fn_url,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'product', NEW.product,
          'source_key', NEW.source_key,
          'source_name', NEW.source_name,
          'previous_status', OLD.status
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_source_registry_promoted ON public.source_registry;
CREATE TRIGGER on_source_registry_promoted
  BEFORE UPDATE OF status ON public.source_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_source_promoted();