-- Title linter log
CREATE TABLE IF NOT EXISTS public.gng_title_lint_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id bigint NOT NULL,
  old_title text NOT NULL,
  new_title text NOT NULL,
  old_length int NOT NULL,
  new_length int NOT NULL,
  applied boolean NOT NULL DEFAULT false,
  apply_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gng_title_lint_listing ON public.gng_title_lint_log(listing_id);
ALTER TABLE public.gng_title_lint_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full gng_title_lint_log" ON public.gng_title_lint_log TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read gng_title_lint_log" ON public.gng_title_lint_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Duplicate flags
CREATE TABLE IF NOT EXISTS public.gng_duplicate_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id_a bigint NOT NULL,
  listing_id_b bigint NOT NULL,
  similarity numeric NOT NULL,
  reason text,
  title_a text,
  title_b text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gng_duplicate_flags_unresolved ON public.gng_duplicate_flags(created_at DESC) WHERE resolved = false;
ALTER TABLE public.gng_duplicate_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full gng_duplicate_flags" ON public.gng_duplicate_flags TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read gng_duplicate_flags" ON public.gng_duplicate_flags FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Velocity snapshots
CREATE TABLE IF NOT EXISTS public.gng_velocity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id bigint NOT NULL,
  snapshot_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  views int,
  num_favorers int,
  quantity int,
  price_cents int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_gng_velocity_listing_date ON public.gng_velocity_snapshots(listing_id, snapshot_date DESC);
ALTER TABLE public.gng_velocity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full gng_velocity_snapshots" ON public.gng_velocity_snapshots TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read gng_velocity_snapshots" ON public.gng_velocity_snapshots FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Inventory alerts
CREATE TABLE IF NOT EXISTS public.gng_inventory_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id bigint NOT NULL,
  alert_type text NOT NULL,
  signal text,
  views_7d int,
  favorers_delta_7d int,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gng_inventory_alerts_open ON public.gng_inventory_alerts(created_at DESC) WHERE acknowledged = false;
ALTER TABLE public.gng_inventory_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full gng_inventory_alerts" ON public.gng_inventory_alerts TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read gng_inventory_alerts" ON public.gng_inventory_alerts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Tag overlap report
CREATE TABLE IF NOT EXISTS public.gng_tag_overlap_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  tag text NOT NULL,
  listing_count int NOT NULL,
  total_active int NOT NULL,
  saturation_pct numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_date, tag)
);
CREATE INDEX IF NOT EXISTS idx_gng_tag_overlap_recent ON public.gng_tag_overlap_report(report_date DESC, saturation_pct DESC);
ALTER TABLE public.gng_tag_overlap_report ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full gng_tag_overlap_report" ON public.gng_tag_overlap_report TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read gng_tag_overlap_report" ON public.gng_tag_overlap_report FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));