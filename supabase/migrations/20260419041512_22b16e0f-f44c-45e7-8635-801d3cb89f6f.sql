DROP VIEW IF EXISTS public.queue_status;

CREATE OR REPLACE FUNCTION public.get_queue_status()
RETURNS TABLE(queue_name text, depth bigint, oldest_msg timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR current_setting('role') = 'service_role') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
    SELECT 'scrape_jobs'::text, (SELECT count(*) FROM pgmq.q_scrape_jobs), (SELECT min(enqueued_at) FROM pgmq.q_scrape_jobs)
    UNION ALL SELECT 'enrich_jobs', (SELECT count(*) FROM pgmq.q_enrich_jobs), (SELECT min(enqueued_at) FROM pgmq.q_enrich_jobs)
    UNION ALL SELECT 'dlq_scrape', (SELECT count(*) FROM pgmq.q_dlq_scrape), (SELECT min(enqueued_at) FROM pgmq.q_dlq_scrape)
    UNION ALL SELECT 'dlq_enrich', (SELECT count(*) FROM pgmq.q_dlq_enrich), (SELECT min(enqueued_at) FROM pgmq.q_dlq_enrich);
END; $$;

REVOKE ALL ON FUNCTION public.get_queue_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_queue_status() TO authenticated, service_role;