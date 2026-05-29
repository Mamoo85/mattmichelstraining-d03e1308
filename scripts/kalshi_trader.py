#!/usr/bin/env python3
"""
Kalshi Prediction Market Trading Bot
$197 → $2,000 challenge
Runs hourly via GitHub Actions (full internet access)
"""

import os, sys, time, json, math, uuid, base64
from datetime import datetime, timezone, timedelta

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

# ─── CONFIG ─────────────────────────────────────────────────────────────────
KALSHI_KEY_ID  = "4661674e-a384-4af9-a3ca-6a8c6af836a9"
KALSHI_BASE    = "https://api.elections.kalshi.com"
HARD_FLOOR     = 20.0
DRY_RUN        = os.getenv("DRY_RUN", "").lower() in ("1", "true", "yes")

SUPABASE_URL   = os.getenv("SUPABASE_URL", "https://zmyczlfuufhngzovkjdh.supabase.co")
SUPABASE_KEY   = os.getenv("SUPABASE_KEY",
    "eyJ.REDACTED.JWT")

_FALLBACK_PEM = """-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA21Xajc5L4eqNsuaJ8QtUqebGfpXMjIeQmYd1OewLyoite+yu
JI93HlP1OiqHoUyPStSohaGjOhReGp35uXU4VruRjQ45ZkKTOauoesw0S5qTLppL
f3EXOMdKRBNQViDlam4wbK/3lNVrBk3Y8EjAZZwj73/08tIoLKtPOUSWx5RJou0e
48FZ8fOSfyN8dGo0pTUyXWwhtweQ0XaiULJGgr5ExDwMEjJBOwy4Cf+8nc7qMlWM
2VXq58K6Nt6jNzPhDwbCk0g3+jceYDeNf17BrWN5dl2m2H58/jyZ7GysX8lfPjBY
YBq+O2iZMhmNuI0iAb8QF7qYKv9ya542YpHdvwIDAQABAoIBAAIRMhPKEPRadebC
E3oTxZgrAPiVHYNpjQGqwX5ql3CGOemuwQlpLLyQGqySAAs+Ic+ZEimIQiCRq+gL
pcc2BUeT/FAxr8rN79NIUeMuZNkdkNY3RWTjF6Pvr5HVWMQnCo0mkrWY3E1+dsQY
HGZPWTjb8DQZUaFZkmAGu/gUib3scbh51odBLAF4q+MnXSqqikayOEsaHCRxyXfJ
gmSywa0s6YoigymWwCdWGJt+fLspP2ILzsym5g186a5Jc3h8GFaXVBRKz2fDsXm7
0PqwLrOsuM/CUMzRsSXgmBkdZ+VhANqK5uozy9CN3rBuj7gdbyroYAVh7QPjWtxc
jR0RpakCgYEA4fQtkRJpxiXWYCnyYkJEtRcabsCYnqaFIoT+rnEfrzswLC32jysS
gaUXoAFMVNO7rpr1dSnMy2FAGoUO5r6qj+Bmtt6OCc5WXsDz8/NzOtsOpeFVGPok
IZ24NvQxIkfqP3E8nvMO8HuJT5eyoQUh4K6f1FN+4hglP0yN3zN4Mv0CgYEA+IBf
iPGoA2+L2QT1SW6kNa7HmXrzDExcD2zOXMjaaf46N2A7R4iGOjsWItd6h9lH653K
HvSZjDsXn1XiWXDXcpt9pMzP25ffrpchUX9H7arrfVAKq8rOslEDOPQEaU09qd3o
e31Ud0IBlkq4pjz1BB5l/35ZY0IV/IedMwG/JmsCgYEAmWj/xw+JYU8vTfss5im4
HHujJq788Dp/CgDiKe4EZST6gAR08p974SoF8EzxVmardtEe9n163lsY+uh8RY4O
n8Dr/Bz+swm0+oBnIaqZAczZFSb4cAzlmy1KdYU2FuBc2tY3InREIGK/x5pnXYvu
hG4Ldk16SGe8Yk3HxVNcuMECgYBOv1+G5g14CUEn5IpWWtluqZRW7r9WhlwmBzTd
8khEjmukYLpoULs4eMDrCZ2qrxA7eiUy6hA+f/tcYrr33OppRxzpvH2h+N7JVNsa
GFuS1TcK3vKCviICH+oFgk5jkDaaPdgOSgkaQbB/D+6zv11lkLyB2mg5LBgLjm4i
W8tXQQKBgEzzItTgdi9Y8Oyrw4/1YJHPaBNKiMeybImy2Vhd6GfcHwu5AvUpKSLF
49JHH7NzjGCihywRXQi3Pda72KbWRqozCf3ds3oOcECN93lZmcBjVv077EDhdTUU
GFomdOFkXY8usQmEJ+UxghHnwOJN+9f/6IUlUYi2x/bTrv1TSGoE
-----END RSA PRIVATE KEY-----"""

