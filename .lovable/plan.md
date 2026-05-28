# Kalshi Bot — 50 Strategy Plan

A standalone Kalshi-only trading bot. One brain, 50 strategy modules, all paper-traded first, then promoted to live. Designed to A/B against your Robinhood bot via a shared scoreboard (PnL, Sharpe, win rate, max drawdown).

---

## Architecture (shared by all 50 strategies)

```
strategies/<id>/             # one folder per strategy, pure function
  signal.ts                  # produces { side: YES|NO, conviction: 0-1, edge_bps, ttl }
  sources.ts                 # external data fetchers
  test.ts                    # backtest harness
core/
  kalshi-client.ts           # auth, place_order, get_market, get_positions, ws feed
  market-resolver.ts         # ticker → market_id, expiry, settlement rules
  position-sizer.ts          # Kelly fraction × conviction × portfolio cap
  risk-manager.ts            # per-strategy DD limit, daily loss kill switch
  order-router.ts            # limit-first, marketable-limit fallback, anti-self-trade
  scoreboard.ts              # writes to bot_runs/bot_trades/bot_pnl for A/B
edge-fns/
  kalshi-orchestrator        # cron every 1m, fans out to enabled strategies
  kalshi-fill-watcher        # ws → DB
  kalshi-eod-settle          # nightly, marks resolved, calcs realized PnL
db/
  strategies (id, name, enabled, paper_only, kelly_frac, max_position_usd)
  signals (strategy_id, market_ticker, side, conviction, edge_bps, ts)
  orders (signal_id, kalshi_order_id, status, fill_px, fill_qty)
  positions (market_ticker, yes_qty, avg_px, strategy_id)
  pnl_daily (strategy_id, date, realized, unrealized, sharpe_30d)
```

Every strategy returns the same `Signal` shape. Orchestrator decides whether to act based on global risk + per-strategy budget. No strategy can blow the account.

---

## The 50 Strategies — grouped by *type of edge*, not topic

### EDGE A — External-model vs Kalshi-price arbitrage (10)

Pull a free quantitative model, compare to Kalshi implied probability, trade the gap when > threshold.

1. **CME FedWatch arb** — Fed rate decision markets vs Fed funds futures implied prob. Trade gap >5¢.
2. **Cleveland Fed Nowcast** — monthly CPI markets vs Inflation Nowcast. Re-evaluate hourly the week of release.
3. **Atlanta Fed GDPNow** — quarterly GDP markets vs GDPNow estimate.
4. **NWS probabilistic forecast** — "High temp NYC > 75°F" markets vs official NWS PoP/temperature distribution.
5. **NHC hurricane cone** — landfall-by-state markets vs National Hurricane Center 5-day cone probability.
6. **USDA WASDE** — corn/soy/wheat price markets vs WASDE supply/demand surprise.
7. **EIA inventory** — oil price weekly markets vs EIA Wednesday print delta from consensus.
8. **Polymarket cross-venue arb** — same event priced differently on Polymarket; hedge both venues (where legal).
9. **PredictIt cross-venue arb** — for politics markets still listed on both.
10. **DraftKings/FanDuel implied** — Kalshi sports vs sportsbook no-vig probability.

### EDGE B — Microstructure / order-book (8)

Pure price-action plays. No external data needed beyond Kalshi's own feed.

11. **Bid-ask scalper** — wide spread (>3¢) + low volatility → quote both sides, capture spread.
12. **Sub-penny tick mean reversion** — 1-min Z-score >2 reverts within 5 min on illiquid markets.
13. **Volume-imbalance momentum** — sustained one-side lifting → join the trend, exit on first opposite tape.
14. **Open auction fade** — extreme opening prints in low-volume markets revert in first 30 min.
15. **Close-into-resolution drift** — markets within 60 min of settlement trend toward 0 or 100; ride drift.
16. **Pin risk avoidance** — flatten any position trading 48-52¢ in last 5 min (forced random outcome).
17. **Iceberg detector** — repeated replenishment at same px → trade with the iceberg side.
18. **Cross-market correlation** — when "Fed cuts 25bp" rises, "Fed holds" must fall; arbitrage the sum >$1 or <$1.

### EDGE C — News / event reaction (8)

Sub-second NLP on news feeds → trade Kalshi before retail.

19. **Fed FOMC statement diff** — diff today's statement vs prior; "hawkish"/"dovish" word shift → rate markets.
20. **Powell press conference live** — real-time transcript (AssemblyAI/Deepgram stream) → rate cut markets.
21. **CPI/PPI release sniper** — at 8:30:00.000 ET, parse BLS release, fire orders within 200ms.
22. **NFP release sniper** — same pattern, jobs markets.
23. **SCOTUS opinion day** — scrape supremecourt.gov live, NLP holding → relevant political markets.
24. **Major news wire (Reuters/AP RSS)** — trigger-word match → relevant market re-pricing.
25. **Truth Social / X presidential posts** — webhook + LLM classifier → political/economic markets.
26. **FDA approval calendar** — PDUFA date → drug/biotech-linked Kalshi markets (if listed).

### EDGE D — Sports models (6)

Quantitative sports vs Kalshi sports lines.

27. **NFL ELO (538 archive style)** — game-winner markets vs custom ELO + home-field + weather.
28. **MLB batter-vs-pitcher** — moneyline markets using BvP splits + park factor.
29. **NBA RAPM/EPM aggregator** — game spread → moneyline conversion.
30. **NCAA tournament Kenpom** — round-of-X advancement markets.
31. **Tennis Elo (TennisAbstract)** — match winner markets, in-play if Kalshi adds it.
32. **Golf DataGolf** — winner / top-10 / top-20 markets, course-fit adjusted.

