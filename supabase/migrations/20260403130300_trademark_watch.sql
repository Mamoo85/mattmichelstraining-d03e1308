-- ── AI TRADEMARK WATCH SERVICE ──────────────────────────────────────────────

-- Clients table: one row per subscribed brand owner
CREATE TABLE IF NOT EXISTS public.trademark_watch_clients (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email          text NOT NULL,
  customer_name           text,
  company_name            text,
  stripe_subscription_id  text,
  subscription_status     text NOT NULL DEFAULT 'active',
  marks_count             int NOT NULL DEFAULT 1,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Marks table: one row per monitored trademark
CREATE TABLE IF NOT EXISTS public.trademark_watch_marks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES public.trademark_watch_clients(id) ON DELETE CASCADE,
  mark_text           text NOT NULL,
  goods_services      text,
  nice_classes        text,
  registration_number text,
  last_scanned_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Findings table: one row per potential conflict found via USPTO scan
CREATE TABLE IF NOT EXISTS public.trademark_watch_findings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mark_id          uuid NOT NULL REFERENCES public.trademark_watch_marks(id) ON DELETE CASCADE,
  serial_number    text NOT NULL,
  applicant_name   text,
  mark_text        text,
  goods_services   text,
  filing_date      date,
  similarity_score int,
  recommendation   text,
  ai_analysis      text,
  reported_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mark_id, serial_number)
);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.trademark_watch_clients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trademark_watch_marks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trademark_watch_findings ENABLE ROW LEVEL SECURITY;

-- trademark_watch_clients
CREATE POLICY "tmw_clients_user_select"
  ON public.trademark_watch_clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "tmw_clients_user_update"
  ON public.trademark_watch_clients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "tmw_clients_service_all"
  ON public.trademark_watch_clients FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- trademark_watch_marks
CREATE POLICY "tmw_marks_user_select"
  ON public.trademark_watch_marks FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.trademark_watch_clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "tmw_marks_user_insert"
  ON public.trademark_watch_marks FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.trademark_watch_clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "tmw_marks_user_update"
  ON public.trademark_watch_marks FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM public.trademark_watch_clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "tmw_marks_service_all"
  ON public.trademark_watch_marks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- trademark_watch_findings
CREATE POLICY "tmw_findings_user_select"
  ON public.trademark_watch_findings FOR SELECT
  USING (
    mark_id IN (
      SELECT m.id FROM public.trademark_watch_marks m
      JOIN public.trademark_watch_clients c ON c.id = m.client_id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "tmw_findings_service_all"
  ON public.trademark_watch_findings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── INDEXES ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS tmw_clients_user_id_idx
  ON public.trademark_watch_clients(user_id);

CREATE INDEX IF NOT EXISTS tmw_clients_email_idx
  ON public.trademark_watch_clients(customer_email);

CREATE INDEX IF NOT EXISTS tmw_marks_client_id_idx
  ON public.trademark_watch_marks(client_id);

CREATE INDEX IF NOT EXISTS tmw_findings_mark_id_idx
  ON public.trademark_watch_findings(mark_id);

CREATE INDEX IF NOT EXISTS tmw_findings_score_idx
  ON public.trademark_watch_findings(similarity_score);