PRIVATE_KEY_PEM = os.getenv("KALSHI_PRIVATE_KEY", _FALLBACK_PEM).strip()

# ─── SIGNING ────────────────────────────────────────────────────────────────
_pkey = serialization.load_pem_private_key(PRIVATE_KEY_PEM.encode(), password=None)

def sign_kalshi(method: str, path: str) -> tuple[str, str]:
    ts = str(int(time.time() * 1000))
    msg = (ts + method + path).encode()
    sig = _pkey.sign(msg, padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=32), hashes.SHA256())
    return ts, base64.b64encode(sig).decode()

def kalshi(method: str, path: str, body: dict = None) -> dict:
    ts, sig = sign_kalshi(method, path)
    headers = {
        "KALSHI-ACCESS-KEY": KALSHI_KEY_ID,
        "KALSHI-ACCESS-TIMESTAMP": ts,
        "KALSHI-ACCESS-SIGNATURE": sig,
        "Content-Type": "application/json",
    }
    url = KALSHI_BASE + path
    resp = requests.request(method, url, headers=headers, json=body, timeout=15)
    try:
        return resp.json()
    except Exception:
        return {"_raw": resp.text, "_status": resp.status_code}

# ─── SUPABASE ────────────────────────────────────────────────────────────────
_sb_headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

def sb_insert(table: str, row: dict) -> bool:
    if DRY_RUN:
        print(f"  [DRY] INSERT {table}: {row}")
        return True
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=_sb_headers, json=row, timeout=10)
    if r.status_code not in (200, 201, 204):
        print(f"  WARN: Supabase insert {table} → {r.status_code} {r.text[:200]}")
    return r.ok

def sb_upsert(table: str, row: dict, on_conflict: str) -> bool:
    if DRY_RUN:
        print(f"  [DRY] UPSERT {table}: {row}")
        return True
    hdrs = {**_sb_headers, "Prefer": f"resolution=merge-duplicates,return=minimal"}
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=hdrs, json=row, timeout=10)
    if r.status_code not in (200, 201, 204):
        print(f"  WARN: Supabase upsert {table} → {r.status_code} {r.text[:200]}")
    return r.ok

def sb_delete(table: str, ticker: str) -> bool:
    if DRY_RUN:
        print(f"  [DRY] DELETE {table} ticker={ticker}")
        return True
    r = requests.delete(f"{SUPABASE_URL}/rest/v1/{table}?ticker=eq.{ticker}", headers=_sb_headers, timeout=10)
    return r.ok

def sb_select(table: str) -> list:
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}?select=*", headers=_sb_headers, timeout=10)
    return r.json() if r.ok else []

# ─── MARKET DATA ─────────────────────────────────────────────────────────────
YF = "https://query1.finance.yahoo.com"
YF_HDRS = {"User-Agent": "Mozilla/5.0"}

def rsi14(closes: list) -> float:
    if len(closes) < 15:
        return 50.0
    gains = [max(closes[i] - closes[i-1], 0) for i in range(1, len(closes))]
    losses = [max(closes[i-1] - closes[i], 0) for i in range(1, len(closes))]
    ag = sum(gains[-14:]) / 14
    al = sum(losses[-14:]) / 14
    return round(100 - 100 / (1 + ag / (al or 0.0001)), 1)

