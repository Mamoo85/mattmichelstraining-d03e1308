DROP POLICY IF EXISTS "service_role_all_routes" ON public.enrichment_provider_routes;
CREATE POLICY "service_role_all_routes" ON public.enrichment_provider_routes
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on postcard_send_log" ON public.postcard_send_log;
CREATE POLICY "Service role full access on postcard_send_log" ON public.postcard_send_log
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER VIEW public.enrichment_provider_health SET (security_invoker = true);
ALTER VIEW public.dlq_enrich_inspector SET (security_invoker = true);
ALTER VIEW public.enrich_observability SET (security_invoker = true);
ALTER VIEW public.unified_signals SET (security_invoker = true);