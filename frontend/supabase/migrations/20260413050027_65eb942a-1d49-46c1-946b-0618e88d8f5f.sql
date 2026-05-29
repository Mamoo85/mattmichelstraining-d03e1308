ALTER TABLE public.hire_alert_clients ADD COLUMN IF NOT EXISTS notify_email boolean DEFAULT true;
ALTER TABLE public.hire_alert_clients ADD COLUMN IF NOT EXISTS notify_sms boolean DEFAULT true;