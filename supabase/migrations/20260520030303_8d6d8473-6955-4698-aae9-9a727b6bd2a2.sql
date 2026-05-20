
CREATE TABLE IF NOT EXISTS public.etsy_shop_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  field text NOT NULL CHECK (field IN ('title','announcement')),
  previous_value text,
  new_value text NOT NULL,
  pushed_ok boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.etsy_shop_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY etsy_shop_edits_admin ON public.etsy_shop_edits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.etsy_announcement_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('new_drop','featured','sale','evergreen','manual')),
  copy text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  priority int NOT NULL DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.etsy_announcement_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY etsy_sched_admin ON public.etsy_announcement_schedule
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.etsy_announcement_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES public.etsy_announcement_schedule(id) ON DELETE SET NULL,
  trigger text NOT NULL,
  copy text NOT NULL,
  pushed_ok boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.etsy_announcement_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY etsy_log_admin ON public.etsy_announcement_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Toggle for pausing all automation
INSERT INTO public.site_content (section, content_key, content_value)
VALUES ('etsy_automation','enabled','true')
ON CONFLICT (section, content_key) DO NOTHING;

-- Seed evergreen pool
INSERT INTO public.etsy_announcement_schedule (kind, copy, priority, active, meta) VALUES
  ('evergreen','✨ Made-to-order in Detroit. Free shipping over $35!',1,true,'{"rotate":true}'),
  ('evergreen','🎁 Custom prints, mugs & tees — fast turnaround, premium quality.',1,true,'{"rotate":true}'),
  ('evergreen','🧵 New designs drop weekly. Hit follow to stay first in line.',1,true,'{"rotate":true}')
ON CONFLICT DO NOTHING;

-- Daily rotator cron (13:00 UTC = 9am ET)
SELECT cron.schedule(
  'etsy-announcement-rotator-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/etsy-announcement-rotator',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);
