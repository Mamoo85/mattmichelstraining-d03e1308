#!/usr/bin/env python3
"""Alpaca Paper Options Trading Bot"""

import os
import sys
import traceback
import datetime
import requests
import yfinance as yf
from datetime import timezone, timedelta

# ─── CREDENTIALS (from environment variables) ─────────────────────────────────
ALPACA_KEY    = os.environ["ALPACA_KEY"]
ALPACA_SECRET = os.environ["ALPACA_SECRET"]
PAPER_BASE    = "https://paper-api.alpaca.markets"
DATA_BASE     = "https://data.alpaca.markets"
SUPABASE_URL  = os.environ["SUPABASE_URL"]
SUPABASE_ANON = os.environ["SUPABASE_ANON_KEY"]
SMS_ENDPOINT  = f"{SUPABASE_URL}/functions/v1/trade-notification"

UNIVERSE = [
    "NVDA","TSLA","META","AMD","PLTR",
    "COIN","MSTR","IONQ","SOUN","BBAI",
    "RKLB","HOOD","MSFT","GOOGL"
]

ALPACA_HEADERS = {
    "APCA-API-KEY-ID":     ALPACA_KEY,
    "APCA-API-SECRET-KEY": ALPACA_SECRET,
    "Content-Type":        "application/json",
}
SUPABASE_HEADERS = {
    "apikey":        SUPABASE_ANON,
    "Authorization": f"Bearer {SUPABASE_ANON}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}

now_utc = datetime.datetime.now(timezone.utc)

def log(msg):
    print(f"[{now_utc.strftime('%H:%M:%S')}] {msg}", flush=True)

def send_sms(message):
    try:
        r = requests.post(SMS_ENDPOINT,
                          json={"message": message, "account": "PAPER"},
                          headers={"Content-Type": "application/json"},
                          timeout=10)
        print(f"  SMS → {r.status_code}", flush=True)
    except Exception as e:
        print(f"  SMS failed: {e}", flush=True)

# ─── STEP 2 — MARKET HOURS CHECK ──────────────────────────────────────────────
log(f"UTC: {now_utc.strftime('%Y-%m-%d %H:%M')}  weekday={now_utc.weekday()}")

if now_utc.weekday() >= 5:
    log("Market closed — skipping run (weekend)")
    sys.exit(0)

time_dec = now_utc.hour + now_utc.minute / 60
if time_dec < 13.75 or time_dec > 21.0:
    log("Market closed — skipping run (outside 13:45-21:00 UTC)")
    sys.exit(0)

log("Market open — proceeding")

# ─── STEP 3 — LOAD EXISTING POSITIONS ─────────────────────────────────────────
log("=== STEP 3: Load positions ===")

r = requests.get(f"{SUPABASE_URL}/rest/v1/alpaca_positions?select=*",
                 headers=SUPABASE_HEADERS, timeout=10)
db_positions = r.json() if r.status_code == 200 and isinstance(r.json(), list) else []
log(f"  DB positions: {len(db_positions)}")

r2 = requests.get(f"{PAPER_BASE}/v2/positions", headers=ALPACA_HEADERS, timeout=10)
alpaca_raw = r2.json() if r2.status_code == 200 else []
alpaca_positions = alpaca_raw if isinstance(alpaca_raw, list) else []
log(f"  Alpaca positions: {len(alpaca_positions)}")

alpaca_symbols = {p["symbol"] for p in alpaca_positions}
db_symbols     = {p["option_symbol"] for p in db_positions}

# Remove DB records for positions closed in Alpaca
for dp in list(db_positions):
    if dp["option_symbol"] not in alpaca_symbols:
        log(f"  Reconcile remove: {dp['option_symbol']} (gone from Alpaca)")
        requests.delete(
            f"{SUPABASE_URL}/rest/v1/alpaca_positions?option_symbol=eq.{dp['option_symbol']}",
            headers=SUPABASE_HEADERS, timeout=10)
        db_positions = [p for p in db_positions if p["option_symbol"] != dp["option_symbol"]]

open_count = len(db_positions)
log(f"  Open after reconcile: {open_count}")

# ─── STEP 4 — MANAGE EXISTING POSITIONS ───────────────────────────────────────
log("=== STEP 4: Manage positions ===")
exits = 0
positions_checked = 0

for pos in list(db_positions):
    opt_sym = pos["option_symbol"]
    positions_checked += 1
    try:
        snap_r = requests.get(
            f"{DATA_BASE}/v1beta1/options/snapshots/{opt_sym}",
            headers=ALPACA_HEADERS, timeout=10)
        if snap_r.status_code != 200:
            log(f"  {opt_sym}: snapshot {snap_r.status_code}, skip")
            continue
        snap_data = snap_r.json()
        snap = snap_data.get("snapshots", {}).get(opt_sym) or snap_data  # single vs multi
        current_premium = (snap.get("latestQuote", {}).get("ap", 0)
                           or snap.get("latestTrade", {}).get("p", 0))
        if current_premium <= 0:
            log(f"  {opt_sym}: no valid premium")
            continue

        entry_premium   = float(pos["entry_premium"])
        highest_premium = float(pos.get("highest_premium") or entry_premium)
        contracts       = int(pos["contracts"])
        pnl_pct = (current_premium - entry_premium) / entry_premium * 100

        if current_premium > highest_premium:
            highest_premium = current_premium
            requests.patch(
                f"{SUPABASE_URL}/rest/v1/alpaca_positions?option_symbol=eq.{opt_sym}",
                json={"highest_premium": highest_premium, "current_premium": current_premium},
                headers=SUPABASE_HEADERS, timeout=10)

        days_to_expiry = 999
        try:
            exp_dt = datetime.datetime.strptime(pos.get("expiry","")[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            days_to_expiry = (exp_dt - now_utc).days
        except Exception:
            pass

        exit_reason = None
        if   pnl_pct >= 75:                              exit_reason = "TAKE_PROFIT"
        elif pnl_pct <= -50:                             exit_reason = "STOP_LOSS"
        elif days_to_expiry < 7:                         exit_reason = "TIME_EXIT"
        elif current_premium < highest_premium * 0.60:  exit_reason = "TRAILING_STOP"

        log(f"  {opt_sym}: entry=${entry_premium:.2f} cur=${current_premium:.2f} "
            f"pnl={pnl_pct:+.1f}% dte={days_to_expiry} → {exit_reason or 'HOLD'}")

        if exit_reason:
            order_r = requests.post(f"{PAPER_BASE}/v2/orders",
                json={"symbol": opt_sym, "qty": str(contracts),
                      "side": "sell", "type": "market", "time_in_force": "day"},
                headers=ALPACA_HEADERS, timeout=15)
            if order_r.status_code in (200, 201):
                pnl_total = (current_premium - entry_premium) * contracts * 100
                requests.post(f"{SUPABASE_URL}/rest/v1/alpaca_trades",
                    json={"action":"SELL","underlying":pos.get("underlying"),"option_symbol":opt_sym,
                          "contracts":contracts,"premium_per_contract":current_premium,
                          "total_cost":current_premium*contracts*100,"reason":exit_reason,
                          "strike":pos.get("strike"),"expiry":pos.get("expiry"),"is_paper":True},
                    headers=SUPABASE_HEADERS, timeout=10)
                requests.delete(
                    f"{SUPABASE_URL}/rest/v1/alpaca_positions?option_symbol=eq.{opt_sym}",
                    headers=SUPABASE_HEADERS, timeout=10)
                db_positions  = [p for p in db_positions if p["option_symbol"] != opt_sym]
                open_count   -= 1
                exits        += 1
                sms = (f"🔴 ALPACA [PAPER] {exit_reason}: {opt_sym} x{contracts} | "
                       f"Entry: ${entry_premium:.2f} Exit: ${current_premium:.2f} | "
                       f"P&L: ${pnl_total:+.2f} ({pnl_pct:+.1f}%)")
                send_sms(sms)
                log(f"  EXIT: {sms}")
            else:
                log(f"  Sell order failed: {order_r.status_code} {order_r.text[:200]}")
    except Exception as e:
        log(f"  {opt_sym} error: {e}")
        traceback.print_exc()

# ─── STEP 5 — SCAN FOR NEW ENTRIES ────────────────────────────────────────────
log(f"=== STEP 5: Scan (open={open_count}/4) ===")
new_entries = 0
skipped     = 0
vix = 20.0
fng = 50

if open_count >= 4:
    log("  Max positions — skip scan")
else:
    # VIX
    try:
        vix = float(yf.Ticker("^VIX").history(period="2d")["Close"].iloc[-1])
    except Exception as e:
        log(f"  VIX fetch failed: {e}")
    log(f"  VIX={vix:.1f}")

    if vix > 35:
        log("  VIX > 35 — no new entries")
        send_sms(f"⚠️ ALPACA [PAPER] VIX ALERT: {vix:.1f} > 35 — halting new entries")
    else:
        # Fear & Greed
        try:
            fng_r = requests.get("https://api.alternative.me/fng/", timeout=5)
            fng = int(fng_r.json()["data"][0]["value"])
        except Exception as e:
            log(f"  F&G fetch failed: {e}")
        log(f"  F&G={fng}")

        if fng < 25:
            log(f"  F&G {fng} < 25 — extreme fear, skip")
        else:
            # Congressional trades
            house_trades = []
            try:
                h_r = requests.get("https://housestockwatcher.com/api/transactions", timeout=10)
                if h_r.status_code == 200:
                    house_trades = h_r.json()
            except Exception as e:
                log(f"  House watcher failed: {e}")

            existing_underlyings = {p.get("underlying","").upper() for p in db_positions}

            for symbol in UNIVERSE:
                if open_count >= 4:
                    break
                if symbol in existing_underlyings:
                    log(f"  {symbol}: already held, skip")
                    continue

                try:
                    log(f"  --- {symbol} ---")

                    # 5a. Price + momentum
                    hist = yf.Ticker(symbol).history(period="60d", interval="1d")
                    if len(hist) < 20:
                        log(f"  {symbol}: not enough history, skip")
                        skipped += 1
                        continue

                    close = hist["Close"]
                    gains = close.diff().clip(lower=0)
                    losses = (-close.diff().clip(upper=0))
                    avg_gain = gains.rolling(14).mean().iloc[-1]
                    avg_loss = losses.rolling(14).mean().iloc[-1]
                    rsi = 100 - (100 / (1 + avg_gain/avg_loss)) if avg_loss != 0 else 50.0
                    mom5d  = (close.iloc[-1] / close.iloc[-5]  - 1) * 100
                    mom20d = (close.iloc[-1] / close.iloc[-20] - 1) * 100
                    current_price  = float(close.iloc[-1])
                    volume_ratio   = float(hist["Volume"].iloc[-1] / hist["Volume"].iloc[-20:].mean())

                    # Congressional
                    recent       = [t for t in house_trades if symbol.upper() in t.get("ticker","").upper()]
                    recent_buys  = [t for t in recent if "Purchase" in t.get("type","")]
                    recent_sells = [t for t in recent if "Sale"     in t.get("type","")]
                    congress_flag = "INSIDER_BUY" if len(recent_buys) > len(recent_sells) else "NEUTRAL"

                    # SEC Form 4
                    insider_buy_flag = False
                    try:
                        thirty_ago = (now_utc - timedelta(days=30)).strftime("%Y-%m-%d")
                        today_s    = now_utc.strftime("%Y-%m-%d")
                        sec_r = requests.get(
                            f"https://efts.sec.gov/LATEST/search-index?q=%22{symbol}%22"
                            f"&dateRange=custom&startdt={thirty_ago}&enddt={today_s}&forms=4",
                            headers={"User-Agent": "alpaca-bot research@example.com"},
                            timeout=8)
                        if sec_r.status_code == 200:
                            insider_buy_flag = len(sec_r.json().get("hits",{}).get("hits",[])) > 0
                    except Exception:
                        pass

                    # 5f. Score
                    score = 0.50
                    flags = []

                    if   mom5d >  8: score += 0.08; flags.append("MOM5D_STRONG")
                    elif mom5d >  4: score += 0.04; flags.append("MOM5D_OK")
                    elif mom5d < -3: score -= 0.06

                    if   mom20d >  20: score += 0.05; flags.append("MOM20D_BULL")
                    elif mom20d < -10: score -= 0.05

                    if 55 <= rsi <= 72: score += 0.06; flags.append("RSI_MOMENTUM")
                    elif rsi > 78:      score -= 0.08
                    elif rsi < 40:      score -= 0.06

                    if   volume_ratio > 2.0: score += 0.05; flags.append("VOL_SURGE")
                    elif volume_ratio > 1.5: score += 0.02

                    if   vix < 15: score += 0.03; flags.append("LOW_VIX")
                    elif vix < 20: score += 0.01

                    if   fng >= 60: score += 0.04; flags.append("GREED")
                    elif fng >= 45: score += 0.01

                    if congress_flag   == "INSIDER_BUY": score += 0.06; flags.append("CONGRESS_BUY")
                    if insider_buy_flag:                  score += 0.05; flags.append("INSIDER_BUY")

                    BULL = {"MOM5D_STRONG","MOM20D_BULL","RSI_MOMENTUM","VOL_SURGE",
                            "LOW_VIX","GREED","CONGRESS_BUY","INSIDER_BUY"}
                    bull_flags      = [f for f in flags if f in BULL]
                    high_conviction = score >= 0.68 and len(bull_flags) >= 2

                    log(f"  {symbol}: ${current_price:.2f} rsi={rsi:.1f} "
                        f"mom5={mom5d:+.1f}% mom20={mom20d:+.1f}% "
                        f"vol={volume_ratio:.1f}x score={score:.2f} flags={flags} "
                        f"conviction={high_conviction}")

                    if not high_conviction:
                        skipped += 1
                        continue

                    # ─── STEP 6 — OPTION SELECTION ────────────────────────────
                    log(f"  {symbol}: HIGH CONVICTION — selecting contract...")

                    c_r = requests.get(f"{DATA_BASE}/v2/options/contracts",
                        params={"underlying_symbols": symbol, "status": "active",
                                "type": "call", "limit": 1000},
                        headers=ALPACA_HEADERS, timeout=15)

                    if c_r.status_code != 200:
                        log(f"  {symbol}: contracts fetch {c_r.status_code}, skip")
                        skipped += 1
                        continue

                    all_c = c_r.json().get("option_contracts", [])
                    target_c = []
                    for c in all_c:
                        try:
                            exp_dt   = datetime.datetime.strptime(c["expiration_date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                            days_out = (exp_dt - now_utc).days
                            strike_c = float(c["strike_price"])
                            oi       = int(c.get("open_interest") or 0)
                            if (18 <= days_out <= 45
                                    and current_price * 1.05 <= strike_c <= current_price * 1.15
                                    and oi > 50):
                                target_c.append(c)
                        except Exception:
                            continue

                    if not target_c:
                        log(f"  {symbol}: no qualifying contracts (18-45d, 5-15% OTM, OI>50)")
                        skipped += 1
                        continue

                    best = max(target_c, key=lambda c: int(c.get("open_interest") or 0))
                    contract_symbol = best["symbol"]
                    strike  = float(best["strike_price"])
                    expiry  = best["expiration_date"]
                    log(f"  {symbol}: best={contract_symbol} strike=${strike} exp={expiry}")

                    # Quote
                    snap_r2 = requests.get(f"{DATA_BASE}/v1beta1/options/snapshots",
                        params={"symbols": contract_symbol},
                        headers=ALPACA_HEADERS, timeout=10)
                    if snap_r2.status_code != 200:
                        log(f"  {symbol}: snapshot {snap_r2.status_code}, skip")
                        skipped += 1
                        continue

                    snaps = snap_r2.json().get("snapshots", {})
                    if contract_symbol not in snaps:
                        log(f"  {symbol}: no snapshot for {contract_symbol}, skip")
                        skipped += 1
                        continue

                    snap2      = snaps[contract_symbol]
                    ask_price  = snap2.get("latestQuote", {}).get("ap", 0) or 0.0
                    if ask_price <= 0 or ask_price > 25.0:
                        log(f"  {symbol}: ask=${ask_price:.2f} out of range, skip")
                        skipped += 1
                        continue

                    # Position sizing
                    base_amount       = 200 if vix >= 20 else 300
                    contracts_to_buy  = max(1, int(base_amount / (ask_price * 100)))
                    actual_cost       = contracts_to_buy * ask_price * 100
                    if actual_cost > 600:
                        contracts_to_buy = max(1, contracts_to_buy - 1)
                        actual_cost = contracts_to_buy * ask_price * 100
                    log(f"  {symbol}: ask=${ask_price:.2f} qty={contracts_to_buy} cost=${actual_cost:.0f}")

                    # ─── STEP 7 — PLACE ORDER ──────────────────────────────────
                    if open_count >= 4:
                        log("  Max positions reached — stop")
                        break

                    acct_r = requests.get(f"{PAPER_BASE}/v2/account", headers=ALPACA_HEADERS, timeout=10)
                    account = acct_r.json()
                    buying_power = float(account.get("buying_power", 0))

                    if buying_power < 200:
                        msg = f"⚠️ ALPACA [PAPER] LOW BUYING POWER: ${buying_power:.0f}"
                        send_sms(msg)
                        log(msg)
                        break

                    if buying_power < actual_cost * 1.1:
                        log(f"  {symbol}: BP ${buying_power:.0f} < cost ${actual_cost*1.1:.0f}, skip")
                        skipped += 1
                        continue

                    order_r = requests.post(f"{PAPER_BASE}/v2/orders",
                        json={"symbol": contract_symbol, "qty": str(contracts_to_buy),
                              "side": "buy", "type": "market", "time_in_force": "day"},
                        headers=ALPACA_HEADERS, timeout=15)

                    if order_r.status_code in (200, 201):
                        log(f"  ✅ ORDER PLACED: {contract_symbol} x{contracts_to_buy}")

                        requests.post(f"{SUPABASE_URL}/rest/v1/alpaca_positions",
                            json={"option_symbol": contract_symbol, "underlying": symbol,
                                  "option_type": "call", "strike": strike, "expiry": expiry,
                                  "contracts": contracts_to_buy, "entry_premium": ask_price,
                                  "current_premium": ask_price, "highest_premium": ask_price,
                                  "entry_time": now_utc.isoformat(),
                                  "conviction_flags": ",".join(flags), "is_paper": True},
                            headers=SUPABASE_HEADERS, timeout=10)

                        requests.post(f"{SUPABASE_URL}/rest/v1/alpaca_trades",
                            json={"action": "BUY", "underlying": symbol,
                                  "option_symbol": contract_symbol,
                                  "contracts": contracts_to_buy,
                                  "premium_per_contract": ask_price,
                                  "total_cost": actual_cost,
                                  "balance_before": buying_power,
                                  "balance_after": buying_power - actual_cost,
                                  "reason": ",".join(flags),
                                  "rsi": rsi, "mom5d": mom5d, "score": score,
                                  "conviction_flags": ",".join(flags),
                                  "strike": strike, "expiry": expiry, "is_paper": True},
                            headers=SUPABASE_HEADERS, timeout=10)

                        sms = (f"🟢 ALPACA [PAPER] BUY: {contracts_to_buy}x {contract_symbol} "
                               f"@ ${ask_price:.2f}/contract (${actual_cost:.0f} total) | "
                               f"{symbol} ${current_price:.2f} score={score:.2f} [{','.join(flags)}]")
                        send_sms(sms)
                        log(f"  {sms}")
                        open_count += 1
                        new_entries += 1
                        existing_underlyings.add(symbol)
                    else:
                        log(f"  {symbol}: order failed {order_r.status_code}: {order_r.text[:300]}")
                        skipped += 1

                except Exception as e:
                    log(f"  {symbol}: EXCEPTION — {e}")
                    traceback.print_exc()
                    skipped += 1

# ─── STEP 8 — SUMMARY ─────────────────────────────────────────────────────────
print(f"""
=== ALPACA OPTIONS BOT RUN ===
Time:              {now_utc.strftime('%Y-%m-%d %H:%M UTC')}
VIX:               {vix:.1f}
Fear & Greed:      {fng}
Positions managed: {positions_checked}
Exits executed:    {exits}
New entries:       {new_entries}
Open positions:    {open_count}
Skipped:           {skipped}
""", flush=True)

try:
    requests.post(f"{SUPABASE_URL}/rest/v1/trading_bot_health",
        json={"bot_name": "alpaca_options", "last_run": "now()", "status": "ok",
              "notes": f"VIX={vix:.1f} FNG={fng} open={open_count} entries={new_entries} exits={exits}"},
        headers={**SUPABASE_HEADERS, "Prefer": "resolution=merge-duplicates"},
        timeout=10)
    log("Health record upserted")
except Exception as e:
    log(f"Health upsert failed: {e}")
