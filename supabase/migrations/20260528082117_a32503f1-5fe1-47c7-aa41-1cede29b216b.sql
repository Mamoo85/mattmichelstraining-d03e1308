
-- Strategy registry
CREATE TABLE public.kalshi_strategies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  edge_group TEXT NOT NULL CHECK (edge_group IN ('A','B','C','D','E','F','G')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  paper_only BOOLEAN NOT NULL DEFAULT true,
  kelly_frac NUMERIC NOT NULL DEFAULT 0.25,
  max_position_usd NUMERIC NOT NULL DEFAULT 25,
  min_edge_bps INTEGER NOT NULL DEFAULT 300,
  description TEXT,
  go_live_at TIMESTAMPTZ,
  killed_at TIMESTAMPTZ,
  kill_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.kalshi_strategies TO service_role;
ALTER TABLE public.kalshi_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY srv_all ON public.kalshi_strategies FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Signals produced by strategies
CREATE TABLE public.kalshi_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id TEXT NOT NULL REFERENCES public.kalshi_strategies(id) ON DELETE CASCADE,
  market_ticker TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('YES','NO')),
  conviction NUMERIC NOT NULL CHECK (conviction BETWEEN 0 AND 1),
  edge_bps INTEGER NOT NULL,
  fair_price_cents INTEGER,
  market_price_cents INTEGER,
  ttl_seconds INTEGER NOT NULL DEFAULT 300,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  acted_on BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kalshi_signals_strategy_time ON public.kalshi_signals(strategy_id, created_at DESC);
CREATE INDEX idx_kalshi_signals_market ON public.kalshi_signals(market_ticker, created_at DESC);

GRANT ALL ON public.kalshi_signals TO service_role;
ALTER TABLE public.kalshi_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY srv_all ON public.kalshi_signals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Orders
CREATE TABLE public.kalshi_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES public.kalshi_signals(id) ON DELETE SET NULL,
  strategy_id TEXT NOT NULL REFERENCES public.kalshi_strategies(id) ON DELETE CASCADE,
  market_ticker TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('YES','NO')),
  action TEXT NOT NULL CHECK (action IN ('buy','sell')),
  qty INTEGER NOT NULL,
  limit_price_cents INTEGER NOT NULL,
  kalshi_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','open','filled','partial','canceled','rejected','paper')),
  filled_qty INTEGER NOT NULL DEFAULT 0,
  avg_fill_price_cents INTEGER,
  is_paper BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kalshi_orders_strategy ON public.kalshi_orders(strategy_id, created_at DESC);
CREATE INDEX idx_kalshi_orders_status ON public.kalshi_orders(status) WHERE status IN ('pending','open','partial');

GRANT ALL ON public.kalshi_orders TO service_role;
ALTER TABLE public.kalshi_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY srv_all ON public.kalshi_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Positions
CREATE TABLE public.kalshi_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id TEXT NOT NULL REFERENCES public.kalshi_strategies(id) ON DELETE CASCADE,
  market_ticker TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('YES','NO')),
  qty INTEGER NOT NULL,
  avg_price_cents INTEGER NOT NULL,
  is_paper BOOLEAN NOT NULL DEFAULT true,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  realized_pnl_cents INTEGER,
  UNIQUE(strategy_id, market_ticker, side, is_paper, closed_at)
);

CREATE INDEX idx_kalshi_positions_open ON public.kalshi_positions(strategy_id) WHERE closed_at IS NULL;

GRANT ALL ON public.kalshi_positions TO service_role;
ALTER TABLE public.kalshi_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY srv_all ON public.kalshi_positions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Daily PnL per strategy
CREATE TABLE public.kalshi_pnl_daily (
  strategy_id TEXT NOT NULL REFERENCES public.kalshi_strategies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_paper BOOLEAN NOT NULL DEFAULT true,
  realized_cents INTEGER NOT NULL DEFAULT 0,
  unrealized_cents INTEGER NOT NULL DEFAULT 0,
  trades_count INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  sharpe_30d NUMERIC,
  max_drawdown_pct NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (strategy_id, date, is_paper)
);

GRANT ALL ON public.kalshi_pnl_daily TO service_role;
ALTER TABLE public.kalshi_pnl_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY srv_all ON public.kalshi_pnl_daily FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cross-bot A/B scoreboard (Kalshi vs Robinhood)
CREATE TABLE public.bot_scoreboard (
  bot_name TEXT NOT NULL,
  date DATE NOT NULL,
  pnl_usd NUMERIC NOT NULL DEFAULT 0,
  trades INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC,
  sharpe_30d NUMERIC,
  max_drawdown_pct NUMERIC,
  capital_usd NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_name, date)
);

GRANT ALL ON public.bot_scoreboard TO service_role;
ALTER TABLE public.bot_scoreboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY srv_all ON public.bot_scoreboard FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Market snapshot cache (avoid hammering Kalshi API)
CREATE TABLE public.kalshi_market_snapshots (
  market_ticker TEXT NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  yes_bid_cents INTEGER,
  yes_ask_cents INTEGER,
  last_price_cents INTEGER,
  volume_24h INTEGER,
  open_interest INTEGER,
  status TEXT,
  close_time TIMESTAMPTZ,
  meta JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (market_ticker, snapshot_at)
);

