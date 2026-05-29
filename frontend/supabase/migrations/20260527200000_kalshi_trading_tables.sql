-- Migration: Kalshi prediction market trading tables
-- Phase 95 — 2026-05-27

-- Kalshi trade log: every market position the bot opens or closes
CREATE TABLE IF NOT EXISTS kalshi_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  action TEXT NOT NULL CHECK (action IN ('BUY_YES','BUY_NO','SELL_YES','SELL_NO','HOLD','HALT','NO_ACTION')),
  ticker TEXT,
  event_title TEXT,
  contracts INTEGER,
  price_cents INTEGER,           -- price in cents (1-99)
  side TEXT CHECK (side IN ('yes','no')),
  total_cost_cents INTEGER,      -- contracts * price_cents
  balance_before INTEGER,        -- cents
  balance_after INTEGER,         -- cents
  pnl_cents INTEGER,             -- realized P&L on close
  pnl_pct DECIMAL(8,4),
  kelly_fraction DECIMAL(6,4),   -- kelly criterion bet size used
  implied_prob DECIMAL(6,4),     -- market implied probability
  edge DECIMAL(6,4),             -- our estimated edge vs market
  reason TEXT,
  stage INTEGER DEFAULT 1,
  order_id TEXT                  -- Kalshi order ID for tracking
);

CREATE INDEX IF NOT EXISTS idx_kalshi_trades_created_at
  ON kalshi_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kalshi_trades_ticker
  ON kalshi_trades(ticker, created_at DESC);

-- Kalshi open positions: tracks live contracts for P&L
CREATE TABLE IF NOT EXISTS kalshi_positions (
  ticker TEXT PRIMARY KEY,
  event_title TEXT,
  side TEXT CHECK (side IN ('yes','no')),
  contracts INTEGER DEFAULT 0,
  avg_price_cents INTEGER,
  entry_time TIMESTAMPTZ DEFAULT NOW(),
  high_pnl_cents INTEGER DEFAULT 0,   -- trailing high for stop-loss logic
  stage INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot health: last successful run timestamps + error counts
CREATE TABLE IF NOT EXISTS trading_bot_health (
  bot_id TEXT PRIMARY KEY,         -- 'robinhood' or 'kalshi'
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  consecutive_errors INTEGER DEFAULT 0,
  last_error TEXT,
  total_runs INTEGER DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  starting_balance DECIMAL(12,2),
  current_balance DECIMAL(12,2),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial health records
INSERT INTO trading_bot_health (bot_id, starting_balance, current_balance)
VALUES
  ('robinhood', 109.00, 109.00),
  ('kalshi', 197.00, 197.00)
ON CONFLICT (bot_id) DO NOTHING;

-- RLS (service role only)
ALTER TABLE kalshi_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE kalshi_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_bot_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_kalshi_trades" ON kalshi_trades FOR ALL USING (true);
CREATE POLICY "service_all_kalshi_positions" ON kalshi_positions FOR ALL USING (true);
CREATE POLICY "service_all_bot_health" ON trading_bot_health FOR ALL USING (true);
