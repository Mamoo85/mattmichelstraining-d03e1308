-- Migration: Robinhood autonomous trading bot tables
-- Phase 95 — 2026-05-27

-- Trade log: every action the bot takes
CREATE TABLE IF NOT EXISTS robinhood_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  account_number TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY','SELL','HOLD','NO_ACTION','HALT')),
  ticker TEXT,
  quantity DECIMAL(12,6),
  price DECIMAL(12,4),
  total_value DECIMAL(12,2),
  portfolio_value_before DECIMAL(12,2),
  portfolio_value_after DECIMAL(12,2),
  stage INTEGER,
  reason TEXT,
  pnl DECIMAL(12,2),
  pnl_pct DECIMAL(8,4),
  rsi DECIMAL(8,4),
  volume_ratio DECIMAL(8,4)
);

CREATE INDEX IF NOT EXISTS idx_robinhood_trades_created_at
  ON robinhood_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_robinhood_trades_account
  ON robinhood_trades(account_number, created_at DESC);

-- Position state: persists trailing stop high-water mark between cron runs
CREATE TABLE IF NOT EXISTS robinhood_position_state (
  account_number TEXT PRIMARY KEY,
  ticker TEXT,
  entry_price DECIMAL(12,4),
  high_water_mark DECIMAL(12,4),
  stage INTEGER DEFAULT 1,
  entry_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (service role can do everything; no user-facing access needed)
ALTER TABLE robinhood_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE robinhood_position_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_trades"
  ON robinhood_trades FOR ALL USING (true);
CREATE POLICY "service_all_state"
  ON robinhood_position_state FOR ALL USING (true);
