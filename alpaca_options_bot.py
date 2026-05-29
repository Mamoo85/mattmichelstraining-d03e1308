#!/usr/bin/env python3
"""Alpaca Options Trading Bot — AI/Tech momentum scanner.

Trading mode is controlled by the ALPACA_ENV env var ("paper" | "live").
Defaults to paper. Live mode requires LIVE Alpaca keys (AK...) supplied via
ALPACA_KEY / ALPACA_SECRET env vars — never hardcoded.
"""

import os
import sys
import json
import time
import traceback
import requests
from datetime import datetime, timezone, timedelta

import yfinance as yf

# ── Credentials / environment ────────────────────────────────────────────────
# Trading mode is driven entirely by ALPACA_ENV ("paper" | "live"). Defaults to
# paper so no real money is ever at risk unless the environment is explicitly
# switched. Live trading requires LIVE Alpaca keys (start with "AK..."); paper
# keys ("PK...") are rejected by the live endpoint.
ALPACA_ENV    = os.environ.get("ALPACA_ENV", "paper").strip().lower()
IS_PAPER      = ALPACA_ENV != "live"
MODE_LABEL    = "PAPER" if IS_PAPER else "LIVE"

# All credentials come from the environment — never hardcoded/committed.
# Paper run: set paper keys (PK...). Live run: set ALPACA_ENV=live + live keys (AK...).
ALPACA_KEY    = os.environ.get("ALPACA_KEY", "")
ALPACA_SECRET = os.environ.get("ALPACA_SECRET", "")
ALPACA_BASE   = ("https://api.alpaca.markets" if not IS_PAPER
                 else "https://paper-api.alpaca.markets")
DATA_BASE     = "https://data.alpaca.markets"
SB_URL        = os.environ.get("SUPABASE_URL", "https://zmyczlfuufhngzovkjdh.supabase.co")
SB_ANON       = os.environ.get("SUPABASE_ANON_KEY", "")
SMS_ENDPOINT  = f"{SB_URL}/functions/v1/trade-notification"

# Guard: required credentials must be present.
if not ALPACA_KEY or not ALPACA_SECRET:
    raise SystemExit(
        "Missing Alpaca credentials. Set ALPACA_KEY and ALPACA_SECRET env vars "
        "(paper keys start with PK..., live keys with AK...)."
    )

# Guard: refuse to run live with paper keys (would silently 401/403).
if not IS_PAPER and ALPACA_KEY.startswith("PK"):
    raise SystemExit(
        "ALPACA_ENV=live but a PAPER key (PK...) is set. Provide LIVE keys "
        "(AK...) via ALPACA_KEY/ALPACA_SECRET before enabling live trading."
    )

UNIVERSE = ["NVDA","TSLA","META","AMD","PLTR","COIN","MSTR","IONQ","SOUN","BBAI",
            "RKLB","HOOD","MSFT","GOOGL"]

# ── Helpers ─────────────────────────────────────────────────────────────────────
def alpaca_headers():
    return {"APCA-API-KEY-ID": ALPACA_KEY, "APCA-API-SECRET-KEY": ALPACA_SECRET}

def sb_headers():
    return {"apikey": SB_ANON, "Authorization": f"Bearer {SB_ANON}",
            "Content-Type": "application/json"}

def log(msg):
    print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {msg}", flush=True)

def send_sms(message):
    try:
        r = requests.post(SMS_ENDPOINT,
                          headers={"Content-Type": "application/json"},
                          json={"message": message, "account": MODE_LABEL},
                          timeout=10)
        log(f"SMS sent ({r.status_code}): {message[:100]}")
    except Exception as e:
        log(f"SMS failed: {e}")

# ── STEP 2 — Market hours ────────────────────────────────────────────────────────
def check_market_hours():
    now = datetime.now(timezone.utc)
    log(f"Current UTC: {now.strftime('%Y-%m-%d %H:%M:%S %A')}")
    if now.weekday() >= 5:
        log("Market closed — weekend")
        return False
    market_open  = now.replace(hour=13, minute=45, second=0, microsecond=0)
    market_close = now.replace(hour=21, minute=0,  second=0, microsecond=0)
    if not (market_open <= now <= market_close):
        log(f"Market closed — outside 13:45-21:00 UTC (now {now.strftime('%H:%M')} UTC)")
        return False
    log("Market is OPEN")
    return True