def get_btc() -> dict:
    try:
        r = requests.get(f"{YF}/v8/finance/chart/BTC-USD?interval=1h&range=2d", headers=YF_HDRS, timeout=10)
        d = r.json()
        closes = [x for x in d["chart"]["result"][0]["indicators"]["quote"][0]["close"] if x]
        price = closes[-1]
        mom1h = round((closes[-1] - closes[-2]) / closes[-2] * 100, 2) if len(closes) >= 2 else 0
        mom6h = round((closes[-1] - closes[-6]) / closes[-6] * 100, 2) if len(closes) >= 6 else 0
        return {"price": round(price), "rsi": rsi14(closes), "mom1h": mom1h, "mom6h": mom6h}
    except Exception as e:
        print(f"  WARN BTC fetch: {e}")
        return {"price": 0, "rsi": 50, "mom1h": 0, "mom6h": 0}

def get_spy() -> dict:
    try:
        r = requests.get(f"{YF}/v8/finance/chart/SPY?interval=1h&range=5d", headers=YF_HDRS, timeout=10)
        d = r.json()
        closes = [x for x in d["chart"]["result"][0]["indicators"]["quote"][0]["close"] if x]
        price = round(closes[-1], 2)
        mom1h = round((closes[-1] - closes[-2]) / closes[-2] * 100, 2) if len(closes) >= 2 else 0
        mom5d = round((closes[-1] - closes[-9]) / closes[-9] * 100, 2) if len(closes) >= 9 else 0
        return {"price": price, "rsi": rsi14(closes), "mom1h": mom1h, "mom5d": mom5d}
    except Exception as e:
        print(f"  WARN SPY fetch: {e}")
        return {"price": 0, "rsi": 50, "mom1h": 0, "mom5d": 0}

def get_macro() -> dict:
    try:
        r = requests.get(f"{YF}/v7/finance/quote?symbols=%5EVIX,%5ETNX", headers=YF_HDRS, timeout=10)
        results = r.json()["quoteResponse"]["result"]
        vix = round(next((x["regularMarketPrice"] for x in results if "VIX" in x.get("symbol","")), 0), 1)
        tnx = round(next((x["regularMarketPrice"] for x in results if "TNX" in x.get("symbol","")), 0), 2)
        return {"vix": vix, "tnx": tnx}
    except Exception as e:
        print(f"  WARN macro fetch: {e}")
        return {"vix": 0, "tnx": 0}

# ─── KELLY SIZING ────────────────────────────────────────────────────────────
def half_kelly(bal: float, true_prob: float, price_c: int, max_pct: int) -> tuple[int, float, float]:
    """Returns (contracts, bet_dollars, kelly_frac)"""
    b = (100 - price_c) / price_c
    kf = (b * true_prob - (1 - true_prob)) / b
    hkf = max(kf / 2, 0.0)
    bet = min(hkf * bal, (max_pct / 100) * bal)
    contracts = math.floor(bet / (price_c / 100))
    return max(contracts, 0), round(bet, 2), round(kf, 4)

# ─── OPPORTUNITY SCORING ─────────────────────────────────────────────────────
def score_btc_market(m: dict, btc: dict, macro: dict) -> dict | None:
    last = m.get("last_price") or 0
    vol  = m.get("volume") or 0
    oi   = m.get("open_interest") or 0
    if last < 5 or last > 95 or (vol == 0 and oi == 0):
        return None
    close_time = m.get("close_time")
    if not close_time:
        return None
    try:
        ct = datetime.fromisoformat(close_time.replace("Z", "+00:00"))
        hl = (ct - datetime.now(timezone.utc)).total_seconds() / 3600
    except:
        return None
    if hl <= 0 or hl > 36:
        return None
    if macro["vix"] > 25:
        return None
    title = m.get("title", "")
    if "above" not in title.lower():
        return None
    import re
    match = re.search(r'\$([\d,]+)', title)
    if not match:
        return None
    target = int(match.group(1).replace(",", ""))
    if not btc["price"]:
        return None
    pct = (btc["price"] - target) / target * 100

    true_prob = None
    side = "yes"
    if btc["rsi"] > 65 and btc["mom1h"] > 1.0:
        if pct > 3:   true_prob, side = 0.90, "yes"
        elif pct > 0: true_prob, side = 0.76, "yes"
        elif pct > -2: true_prob, side = 0.60, "yes"
    elif btc["rsi"] < 35 and btc["mom1h"] < -1.0:
        if pct < -3:  true_prob, side = 0.15, "no"
        elif pct < 0: true_prob, side = 0.30, "no"
    elif abs(pct) < 1:
        return None  # too close to call
    elif pct > 5:
        true_prob, side = 0.72, "yes"
    elif pct < -5:
        true_prob, side = 0.28, "no"

    if true_prob is None:
        return None

    eff_price  = last if side == "yes" else 100 - last
    implied    = eff_price / 100
    edge       = (true_prob - implied) * 100
    if edge < 5:
        return None

    return dict(ticker=m["ticker"], title=title, side=side, price_c=eff_price,
                true_prob=true_prob, implied=implied, edge=edge, hours_left=hl,
                vol=vol, oi=oi, mtype="BTC")

