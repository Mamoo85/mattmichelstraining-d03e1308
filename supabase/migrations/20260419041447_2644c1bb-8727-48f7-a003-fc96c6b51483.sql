-- pgmq queue infrastructure for scrape + enrich pipelines (items A1-A10)

-- 1. Create core queues
SELECT pgmq.create('scrape_jobs');
SELECT pgmq.create('enrich_jobs');
SELECT pgmq.create('dlq_scrape');
SELECT pgmq.create('dlq_enrich');

-- 2. Generic enqueue helper
CREATE OR REPLACE FUNCTION public.enqueue_job(queue_name text, payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END; $$;

-- 3. Generic batch reader (worker uses this)
CREATE OR REPLACE FUNCTION public.read_job_batch(queue_name text, batch_size int, vt int)
RETURNS TABLE(msg_id bigint, read_ct int, message jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_job(queue_name text, message_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN RETURN FALSE; END; $$;

-- 4. Status view for /admin monitoring (A6)
CREATE OR REPLACE VIEW public.queue_status AS
SELECT 'scrape_jobs'::text AS queue_name,
       (SELECT count(*) FROM pgmq.q_scrape_jobs) AS depth,
       (SELECT min(enqueued_at) FROM pgmq.q_scrape_jobs) AS oldest_msg
UNION ALL
SELECT 'enrich_jobs',
       (SELECT count(*) FROM pgmq.q_enrich_jobs),
       (SELECT min(enqueued_at) FROM pgmq.q_enrich_jobs)
UNION ALL
SELECT 'dlq_scrape',
       (SELECT count(*) FROM pgmq.q_dlq_scrape),
       (SELECT min(enqueued_at) FROM pgmq.q_dlq_scrape)
UNION ALL
SELECT 'dlq_enrich',
       (SELECT count(*) FROM pgmq.q_dlq_enrich),
       (SELECT min(enqueued_at) FROM pgmq.q_dlq_enrich);

GRANT SELECT ON public.queue_status TO authenticated, anon, service_role;

-- 5. Scanner checkpoints table (A7) — per-source state to prevent double dispatch
CREATE TABLE IF NOT EXISTS public.hire_REDACTED (
  source text PRIMARY KEY,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','queued','processing','ok','error')),
  last_dispatched_at timestamptz,
  last_completed_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hire_REDACTED ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role checkpoints" ON public.hire_REDACTED FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admins read checkpoints" ON public.hire_REDACTED FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. Trigger: enqueue stage-1 enrich job for every new candidate (A2 / replaces synchronous enrich trigger)
CREATE OR REPLACE FUNCTION public.trigger_enqueue_enrich()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_company_name = true THEN RETURN NEW; END IF;
  IF NEW.source IN ('yelp','phcc','building_permits','thumbtack','google_places','yelp_business') THEN RETURN NEW; END IF;
  PERFORM public.enqueue_job('enrich_jobs', jsonb_build_object(
    'candidate_id', NEW.id,
    'next_stage', 1,
    'enqueued_at', now()
  ));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

-- We do NOT auto-attach the trigger yet — leave existing trigger_enrich_new_candidate in place.
-- Operators can swap by running:
--   DROP TRIGGER IF EXISTS enrich_new_candidate ON public.hire_alert_candidates;
--   CREATE TRIGGER enqueue_enrich_new_candidate AFTER INSERT ON public.hire_alert_candidates
--     FOR EACH ROW EXECUTE FUNCTION public.trigger_enqueue_enrich();

COMMENT ON FUNCTION public.trigger_enqueue_enrich IS 'Replacement for trigger_enrich_new_candidate. Pushes to enrich_jobs queue instead of HTTP-invoking deep-enrich. Attach when ready to cut over.';