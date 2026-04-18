INSERT INTO public.cron_sentinel_snoozes (cron_name, snoozed_until, reason)
VALUES
  ('contractor-prospector-daily', now() + interval '30 days', 'No web design leads yet — pre-launch state'),
  ('ops-daily-projects', now() + interval '30 days', 'Ops agent retired')
ON CONFLICT (cron_name) DO UPDATE SET
  snoozed_until = EXCLUDED.snoozed_until,
  reason = EXCLUDED.reason;