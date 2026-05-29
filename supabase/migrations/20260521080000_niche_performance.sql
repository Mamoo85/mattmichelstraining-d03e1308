CREATE TABLE IF NOT EXISTS niche_performance (
  niche          text PRIMARY KEY,
  sales_30d      int  NOT NULL DEFAULT 0,
  revenue_30d    int  NOT NULL DEFAULT 0, -- cents
  product_count  int  NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE niche_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON niche_performance FOR ALL USING (auth.role() = 'service_role');
