
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobid, jobname, schedule, command FROM cron.job
           WHERE jobname IN ('podcast-pitch-monthly','podcast-show-notes-generator')
  LOOP
    INSERT INTO public.cron_paused_jobs (jobname, schedule, command, product_slug)
    VALUES (r.jobname, r.schedule, r.command, 'other')
    ON CONFLICT (jobname) DO UPDATE
      SET schedule=EXCLUDED.schedule, command=EXCLUDED.command,
          product_slug='other', paused_at=now(), resumed_at=NULL, resume_reason=NULL;
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;
