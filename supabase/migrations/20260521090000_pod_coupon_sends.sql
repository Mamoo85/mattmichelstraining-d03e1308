CREATE TABLE IF NOT EXISTS pod_coupon_sends (
  id              bigserial PRIMARY KEY,
  receipt_id      text NOT NULL UNIQUE,
  buyer_user_id   text,
  sent_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pod_coupon_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_coupon_sends FOR ALL USING (auth.role() = 'service_role');