# ── STEP 3 — Load / reconcile positions ──────────────────────────────────────────
def load_positions():
    log("Loading Supabase positions…")
    db_pos = {}
    try:
        r = requests.get(f"{SB_URL}/rest/v1/alpaca_positions?select=*",
                         headers=sb_headers(), timeout=15)
        if r.status_code == 200:
            for p in r.json():
                key = p.get("option_symbol") or p.get("symbol","")
                db_pos[key] = p
            log(f"  DB: {len(db_pos)} positions")
        else:
            log(f"  DB fetch {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log(f"  DB error: {e}")

    log("Loading Alpaca positions…")
    alpaca_pos = {}
    try:
        r = requests.get(f"{ALPACA_BASE}/v2/positions", headers=alpaca_headers(), timeout=15)
        if r.status_code == 200:
            for p in r.json():
                alpaca_pos[p["symbol"]] = p
            log(f"  Alpaca: {len(alpaca_pos)} positions")
        else:
            log(f"  Alpaca {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log(f"  Alpaca error: {e}")

    # Add to DB if in Alpaca but not DB
    for sym, ap in alpaca_pos.items():
        if sym not in db_pos:
            log(f"  Reconcile ADD: {sym}")
            try:
                ep = float(ap.get("avg_entry_price", 0))
                cp = float(ap.get("current_price", ep))
                payload = {"option_symbol": sym, "underlying": sym[:4],
                           "contracts": abs(int(float(ap.get("qty",1)))),
                           "entry_premium": ep, "current_premium": cp,
                           "highest_premium": cp, "is_paper": IS_PAPER,
                           "entry_time": datetime.now(timezone.utc).isoformat()}
                requests.post(f"{SB_URL}/rest/v1/alpaca_positions",
                              headers=sb_headers(), json=payload, timeout=10)
                db_pos[sym] = payload
            except Exception as e:
                log(f"  Reconcile add error: {e}")

    # Remove from DB if closed in Alpaca
    for sym in list(db_pos.keys()):
        if sym not in alpaca_pos:
            log(f"  Reconcile REMOVE: {sym} (closed in Alpaca)")
            try:
                requests.delete(
                    f"{SB_URL}/rest/v1/alpaca_positions?option_symbol=eq.{sym}",
                    headers=sb_headers(), timeout=10)
                del db_pos[sym]
            except Exception as e:
                log(f"  Reconcile remove error: {e}")

    return db_pos

# ── STEP 4 — Manage positions ─────────────────────────────────────────────────────
def manage_positions(db_pos):
    exits = 0
    now = datetime.now(timezone.utc)
    for option_symbol, pos in list(db_pos.items()):
        log(f"\n── Checking: {option_symbol}")
        try:
            entry_premium   = float(pos.get("entry_premium", 0))
            highest_premium = float(pos.get("highest_premium", entry_premium))
            contracts       = int(pos.get("contracts", 1))
            expiry_str      = pos.get("expiry", "")

            dte = 999
            if expiry_str:
                try:
                    expiry_dt = datetime.strptime(expiry_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    dte = (expiry_dt - now).days
                except:
                    pass

            # Get quote
            current_premium = entry_premium
            try:
                r = requests.get(
                    f"{DATA_BASE}/v1beta1/options/snapshots/{option_symbol}",
                    headers=alpaca_headers(), timeout=10)
                if r.status_code == 200:
                    data = r.json()
                    snap = data.get("snapshots", {}).get(option_symbol, {})
                    if not snap:
                        snap = data.get(option_symbol, {})
                    ask = (snap.get("latestQuote") or {}).get("ap", 0)
                    if ask and float(ask) > 0:
                        current_premium = float(ask)
                log(f"  Quote: ask=${current_premium:.2f} entry=${entry_premium:.2f}")
            except Exception as e:
                log(f"  Quote error: {e}")

            # Update highest
            if current_premium > highest_premium:
                highest_premium = current_premium
                try:
                    requests.patch(
                        f"{SB_URL}/rest/v1/alpaca_positions?option_symbol=eq.{option_symbol}",
                        headers=sb_headers(),
                        json={"highest_premium": highest_premium, "current_premium": current_premium},
                        timeout=10)
                except:
                    pass

            pnl_pct = ((current_premium - entry_premium) / entry_premium * 100) if entry_premium else 0
            log(f"  P&L: {pnl_pct:+.1f}% | DTE: {dte} | Highest: ${highest_premium:.2f}")

            exit_reason = None
            if pnl_pct >= 75:
                exit_reason = "TAKE_PROFIT"
            elif pnl_pct <= -50:
                exit_reason = "STOP_LOSS"
            elif dte < 7:
                exit_reason = "TIME_EXIT"
            elif highest_premium > 0 and current_premium < highest_premium * 0.60:
                exit_reason = "TRAILING_STOP"

            if exit_reason:
                log(f"  EXIT: {exit_reason}")
                try:
                    or_ = requests.post(f"{ALPACA_BASE}/v2/orders",
                                        headers=alpaca_headers(),
                                        json={"symbol": option_symbol, "qty": str(contracts),
                                              "side": "sell", "type": "market",
                                              "time_in_force": "day"}, timeout=15)
                    log(f"  Sell order: {or_.status_code}")
                except Exception as e:
                    log(f"  Sell error: {e}")

                exit_premium = current_premium
                pnl_dollar   = (exit_premium - entry_premium) * contracts * 100
                try:
                    requests.post(f"{SB_URL}/rest/v1/alpaca_trades",
                                  headers=sb_headers(),
                                  json={"action":"SELL","underlying":pos.get("underlying",""),
                                        "option_symbol":option_symbol,"contracts":contracts,
                                        "premium_per_contract":exit_premium,
                                        "total_cost":exit_premium*contracts*100,
                                        "reason":exit_reason,"is_paper":IS_PAPER,
                                        "entry_time":pos.get("entry_time"),
                                        "exit_time":now.isoformat(),
                                        "pnl":pnl_dollar,"pnl_pct":pnl_pct,
                                        "strike":pos.get("strike"),"expiry":expiry_str},
                                  timeout=10)
                except Exception as e:
                    log(f"  Trade record error: {e}")

                try:
                    requests.delete(
                        f"{SB_URL}/rest/v1/alpaca_positions?option_symbol=eq.{option_symbol}",
                        headers=sb_headers(), timeout=10)
                    del db_pos[option_symbol]
                except:
                    pass

                send_sms(
                    f"🔴 ALPACA [{MODE_LABEL}] {exit_reason}: {option_symbol} x{contracts} | "
                    f"Entry: ${entry_premium:.2f} Exit: ${exit_premium:.2f} | "
                    f"P&L: ${pnl_dollar:+.2f} ({pnl_pct:+.1f}%)"
                )
                exits += 1
            else:
                log(f"  HOLD")
        except Exception as e:
            log(f"  Error managing {option_symbol}: {e}")
            traceback.print_exc()
    return exits

# ── STEP 5 helpers ────────────────────────────────────────────────────────────────
def get_vix():
    try:
        return float(yf.Ticker("^VIX").history(period="2d")["Close"].iloc[-1])
    except:
        return 20.0

def get_fng():
    try:
        r = requests.get("https://api.alternative.me/fng/", timeout=8)
        return int(r.json()["data"][0]["value"])
    except:
        return 50

def get_congress_flag(symbol):
    try:
        r = requests.get("https://housestockwatcher.com/api/transactions", timeout=12)
        if r.status_code != 200:
            return "NEUTRAL"
        txns = r.json()
        if not isinstance(txns, list):
            return "NEUTRAL"
        related  = [t for t in txns if symbol.upper() in str(t.get("ticker","")).upper()]
        buys     = [t for t in related if "Purchase" in str(t.get("type",""))]
        sells    = [t for t in related if "Sale"     in str(t.get("type",""))]
        return "INSIDER_BUY" if len(buys) > len(sells) else "NEUTRAL"
    except:
        return "NEUTRAL"

def get_insider_flag(symbol):
    try:
        today = datetime.now(timezone.utc).date()
        start = (today - timedelta(days=30)).isoformat()
        url   = (f"https://efts.sec.gov/LATEST/search-index?q=%22{symbol}%22"
                 f"&dateRange=custom&startdt={start}&enddt={today.isoformat()}&forms=4")
        r = requests.get(url, headers={"User-Agent":"m2training/1.0 matt@m2training.com"}, timeout=10)
        if r.status_code != 200:
            return False
        hits = r.json().get("hits", {}).get("hits", [])
        return any("acquisition" in str(h.get("_source","")).lower() for h in hits)
    except:
        return False

def score_ticker(symbol, vix, fng):
    log(f"\n── Scoring {symbol}…")
    try:
        hist = yf.Ticker(symbol).history(period="60d", interval="1d")
        if len(hist) < 20:
            log(f"  Not enough history ({len(hist)} bars)")
            return None

        close = hist["Close"]
        diff  = close.diff()
        gain  = diff.clip(lower=0).rolling(14).mean().iloc[-1]
        loss  = (-diff.clip(upper=0)).rolling(14).mean().iloc[-1]
        rsi   = (100 - 100/(1 + gain/loss)) if loss and loss != 0 else 50.0

        current_price = float(close.iloc[-1])
        mom5d         = (current_price / float(close.iloc[-5])  - 1) * 100
        mom20d        = (current_price / float(close.iloc[-20]) - 1) * 100
        vol_ratio     = float(hist["Volume"].iloc[-1]) / float(hist["Volume"].iloc[-20:].mean() or 1)

        log(f"  ${current_price:.2f} RSI={rsi:.1f} mom5={mom5d:+.1f}% mom20={mom20d:+.1f}% vol={vol_ratio:.2f}x")

        score = 0.50
        flags = []

        if mom5d > 8:    score += 0.08; flags.append("MOM5D_STRONG")
        elif mom5d > 4:  score += 0.04; flags.append("MOM5D_OK")
        elif mom5d < -3: score -= 0.06

        if mom20d > 20:    score += 0.05; flags.append("MOM20D_BULL")
        elif mom20d < -10: score -= 0.05

        if 55 <= rsi <= 72:  score += 0.06; flags.append("RSI_MOMENTUM")
        elif rsi > 78:        score -= 0.08
        elif rsi < 40:        score -= 0.06

        if vol_ratio > 2.0:   score += 0.05; flags.append("VOL_SURGE")
        elif vol_ratio > 1.5: score += 0.02

        if vix < 15:   score += 0.03; flags.append("LOW_VIX")
        elif vix < 20: score += 0.01

        if fng >= 60:   score += 0.04; flags.append("GREED")
        elif fng >= 45: score += 0.01

        if get_congress_flag(symbol) == "INSIDER_BUY":
            score += 0.06; flags.append("CONGRESS_BUY")

        if get_insider_flag(symbol):
            score += 0.05; flags.append("INSIDER_BUY")

        bullish = [f for f in flags if f in
                   ["MOM5D_STRONG","MOM20D_BULL","RSI_MOMENTUM","VOL_SURGE",
                    "LOW_VIX","GREED","CONGRESS_BUY","INSIDER_BUY"]]
        conviction = score >= 0.68 and len(bullish) >= 2
        log(f"  score={score:.2f} flags={flags} conviction={conviction}")

        return {"symbol":symbol,"score":score,"flags":flags,"bullish_flags":bullish,
                "high_conviction":conviction,"current_price":current_price,
                "rsi":rsi,"mom5d":mom5d,"mom20d":mom20d}
    except Exception as e:
        log(f"  {symbol} error: {e}")
        traceback.print_exc()
        return None

# ── STEP 6 — Option selection ─────────────────────────────────────────────────────
def find_best_option(ticker_data, vix):
    symbol = ticker_data["symbol"]
    price  = ticker_data["current_price"]
    log(f"  Finding options: {symbol} @ ${price:.2f}")

    now = datetime.now(timezone.utc)
    min_exp = (now + timedelta(days=18)).strftime("%Y-%m-%d")
    max_exp = (now + timedelta(days=45)).strftime("%Y-%m-%d")

    try:
        r = requests.get(f"{DATA_BASE}/v2/options/contracts",
                         headers=alpaca_headers(),
                         params={"underlying_symbols":symbol,"status":"active","type":"call",
                                 "expiration_date_gte":min_exp,"expiration_date_lte":max_exp,
                                 "limit":200},
                         timeout=15)
        if r.status_code != 200:
            log(f"  Contracts {r.status_code}: {r.text[:200]}")
            return None
        contracts = r.json().get("option_contracts", [])
        log(f"  {len(contracts)} contracts in window")
    except Exception as e:
        log(f"  Contracts error: {e}")
        return None

    if not contracts:
        return None

    min_strike = price * 1.05
    max_strike = price * 1.15
    candidates = [c for c in contracts
                  if min_strike <= float(c.get("strike_price",0)) <= max_strike
                  and int(c.get("open_interest",0) or 0) > 50]
    log(f"  Candidates (OTM 5-15%, OI>50): {len(candidates)}")

    if not candidates:
        candidates = [c for c in contracts
                      if min_strike <= float(c.get("strike_price",0)) <= max_strike]
        log(f"  Candidates (OI filter relaxed): {len(candidates)}")

    if not candidates:
        return None

    best = sorted(candidates, key=lambda c: int(c.get("open_interest",0) or 0), reverse=True)[0]
    contract_symbol = best.get("symbol","")
    strike  = float(best.get("strike_price", 0))
    expiry  = best.get("expiration_date", "")
    log(f"  Best: {contract_symbol} strike=${strike} expiry={expiry} OI={best.get('open_interest')}")

    # Quote
    try:
        r = requests.get(f"{DATA_BASE}/v1beta1/options/snapshots",
                         headers=alpaca_headers(),
                         params={"symbols": contract_symbol}, timeout=10)
        if r.status_code != 200:
            log(f"  Snapshot {r.status_code}")
            return None
        snap_data = r.json()
        snap = snap_data.get("snapshots", {}).get(contract_symbol, {}) or snap_data.get(contract_symbol, {})
        ask_price = float((snap.get("latestQuote") or {}).get("ap", 0) or 0)
        log(f"  Ask: ${ask_price:.2f}")
    except Exception as e:
        log(f"  Snapshot error: {e}")
        return None

    if ask_price <= 0 or ask_price > 25.00:
        log(f"  Ask ${ask_price:.2f} out of range")
        return None

    base_amount = 300 if vix < 20 else 200
    n = max(1, int(base_amount / (ask_price * 100)))
    cost = n * ask_price * 100
    if cost > 600:
        n = max(1, n - 1)
        cost = n * ask_price * 100
    log(f"  Size: {n}x @ ${ask_price:.2f} = ${cost:.2f}")

    return {"contract_symbol":contract_symbol,"strike":strike,"expiry":expiry,
            "ask_price":ask_price,"contracts_to_buy":n,"actual_cost":cost}

# ── STEP 7 — Place order ─────────────────────────────────────────────────────────
def place_order(ticker_data, option_data, db_pos):
    symbol   = ticker_data["symbol"]
    csym     = option_data["contract_symbol"]
    ask      = option_data["ask_price"]
    n        = option_data["contracts_to_buy"]
    cost     = option_data["actual_cost"]

    try:
        r = requests.get(f"{ALPACA_BASE}/v2/account", headers=alpaca_headers(), timeout=10)
        bp = float(r.json().get("buying_power", 0))
        log(f"  Buying power: ${bp:.2f}")
    except Exception as e:
        log(f"  Account error: {e}")
        return False

    if bp < cost * 1.1:
        log(f"  Insufficient buying power (${bp:.2f} < ${cost*1.1:.2f})")
        send_sms(f"⚠️ ALPACA [{MODE_LABEL}] Low buying power: ${bp:.0f}")
        return False

    log(f"  Placing BUY: {n}x {csym} @ ${ask:.2f}…")
    try:
        r = requests.post(f"{ALPACA_BASE}/v2/orders", headers=alpaca_headers(),
                          json={"symbol":csym,"qty":str(n),"side":"buy",
                                "type":"market","time_in_force":"day"}, timeout=15)
        log(f"  Order: {r.status_code} {r.text[:300]}")
        if r.status_code not in (200, 201):
            return False
    except Exception as e:
        log(f"  Order error: {e}")
        return False

    now = datetime.now(timezone.utc)
    try:
        requests.post(f"{SB_URL}/rest/v1/alpaca_positions", headers=sb_headers(),
                      json={"option_symbol":csym,"underlying":symbol,"option_type":"call",
                            "strike":option_data["strike"],"expiry":option_data["expiry"],
                            "contracts":n,"entry_premium":ask,"current_premium":ask,
                            "highest_premium":ask,"entry_time":now.isoformat(),
                            "conviction_flags":",".join(ticker_data["flags"]),"is_paper":IS_PAPER},
                      timeout=10)
    except Exception as e:
        log(f"  Position save error: {e}")

    try:
        requests.post(f"{SB_URL}/rest/v1/alpaca_trades", headers=sb_headers(),
                      json={"action":"BUY","underlying":symbol,"option_symbol":csym,
                            "contracts":n,"premium_per_contract":ask,"total_cost":cost,
                            "balance_before":bp,"balance_after":bp-cost,
                            "reason":",".join(ticker_data["flags"]),"rsi":ticker_data["rsi"],
                            "mom6h":ticker_data["mom5d"],"score":ticker_data["score"],
                            "conviction_flags":",".join(ticker_data["flags"]),
                            "strike":option_data["strike"],"expiry":option_data["expiry"],
                            "is_paper":IS_PAPER,"entry_time":now.isoformat()},
                      timeout=10)
    except Exception as e:
        log(f"  Trade log error: {e}")

    flags_str = ",".join(ticker_data["flags"])
    send_sms(
        f"🟢 ALPACA [{MODE_LABEL}] BUY: {n}x {csym} @ ${ask:.2f}/contract (${cost:.0f} total) | "
        f"{symbol} ${ticker_data['current_price']:.2f} score={ticker_data['score']:.2f} [{flags_str}]"
    )
    return True

# ── STEP 8 — Health upsert ────────────────────────────────────────────────────────
def upsert_health(vix, fng, open_count, new_entries, exits):
    try:
        r = requests.post(
            f"{SB_URL}/rest/v1/trading_bot_health",
            headers={**sb_headers(), "Prefer": "resolution=merge-duplicates"},
            json={"bot_name":"alpaca_options","last_run":datetime.now(timezone.utc).isoformat(),
                  "status":"ok","notes":f"VIX={vix:.1f} FNG={fng} open={open_count} entries={new_entries} exits={exits}"},
            timeout=10)
        log(f"Health upsert: {r.status_code}")
    except Exception as e:
        log(f"Health upsert error: {e}")

# ── MAIN ──────────────────────────────────────────────────────────────────────────
def main():
    print("\n" + "="*60)
    print(f"  ALPACA OPTIONS BOT — {MODE_LABEL} TRADING")
    print("="*60)

    if not check_market_hours():
        return

    db_pos     = load_positions()
    open_count = len(db_pos)
    log(f"Open positions: {open_count}")

    vix = get_vix()
    fng = get_fng()
    log(f"VIX={vix:.1f} | F&G={fng}")

    if vix > 35:
        log("⚠️  VIX > 35 — emergency close all, halt entries")
        send_sms(f"⚠️ ALPACA [{MODE_LABEL}] VIX={vix:.1f} DANGER — closing all, halting")
        for opt_sym, pos in db_pos.items():
            try:
                n = int(pos.get("contracts",1))
                requests.post(f"{ALPACA_BASE}/v2/orders", headers=alpaca_headers(),
                              json={"symbol":opt_sym,"qty":str(n),"side":"sell",
                                    "type":"market","time_in_force":"day"}, timeout=15)
                log(f"  Emergency exit: {opt_sym}")
            except Exception as e:
                log(f"  Emergency exit error: {e}")
        upsert_health(vix, fng, open_count, 0, open_count)
        return

    exits      = manage_positions(db_pos)
    open_count = len(db_pos)

    new_entries       = 0
    skipped           = 0
    positions_checked = 0

    if open_count >= 4:
        log(f"\nMax positions ({open_count}/4) — no new entries")
    elif fng < 25:
        log(f"\nExtreme fear F&G={fng} — no new entries")
    else:
        log(f"\n── Scanning {len(UNIVERSE)} tickers…")
        held = {p.get("underlying","").upper() for p in db_pos.values()}
        log(f"Already holding: {held}")

        for symbol in UNIVERSE:
            if open_count >= 4:
                break
            if symbol in held:
                log(f"  {symbol}: already held — skip")
                continue

            positions_checked += 1
            result = score_ticker(symbol, vix, fng)
            if result is None:
                skipped += 1
                continue
            if not result["high_conviction"]:
                log(f"  {symbol}: low conviction score={result['score']:.2f} — skip")
                skipped += 1
                continue

            option_data = find_best_option(result, vix)
            if not option_data:
                log(f"  {symbol}: no option found — skip")
                skipped += 1
                continue

            if place_order(result, option_data, db_pos):
                new_entries += 1
                open_count  += 1
                held.add(symbol)
                time.sleep(2)

    print(f"""
=== ALPACA OPTIONS BOT RUN ===
Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}
VIX: {vix:.1f} | F&G: {fng}
Tickers scanned: {positions_checked}
Positions managed: {len(db_pos) + exits}
Exits executed: {exits}
New entries: {new_entries}
Open positions after: {open_count}
Skipped (low score): {skipped}
""")
    upsert_health(vix, fng, open_count, new_entries, exits)

if __name__ == "__main__":
    main()
