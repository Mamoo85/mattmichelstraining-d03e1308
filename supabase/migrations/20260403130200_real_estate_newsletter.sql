-- ── AI REAL ESTATE NEWSLETTER ─────────────────────────────────────────────

-- Clients table: one row per subscribed agent
CREATE TABLE IF NOT EXISTS public.re_newsletter_clients (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email        text NOT NULL,
  customer_name         text,
  agent_name            text,
  brokerage             text,
  phone                 text,
  website               text,
  zip_codes             text,
  headshot_url          text,
  brand_color           text NOT NULL DEFAULT '#1a4a7a',
  stripe_subscription_id text,
  subscription_status   text NOT NULL DEFAULT 'active',
  last_sent_at          timestamptz,
  contacts_count        int NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Contacts table: the agent's sphere of influence list
CREATE TABLE IF NOT EXISTS public.re_newsletter_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES public.re_newsletter_clients(id) ON DELETE CASCADE,
  contact_email text NOT NULL,
  contact_name  text,
  added_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, contact_email)
);

-- Issues table: archive of every newsletter sent
CREATE TABLE IF NOT EXISTS public.re_newsletter_issues (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES public.re_newsletter_clients(id) ON DELETE CASCADE,
  zip_code     text,
  subject      text,
  html_content text,
  sent_count   int NOT NULL DEFAULT 0,
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.re_newsletter_clients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_newsletter_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_newsletter_issues   ENABLE ROW LEVEL SECURITY;

-- re_newsletter_clients: users see their own row; service role sees all
CREATE POLICY "re_newsletter_clients_user_select"
  ON public.re_newsletter_clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "re_newsletter_clients_user_update"
  ON public.re_newsletter_clients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "re_newsletter_clients_service_all"
  ON public.re_newsletter_clients FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- re_newsletter_contacts: users manage contacts on their own client rows
CREATE POLICY "re_newsletter_contacts_user_select"
  ON public.re_newsletter_contacts FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.re_newsletter_clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "re_newsletter_contacts_user_insert"
  ON public.re_newsletter_contacts FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.re_newsletter_clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "re_newsletter_contacts_user_delete"
  ON public.re_newsletter_contacts FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM public.re_newsletter_clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "re_newsletter_contacts_service_all"
  ON public.re_newsletter_contacts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- re_newsletter_issues: users see their own issues; service role sees all
CREATE POLICY "re_newsletter_issues_user_select"
  ON public.re_newsletter_issues FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.re_newsletter_clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "re_newsletter_issues_service_all"
  ON public.re_newsletter_issues FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── INDEXES ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS re_newsletter_clients_user_id_idx
  ON public.re_newsletter_clients(user_id);

CREATE INDEX IF NOT EXISTS re_newsletter_clients_email_idx
  ON public.re_newsletter_clients(customer_email);

CREATE INDEX IF NOT EXISTS re_newsletter_contacts_client_id_idx
  ON public.re_newsletter_contacts(client_id);

CREATE INDEX IF NOT EXISTS re_newsletter_issues_client_id_idx
  ON public.re_newsletter_issues(client_id);
