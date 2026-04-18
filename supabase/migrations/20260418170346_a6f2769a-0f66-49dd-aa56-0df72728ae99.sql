GRANT USAGE ON SCHEMA cron TO service_role, authenticated, postgres;
GRANT SELECT ON cron.job TO service_role, authenticated, postgres;
GRANT SELECT ON cron.job_run_details TO service_role, authenticated, postgres;