def score_inxi_market(m: dict, spy: dict, macro: dict) -> dict | None:
    last = m.get("last_price") or 0
    vol  = m.get("volume") or 0
    if last < 5 or last > 95:
        return None
    close_time = m.get("close_time")
    if not close_time:
        return None
    try:
        ct = datetime.fromisoformat(close_time.replace("Z", "+00:00"))
        hl = (ct - datetime.now(timezone.utc)).total_seconds() / 3600
    except:
        return None
    if hl <= 0 or hl > 6:
        return None
    title_low = (m.get("title") or "").lower()
    true_prob = None
    side = "yes"
    bull = spy["rsi"] > 60 and macro["vix"] < 18
    bear = spy["rsi"] < 40 and macro["vix"] > 20
    if bull and any(w in title_low for w in ("above","higher","up","green")):
        true_prob, side = 0.70, "yes"
    elif bear and any(w in title_low for w in ("below","lower","down","red")):
        true_prob, side = 0.70, "yes"
    if true_prob is None:
        return None
    implied = last / 100
    edge = (true_prob - implied) * 100
    if edge < 5:
        return None
    return dict(ticker=m["ticker"], title=m.get("title",""), side=side, price_c=last,
                true_prob=true_prob, implied=implied, edge=edge, hours_left=hl,
                vol=vol, oi=m.get("open_interest",0), mtype="INXI")

def score_eth_market(m: dict, btc: dict, macro: dict) -> dict | None:
    last = m.get("last_price") or 0
    if last < 5 or last > 95:
        return None
    if macro["vix"] > 25:
        return None
    close_time = m.get("close_time")
    if not close_time:
        return None
    try:
        ct = datetime.fromisoformat(close_time.replace("Z", "+00:00"))
        hl = (ct - datetime.now(timezone.utc)).total_seconds() / 3600
    except:
        return None
    if hl <= 0 or hl > 36:
        return None
    title = (m.get("title") or "").lower()
    if "above" not in title:
        return None
    true_prob, side = None, "yes"
    if btc["rsi"] > 60 and btc["mom1h"] > 0.5:
        true_prob, side = 0.67, "yes"
    elif btc["rsi"] < 40 and btc["mom1h"] < -0.5:
        true_prob, side = 0.33, "no"
    if true_prob is None:
        return None
    eff_price = last if side == "yes" else 100 - last
    implied   = eff_price / 100
    edge      = (true_prob - implied) * 100
    if edge < 5:
        return None
    return dict(ticker=m["ticker"], title=m.get("title",""), side=side, price_c=eff_price,
                true_prob=true_prob, implied=implied, edge=edge, hours_left=hl,
                vol=m.get("volume",0), oi=m.get("open_interest",0), mtype="ETH")

def score_fed_market(m: dict) -> dict | None:
    last = m.get("last_price") or 0
    vol  = m.get("volume") or 0
    oi   = m.get("open_interest") or 0
    if last < 5 or last > 95:
        return None
    ticker = m.get("ticker","")
    title  = (m.get("title") or "").lower()
    # Target: Jun 2026 no-change / hold markets — consensus ~85%
    is_jun = any(x in ticker.upper() for x in ("JUN","26JUN")) or "jun" in title
    if not is_jun:
        return None
    is_hold = any(w in title for w in ("hold","unchanged","no change","4.25","no cut","no hike"))
    if not is_hold:
        return None
    true_prob = 0.85
    implied   = last / 100
    edge      = (true_prob - implied) * 100
    if edge < 5:
        return None
    return dict(ticker=ticker, title=m.get("title",""), side="yes", price_c=last,
                true_prob=true_prob, implied=implied, edge=edge, hours_left=9999,
                vol=vol, oi=oi, mtype="FED")