### EDGE E — Weather / climate (5)

Highly liquid Kalshi vertical, lots of mispricing.

33. **City temperature daily** — NWS hourly forecast vs Kalshi "high/low temp" markets, multi-city portfolio.
34. **Rainfall threshold** — GFS/ECMWF ensemble PoP vs "rain > X inches" markets.
35. **Snowfall threshold** — NOAA WPC winter storm probabilities.
36. **Hurricane season totals** — Colorado State + NOAA seasonal forecasts vs "X named storms" markets.
37. **El Niño / La Niña** — NOAA ENSO probabilities vs Kalshi climate markets.

### EDGE F — Calendar / seasonality / mean-reversion (6)

Patterns that don't need real-time data.

38. **Resolution-week vol crush** — sell extreme probability (<10¢ or >90¢) markets resolving in 7 days IF historical hit-rate confirms.
39. **Multi-leg portfolio basis** — sum-to-1 arb across all candidates in an N-way market.
40. **Recurring monthly markets** — find markets that repeat (CPI, jobs, Fed); train per-market bias model.
41. **Weekend liquidity premium** — quote Friday close, harvest premium when desks are out.
42. **Pre-event vol expansion** — bid both sides 24h pre-event; sell vol on the spike.
43. **Stale-quote sniper** — illiquid markets whose last print is >6h old; refresh fair value, take stale offers.

### EDGE G — Alt-data / structural (7)

Niche but high-edge sources.

44. **Google Trends spike** — search volume for ticker entity → entertainment/celeb/election markets.
45. **GitHub release velocity / SEC filings** — corporate event markets (mergers, IPO dates).
46. **OpenSecrets campaign-finance flow** — Senate/House race markets re-rated weekly.
47. **Real-time election returns scraper** — county-level vote-share extrapolation → election-night markets.
48. **Box-office tracking (Deadline + social)** — "movie grosses > $X opening weekend" markets.
49. **Spotify Charts velocity** — "#1 song next week" markets.
50. **Crypto price-anchor markets** — "BTC > $X by date" vs Deribit options-implied distribution.

---

## Strategy lifecycle (every one of the 50)

```text
draft → paper-trade 30 days → if Sharpe > 1.0 & DD < 10% → live with $50 size →
scale up only after 100 live fills & Sharpe holds → max position cap per strategy
```

A kill-switch table (`strategy_health`) auto-disables any strategy that hits:

- 3-day rolling loss > 2× expected
- 10 consecutive losing trades
- Sharpe drops below 0.3 over 14 days

---

## Build Phases


| Phase | Scope                                                              | Duration  |
| ----- | ------------------------------------------------------------------ | --------- |
| 0     | Get Kalshi API key, scaffold project, paper-trade endpoint working | day 1     |
| 1     | Core architecture: client, sizer, risk, scoreboard, orchestrator   | days 2-3  |
| 2     | Strategies 1-10 (Edge A — easiest, all REST APIs)                  | week 1    |
| 3     | Strategies 11-18 (Edge B — needs Kalshi ws feed wired)             | week 2    |
| 4     | Strategies 19-26 (Edge C — news/NLP infra)                         | week 3    |
| 5     | Strategies 27-50 in parallel waves of 5                            | weeks 4-6 |
| 6     | A/B scoreboard UI vs Robinhood bot                                 | week 6    |


---

## Technical Details

- **Hosting:** new repo `mamoo85/kalshi-bot` OR sub-folder in trading repo. Deno edge functions for cron + REST, a small Node process on a $5 Fly.io machine for websocket persistence (Supabase edge functions can't hold long ws connections).
- **Database:** can reuse Supabase secondary project (`zmyczlfuufhngzovkjdh`) — has plenty of headroom. Add 6 tables listed in Architecture.
- **Secrets needed (when ready):** `KALSHI_API_KEY_ID`, `KALSHI_PRIVATE_KEY` (RSA), `KALSHI_ENV` (demo|prod). Plus optional: `POLYMARKET_API_KEY`, `DATAGOLF_KEY`, `DEEPGRAM_KEY` for specific strategies.
- **Risk defaults:** 1% portfolio per trade, 5% per strategy, 25% per market, daily loss limit 3%.
- **Compliance:** Kalshi is CFTC-regulated — bot must respect their API rate limits (10 req/sec) and self-trade prevention rules. No wash trading.
- **A/B vs Robinhood:** shared `bot_scoreboard` table with columns `bot_name`, `date`, `pnl`, `sharpe_30d`, `win_rate`, `trades`. Daily SMS to you with leaderboard.

---

## Open questions for you

1. **Repo location** — new dedicated `kalshi-bot` repo, or fold into the existing trading repo you mentioned? What do you recommend?
2. **Starting capital on Kalshi** — sets the position sizing math. $100
3. **Which strategies to ship first?** Default order: Edge A first (highest edge, easiest to backtest). Confirm or override. Highest chance of success
4. **Paper-only duration before going live?** Default 30 days. Want shorter (14) or longer (60)? 14 days
5. **Where do I store the Kalshi API key?** Supabase secrets of the secondary project, primary project, or this Lovable project? All? 

Answer those when you're ready and on "Implement plan" I'll start Phase 0–1.