CREATE INDEX idx_kalshi_snapshots_recent ON public.kalshi_market_snapshots(market_ticker, snapshot_at DESC);

GRANT ALL ON public.kalshi_market_snapshots TO service_role;
ALTER TABLE public.kalshi_market_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY srv_all ON public.kalshi_market_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed all 50 strategies (disabled + paper-only by default)
INSERT INTO public.kalshi_strategies (id, name, edge_group, description) VALUES
-- Edge A: Model arb
('a01_fedwatch','CME FedWatch arb','A','Fed rate markets vs FedWatch implied prob'),
('a02_cleveland_cpi','Cleveland Fed CPI Nowcast','A','CPI markets vs Cleveland Fed Inflation Nowcast'),
('a03_gdpnow','Atlanta Fed GDPNow','A','GDP markets vs GDPNow'),
('a04_nws_temp','NWS probabilistic temp','A','Temp markets vs NWS forecast'),
('a05_nhc_hurricane','NHC hurricane cone','A','Landfall markets vs NHC cone prob'),
('a06_wasde','USDA WASDE surprise','A','Crop markets vs WASDE'),
('a07_eia_oil','EIA oil inventory','A','Oil markets vs EIA Wednesday print'),
('a08_polymarket','Polymarket cross-arb','A','Same event on Polymarket'),
('a09_predictit','PredictIt cross-arb','A','Politics cross-venue'),
('a10_sportsbooks','Sportsbook implied','A','Sports vs no-vig DK/FD'),
-- Edge B: Microstructure
('b11_spread_scalper','Bid-ask scalper','B','Wide spread market making'),
('b12_zscore_revert','Z-score mean revert','B','1-min Z>2 reversion'),
('b13_volume_momo','Volume-imbalance momentum','B','One-sided lifting'),
('b14_open_fade','Open auction fade','B','Extreme opens revert'),
('b15_close_drift','Close-to-resolution drift','B','Last 60min trend to 0/100'),
('b16_pin_avoid','Pin risk avoidance','B','Flatten 48-52 in last 5 min'),
('b17_iceberg','Iceberg detector','B','Trade with hidden liquidity'),
('b18_correlation','Cross-market sum arb','B','N-way candidate sum to $1'),
-- Edge C: News
('c19_fomc_diff','FOMC statement diff','C','Hawkish/dovish word shift'),
('c20_powell_live','Powell presser live','C','Real-time transcript NLP'),
('c21_cpi_sniper','CPI release sniper','C','8:30:00.000 BLS parse'),
('c22_nfp_sniper','NFP release sniper','C','Jobs report sniper'),
('c23_scotus','SCOTUS opinion day','C','Live scrape supremecourt.gov'),
('c24_newswire','Reuters/AP RSS','C','Trigger-word match'),
('c25_truth_x','Truth/X presidential','C','LLM classifier on posts'),
('c26_fda_pdufa','FDA PDUFA calendar','C','Drug approval dates'),
-- Edge D: Sports
('d27_nfl_elo','NFL ELO','D','Custom ELO + HFA + weather'),
('d28_mlb_bvp','MLB BvP','D','Batter-vs-pitcher splits'),
('d29_nba_rapm','NBA RAPM','D','Player impact aggregator'),
('d30_ncaa_kenpom','NCAA Kenpom','D','Tournament advancement'),
('d31_tennis_elo','Tennis Elo','D','TennisAbstract ratings'),
('d32_golf_dg','Golf DataGolf','D','Winner/top-10 course-fit'),
-- Edge E: Weather
('e33_city_temp','City temperature','E','NWS hourly vs Kalshi temp'),
('e34_rainfall','Rainfall threshold','E','GFS/ECMWF PoP'),
('e35_snowfall','Snowfall threshold','E','NOAA WPC'),
('e36_hurricane_season','Hurricane season totals','E','CSU + NOAA seasonal'),
('e37_enso','ENSO state','E','El Niño/La Niña'),
-- Edge F: Seasonality
('f38_vol_crush','Resolution-week vol crush','F','Sell extreme tails on time'),
('f39_basis_sum','Multi-leg basis arb','F','N-way candidate sum'),
('f40_recurring_bias','Recurring market bias','F','Per-market historical edge'),
('f41_weekend_premium','Weekend liquidity premium','F','Quote Fri close'),
('f42_pre_event_vol','Pre-event vol expansion','F','Bid both sides 24h pre'),
('f43_stale_quote','Stale-quote sniper','F','>6h stale offer take'),
-- Edge G: Alt-data
('g44_google_trends','Google Trends spike','G','Search volume on entity'),
('g45_sec_filings','SEC filings event','G','Corporate event markets'),
('g46_opensecrets','OpenSecrets flow','G','Campaign-finance shift'),
('g47_election_returns','Live election returns','G','County-level extrapolation'),
('g48_box_office','Box-office tracking','G','Opening weekend gross'),
('g49_spotify_charts','Spotify Charts velocity','G','#1 song markets'),
('g50_crypto_anchor','Crypto price-anchor','G','BTC > $X vs Deribit IV');