# ─── MAIN ────────────────────────────────────────────────────────────────────
def main():
    ts = datetime.now(timezone.utc).isoformat()
    log = []
    exits = []
    print(f"\n{'='*60}")
    print(f" KALSHI TRADER  {ts}  {'[DRY RUN]' if DRY_RUN else '[LIVE]'}")
    print(f"{'='*60}")

    # ── STEP 2: Balance ──────────────────────────────────────────────────────
    bal_data    = kalshi("GET", "/trade-api/v2/portfolio/balance")
    bal_dollars = bal_data.get("balance_dollars") or (bal_data.get("balance", 0) / 100)
    log.append(f"Balance: ${bal_dollars:.2f}")
    print(f"Balance: ${bal_dollars:.2f}")

    if bal_dollars < HARD_FLOOR:
        print(f"HALT: balance ${bal_dollars} < floor ${HARD_FLOOR}")
        sb_upsert("trading_bot_health", {
            "bot_id": "kalshi", "last_run_at": ts,
            "current_balance": bal_dollars, "updated_at": ts,
            "last_error": f"HALT balance ${bal_dollars}",
        }, "bot_id")
        sys.exit(0)

    stage   = 3 if bal_dollars >= 500 else 2 if bal_dollars >= 250 else 1
    max_pct = 25 if stage == 1 else 30
    print(f"Stage {stage} | Max bet {max_pct}%")

    # ── STEP 3: Market research ──────────────────────────────────────────────
    btc   = get_btc()
    spy   = get_spy()
    macro = get_macro()
    print(f"BTC  price=${btc['price']}  RSI={btc['rsi']}  mom1h={btc['mom1h']}%  mom6h={btc['mom6h']}%")
    print(f"SPY  price=${spy['price']}  RSI={spy['rsi']}  mom1h={spy['mom1h']}%  mom5d={spy['mom5d']}%")
    print(f"VIX={macro['vix']}  10Y={macro['tnx']}%")
    log += [f"BTC={btc}", f"SPY={spy}", f"MACRO={macro}"]

    # ── STEP 6: Manage existing positions ────────────────────────────────────
    open_pos = sb_select("kalshi_positions")
    print(f"Open positions: {len(open_pos)}")
    for pos in open_pos:
        try:
            mkt = kalshi("GET", f"/trade-api/v2/markets/{pos['ticker']}")
            m   = mkt.get("market", {})
            cur = m.get("last_price") or 0
            entry = pos.get("avg_price_cents") or 0
            if entry == 0 or cur == 0:
                continue
            gain = (cur - entry) / entry
            ct_str = m.get("close_time","")
            if ct_str:
                ct = datetime.fromisoformat(ct_str.replace("Z","+00:00"))
                hours_left = (ct - datetime.now(timezone.utc)).total_seconds() / 3600
            else:
                hours_left = 999

            take_profit = gain >= 0.35
            cut_loss    = gain <= -0.45
            lock_in     = hours_left < 6 and cur > entry

            if take_profit or cut_loss or lock_in:
                reason = "take_profit" if take_profit else "cut_loss" if cut_loss else "lock_in_6h"
                print(f"  EXIT {pos['ticker']} gain={gain*100:.1f}% reason={reason}")
                if not DRY_RUN:
                    sell_resp = kalshi("POST", "/trade-api/v2/portfolio/orders", {
                        "ticker": pos["ticker"], "action": "sell", "side": pos["side"],
                        "type": "market", "count": pos["contracts"],
                        "client_order_id": str(uuid.uuid4()),
                    })
                    order_id = sell_resp.get("order", {}).get("order_id", "")
                else:
                    order_id = "DRY_RUN"

                pnl = round((cur - entry) * pos["contracts"])
                sb_insert("kalshi_trades", {
                    "action": "sell", "ticker": pos["ticker"], "event_title": pos.get("event_title",""),
                    "contracts": pos["contracts"], "price_cents": cur, "side": pos["side"],
                    "total_cost_cents": cur * pos["contracts"], "balance_before": bal_dollars,
                    "balance_after": bal_dollars + pnl / 100, "pnl_cents": pnl,
                    "kelly_fraction": 0, "implied_prob": cur / 100, "edge": 0,
                    "reason": reason, "stage": stage, "order_id": order_id,
                })
                sb_delete("kalshi_positions", pos["ticker"])
                exits.append(f"SOLD {pos['ticker']} @{cur}c gain={gain*100:.1f}% ({reason})")
        except Exception as e:
            print(f"  WARN position check {pos.get('ticker')}: {e}")

    # ── STEP 4: Scan markets ─────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    utc_hour = now.hour
    utc_dow  = now.weekday()  # 0=Mon, 6=Sun
    market_hours = (14 <= utc_hour < 20) and (utc_dow <= 4)

    opps = []

    # BTC (all stages)
    try:
        d = kalshi("GET", "/trade-api/v2/markets?limit=50&status=open&series_ticker=KXBTC")
        for m in d.get("markets", []):
            scored = score_btc_market(m, btc, macro)
            if scored:
                opps.append(scored)
        print(f"  BTC markets scanned: {len(d.get('markets',[]))}  candidates: {sum(1 for o in opps if o['mtype']=='BTC')}")
    except Exception as e:
        print(f"  WARN BTC scan: {e}")

    # INXI S&P500 hourly (market hours, stage 2+)
    if market_hours and stage >= 2:
        try:
            d = kalshi("GET", "/trade-api/v2/markets?limit=50&status=open&series_ticker=INXI")
            for m in d.get("markets", []):
                scored = score_inxi_market(m, spy, macro)
                if scored:
                    opps.append(scored)
            print(f"  INXI markets scanned: {len(d.get('markets',[]))}  candidates: {sum(1 for o in opps if o['mtype']=='INXI')}")
        except Exception as e:
            print(f"  WARN INXI scan: {e}")
    else:
        print(f"  INXI skip (market_hours={market_hours} stage={stage})")

    # ETH (stage 2+)
    if stage >= 2:
        try:
            d = kalshi("GET", "/trade-api/v2/markets?limit=30&status=open&series_ticker=KXETH")
            for m in d.get("markets", []):
                scored = score_eth_market(m, btc, macro)
                if scored:
                    opps.append(scored)
            print(f"  ETH markets scanned: {len(d.get('markets',[]))}  candidates: {sum(1 for o in opps if o['mtype']=='ETH')}")
        except Exception as e:
            print(f"  WARN ETH scan: {e}")

    # Fed rate markets (all stages — high-probability macro bet)
    try:
        d = kalshi("GET", "/trade-api/v2/markets?limit=30&status=open&series_ticker=KXFED")
        for m in d.get("markets", []):
            scored = score_fed_market(m)
            if scored:
                opps.append(scored)
        print(f"  FED markets scanned: {len(d.get('markets',[]))}  candidates: {sum(1 for o in opps if o['mtype']=='FED')}")
    except Exception as e:
        print(f"  WARN FED scan: {e}")

    print(f"Total opportunities: {len(opps)}")

    # ── STEP 5: Select best & execute ────────────────────────────────────────
    opps.sort(key=lambda o: (-o["edge"], -o["vol"]))
    trade_result = {"action": "HOLD", "reason": "No qualifying opportunity"}

    if opps:
        best = opps[0]
        print(f"Best: {best['ticker']} @{best['price_c']}c side={best['side']} "
              f"true={round(best['true_prob']*100)}% implied={round(best['implied']*100)}% "
              f"edge=+{round(best['edge'],1)}% type={best['mtype']}")

        already_open = any(p["ticker"] == best["ticker"] for p in open_pos)
        if not already_open:
            contracts, bet_dollars, kelly_f = half_kelly(bal_dollars, best["true_prob"], best["price_c"], max_pct)
            print(f"Kelly: f={kelly_f:.3f}  half={kelly_f/2:.3f}  contracts={contracts}  bet=${bet_dollars}")

            if contracts >= 1:
                opp_price   = 100 - best["price_c"]
                client_id   = str(uuid.uuid4())
                total_cents = best["price_c"] * contracts

                if not DRY_RUN:
                    order = kalshi("POST", "/trade-api/v2/portfolio/orders", {
                        "ticker":    best["ticker"],
                        "action":    "buy",
                        "side":      best["side"],
                        "type":      "limit",
                        "count":     contracts,
                        "yes_price": best["price_c"] if best["side"] == "yes" else opp_price,
                        "no_price":  opp_price        if best["side"] == "yes" else best["price_c"],
                        "client_order_id": client_id,
                    })
                    order_id  = order.get("order", {}).get("order_id", client_id)
                    bal_after = bal_dollars - total_cents / 100
                    print(f"ORDER → {order}")
                else:
                    order_id  = "DRY_RUN"
                    bal_after = bal_dollars - total_cents / 100

                # DB: trade log
                sb_insert("kalshi_trades", {
                    "action": "buy", "ticker": best["ticker"], "event_title": best["title"],
                    "contracts": contracts, "price_cents": best["price_c"], "side": best["side"],
                    "total_cost_cents": total_cents, "balance_before": bal_dollars,
                    "balance_after": bal_after, "pnl_cents": 0,
                    "kelly_fraction": round(kelly_f, 4), "implied_prob": best["implied"],
                    "edge": best["edge"],
                    "reason": (f"{best['mtype']} edge={round(best['edge'],1)}% "
                               f"kelly={round(kelly_f*100,1)}% stage={stage} "
                               f"btcRSI={btc['rsi']} spyRSI={spy['rsi']} vix={macro['vix']}"),
                    "stage": stage, "order_id": order_id,
                })
                # DB: open position
                sb_upsert("kalshi_positions", {
                    "ticker": best["ticker"], "event_title": best["title"],
                    "side": best["side"], "contracts": contracts,
                    "avg_price_cents": best["price_c"],
                    "entry_time": ts, "stage": stage, "updated_at": ts,
                }, "ticker")

                trade_result = {
                    "action": "BUY", "ticker": best["ticker"], "side": best["side"],
                    "contracts": contracts, "price_c": best["price_c"],
                    "total_dollars": round(total_cents / 100, 2),
                    "edge": round(best["edge"], 1), "kelly_f": kelly_f, "order_id": order_id,
                }
                print(f"✅ BUY {contracts}x {best['ticker']} @{best['price_c']}c ({best['side']}) = ${total_cents/100:.2f}")

                # SMS
                try:
                    requests.post(
                        f"{SUPABASE_URL}/functions/v1/trade-notification",
                        headers={"Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"},
                        json={"message": (f"🟢 KALSHI BUY: {best['ticker']} {contracts}x "
                                          f"@{best['price_c']}¢ | Edge:+{round(best['edge'],1)}% "
                                          f"| Bal:${bal_dollars:.2f}"),
                              "account": "kalshi"},
                        timeout=5,
                    )
                except Exception:
                    pass

            else:
                trade_result = {"action": "HOLD", "reason": f"Kelly→0 contracts (bet=${bet_dollars})"}
                print(f"HOLD: Kelly sizing → 0 contracts (bet=${bet_dollars})")
        else:
            trade_result = {"action": "HOLD", "reason": f"Already have {best['ticker']}"}
            print(f"HOLD: already in {best['ticker']}")

    # ── STEP 8: Update bot health ─────────────────────────────────────────────
    sb_upsert("trading_bot_health", {
        "bot_id": "kalshi", "last_run_at": ts, "last_success_at": ts,
        "consecutive_errors": 0, "current_balance": bal_dollars, "updated_at": ts,
    }, "bot_id")

    # ── FINAL LOG ─────────────────────────────────────────────────────────────
    print(f"""
=== KALSHI RUN {ts} ===
Balance: ${bal_dollars:.2f} | Stage: {stage} | Positions: {len(open_pos)}
Research: BTC=${btc['price']} RSI={btc['rsi']} | SPY=${spy['price']} RSI={spy['rsi']} | VIX={macro['vix']} 10Y={macro['tnx']}%
Opportunities: {len(opps)} | Best: {opps[0]['ticker'] + ' @' + str(opps[0]['price_c']) + 'c edge=+' + str(round(opps[0]['edge'],1)) + '%' if opps else 'none'}
Action: {trade_result['action']}  {trade_result}
Exits: {', '.join(exits) if exits else 'none'}
DB logged: {'SKIPPED (DRY RUN)' if DRY_RUN else 'YES'}
================================""")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        ts = datetime.now(timezone.utc).isoformat()
        print(f"FATAL: {e}")
        import traceback; traceback.print_exc()
        # Log error to DB
        try:
            requests.post(
                f"{SUPABASE_URL}/rest/v1/trading_bot_health",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates,return=minimal",
                },
                json={"bot_id": "kalshi", "last_run_at": ts, "consecutive_errors": 1,
                      "last_error": str(e)[:500], "updated_at": ts},
                timeout=5,
            )
        except Exception:
            pass
        sys.exit(1)
