ALTER TABLE public.crm_visitor_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_visitor_events;