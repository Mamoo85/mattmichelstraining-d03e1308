-- Fiverr order intake + meta-agent tables

CREATE TABLE IF NOT EXISTS fiverr_orders (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fiverr_order_id    text,
  gig_type           text        NOT NULL,
  buyer_requirements jsonb       NOT NULL DEFAULT '{}',
  generated_result   text,
  result_url         text,
  status             text        NOT NULL DEFAULT 'generated'
                                 CHECK (status IN ('generated','delivered','revision','cancelled')),
  gig_title          text,
  price_cents        integer     DEFAULT 0,
  raw_email_body     text,
  created_at         timestamptz DEFAULT now(),
  delivered_at       timestamptz
);

CREATE INDEX IF NOT EXISTS fiverr_orders_gig_type_idx   ON fiverr_orders(gig_type);
CREATE INDEX IF NOT EXISTS fiverr_orders_status_idx      ON fiverr_orders(status);
CREATE INDEX IF NOT EXISTS fiverr_orders_created_at_idx  ON fiverr_orders(created_at DESC);

CREATE TABLE IF NOT EXISTS fiverr_gig_drafts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_type     text        NOT NULL,
  title        text        NOT NULL,
  description  text        NOT NULL,
  packages     jsonb,
  requirements text,
  source       text        DEFAULT 'meta_agent',
  status       text        NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','posted','rejected')),
  created_at   timestamptz DEFAULT now()
);
