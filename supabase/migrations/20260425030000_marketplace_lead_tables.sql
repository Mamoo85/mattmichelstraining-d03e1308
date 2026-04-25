-- Golden Ticket Marketplace — core tables and view.
-- Creates the DB layer that all marketplace edge functions depend on.
-- NOTE: marketplace_receipt_access_log is in 20260425020000.

-- ── marketplace_lead_locks ──────────────────────────────────────────────────
-- One row per (lead, product, buyer) claim attempt.
-- Partial unique index prevents double-sell at the DB level:
--   only one 'soft_lock'|'claimed'|'sold' row per (lead_id, product) is allowed.
CREATE TABLE IF NOT EXISTS public.marketplace_lead_locks (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id     UUID        NOT NULL,
  product     TEXT        NOT NULL,
  buyer_email TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'soft_lock'
              CHECK (status IN ('soft_lock', 'claimed', 'sold', 'expired', 'released')),
  expires_at  TIMESTAMPTZ,
  locked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevents concurrent buyers from claiming the same lead/product.
-- 'expired' and 'released' rows are excluded so stale locks don't block new claims.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mll_unique_active
  ON public.marketplace_lead_locks (lead_id, product)
  WHERE status IN ('soft_lock', 'claimed', 'sold');

CREATE INDEX IF NOT EXISTS idx_mll_buyer_status
  ON public.marketplace_lead_locks (buyer_email, status);

ALTER TABLE public.marketplace_lead_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass marketplace_lead_locks"
  ON public.marketplace_lead_locks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── marketplace_lead_pdfs ───────────────────────────────────────────────────
-- Caches signed Browserless PDF URLs per buyer; re-signs when URL nears expiry.
-- Unique on (lead_id, buyer_email) — one PDF slot per buyer per lead.
CREATE TABLE IF NOT EXISTS public.marketplace_lead_pdfs (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id               UUID        NOT NULL,
  product               TEXT        NOT NULL,
  buyer_email           TEXT        NOT NULL,
  storage_path          TEXT        NOT NULL,
  signed_url            TEXT,
  signed_url_expires_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_marketplace_lead_pdfs UNIQUE (lead_id, buyer_email)
);

CREATE INDEX IF NOT EXISTS idx_mlp_lead_buyer
  ON public.marketplace_lead_pdfs (lead_id, buyer_email);

ALTER TABLE public.marketplace_lead_pdfs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass marketplace_lead_pdfs"
  ON public.marketplace_lead_pdfs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── unified_lead_marketplace_view ───────────────────────────────────────────
-- Public-safe read surface for the marketplace UI and lead detail page.
-- Deliberately excludes PII columns: full_name, address, phone, email.
-- Buyers get those only after payment, via the PDF dossier endpoint.
CREATE OR REPLACE VIEW public.unified_lead_marketplace_view AS
SELECT
  id,
  city,
  state,
  zip,
  signal_type,
  signal_source,
  signal_detail,
  signal_date,
  estimated_equity,
  estimated_loan_amount,
  score,
  suggested_opener,
  best_call_window,
  created_at,
  'mortgage' AS product
FROM public.mortgage_radar_leads;

-- Auto-expire soft_locks older than 15 minutes (runs via pg_cron if available).
-- Keeps the unique index clean so stale sessions don't block new buyers.
SELECT cron.schedule(
  'marketplace-expire-soft-locks',
  '*/5 * * * *',
  $$
    UPDATE public.marketplace_lead_locks
    SET status = 'expired'
    WHERE status = 'soft_lock'
      AND expires_at < now();
  $$
);
