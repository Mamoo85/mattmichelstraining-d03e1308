import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { supabaseSecondary } from "@/integrations/supabase/secondary";

// ===== Types =====
type Scoreboard = {
  bot_name: string;
  date: string;
  pnl_usd: number;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number | null;
  sharpe_30d: number | null;
  max_drawdown_pct: number | null;
  capital_usd: number | null;
};

type KalshiPosition = {
  id: string; market_ticker: string; side: string; qty: number;
  avg_price_cents: number; opened_at: string; closed_at: string | null;
  realized_pnl_cents: number | null; is_paper: boolean;
};
type KalshiOrder = {
  id: string; market_ticker: string; side: string; action: string;
  qty: number; filled_qty: number; limit_price_cents: number;
  avg_fill_price_cents: number | null; status: string; is_paper: boolean; created_at: string;
};
type PnlPoint = { date: string; realized_cents: number; unrealized_cents: number };

// Robinhood (secondary project)
type RhTrade = {
  id: string | number; symbol: string; side: string; qty: number;
  price: number | null; pnl: number | null; status: string | null; created_at: string;
};
type RhPosition = {
  symbol: string; qty: number; avg_cost: number | null;
  market_value: number | null; unrealized_pnl: number | null; updated_at: string | null;
};

// Alpaca (secondary project)
type AlpacaTrade = {
  id: string | number; symbol: string; side: string; qty: number;
  price: number | null; pnl: number | null; status: string | null; created_at: string;
  contract_type?: string | null; strike?: number | null; expiry?: string | null;
};
type AlpacaPosition = {
  symbol: string; qty: number; avg_entry_price: number | null;
  market_value: number | null; unrealized_pl: number | null; updated_at: string | null;
};

// ===== Meta =====
const BOTS = ["robinhood", "kalshi", "alpaca"] as const;
type Bot = (typeof BOTS)[number];

const BOT_META: Record<Bot, { label: string; emoji: string; tagline: string; accent: string; source: string }> = {
  robinhood: { label: "Robinhood", emoji: "📈", tagline: "Stock challenge",    accent: "#10b981", source: "Secondary DB" },
  kalshi:    { label: "Kalshi",    emoji: "🎯", tagline: "Prediction markets", accent: "#00d4ff", source: "Lovable Cloud" },
  alpaca:    { label: "Alpaca",    emoji: "🦙", tagline: "Paper options",      accent: "#f59e0b", source: "Secondary DB" },
};

// ===== Helpers =====
const fmtUSD = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—";
const fmtPct = (n: number | null | undefined) =>
  typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—";

export default function TradingDashboard() {
  // primary
  const [scoreboard, setScoreboard] = useState<Scoreboard[]>([]);
  const [positions, setPositions] = useState<KalshiPosition[]>([]);
  const [orders, setOrders] = useState<KalshiOrder[]>([]);
  const [pnlSeries, setPnlSeries] = useState<PnlPoint[]>([]);
  // secondary
  const [rhTrades, setRhTrades] = useState<RhTrade[]>([]);
  const [rhPositions, setRhPositions] = useState<RhPosition[]>([]);
  const [alpacaTrades, setAlpacaTrades] = useState<AlpacaTrade[]>([]);
  const [alpacaPositions, setAlpacaPositions] = useState<AlpacaPosition[]>([]);
  // ui
  const [tab, setTab] = useState<Bot>("kalshi");
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  async function load() {
    setLoading(true);
    const errs: Record<string, string | null> = {};

    // Primary (Kalshi + scoreboard) — parallel
    const primaryP = Promise.all([
      supabase.from("bot_scoreboard").select("*").order("date", { ascending: false }).limit(90),
      supabase.from("kalshi_positions").select("*").order("opened_at", { ascending: false }).limit(50),
      supabase.from("kalshi_orders").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("kalshi_pnl_daily").select("date,realized_cents,unrealized_cents").order("date", { ascending: true }).limit(120),
    ]).then(([sb, pos, ord, pnl]) => {
      if (sb.error) errs.primary = sb.error.message;
      setScoreboard((sb.data ?? []) as Scoreboard[]);
      setPositions((pos.data ?? []) as KalshiPosition[]);
      setOrders((ord.data ?? []) as KalshiOrder[]);
      const map = new Map<string, PnlPoint>();
      for (const r of (pnl.data ?? []) as PnlPoint[]) {
        const ex = map.get(r.date) ?? { date: r.date, realized_cents: 0, unrealized_cents: 0 };
        ex.realized_cents += r.realized_cents ?? 0;
        ex.unrealized_cents += r.unrealized_cents ?? 0;
        map.set(r.date, ex);
      }
      setPnlSeries(Array.from(map.values()));
    }).catch((e) => { errs.primary = e?.message ?? String(e); });

    // Secondary (Robinhood + Alpaca) — parallel, fail-soft per table
    const secondaryP = Promise.all([
      supabaseSecondary.from("robinhood_trades").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseSecondary.from("robinhood_position_state").select("*").limit(50),
      supabaseSecondary.from("alpaca_trades").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseSecondary.from("alpaca_positions").select("*").limit(50),
    ]).then(([rt, rp, at, ap]) => {
      if (rt.error) errs.robinhood = rt.error.message;
      else setRhTrades((rt.data ?? []) as RhTrade[]);
      if (rp.error) errs.robinhood = errs.robinhood ?? rp.error.message;
      else setRhPositions((rp.data ?? []) as RhPosition[]);
      if (at.error) errs.alpaca = at.error.message;
      else setAlpacaTrades((at.data ?? []) as AlpacaTrade[]);
      if (ap.error) errs.alpaca = errs.alpaca ?? ap.error.message;
      else setAlpacaPositions((ap.data ?? []) as AlpacaPosition[]);
    }).catch((e) => { errs.secondary = e?.message ?? String(e); });

    await Promise.all([primaryP, secondaryP]);
    setErrors(errs);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  // Latest scoreboard row per bot (best-effort: scoreboard table is on primary)
  const latestByBot = new Map<string, Scoreboard>();
  for (const row of scoreboard) if (!latestByBot.has(row.bot_name)) latestByBot.set(row.bot_name, row);

  // Synthetic scoreboard for Robinhood/Alpaca from trades if no row in bot_scoreboard
  const synth = (trades: { pnl: number | null; status: string | null }[]): Partial<Scoreboard> => {
    const closed = trades.filter((t) => typeof t.pnl === "number");
    const pnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length;
    const losses = closed.filter((t) => (t.pnl ?? 0) < 0).length;
    return {
      pnl_usd: pnl,
      trades: trades.length,
      wins,
      losses,
      win_rate: closed.length ? wins / closed.length : null,
    };
  };

  const cardRow = (bot: Bot): Partial<Scoreboard> => {
    const row = latestByBot.get(bot);
    if (row) return row;
    if (bot === "robinhood") return synth(rhTrades);
    if (bot === "alpaca") return synth(alpacaTrades);
    return {};
  };

  // Cumulative kalshi P&L
  const cumulative: { date: string; total: number }[] = [];
  let running = 0;
  for (const p of pnlSeries) {
    running += (p.realized_cents + p.unrealized_cents) / 100;
    cumulative.push({ date: p.date, total: running });
  }
  const maxAbs = Math.max(1, ...cumulative.map((c) => Math.abs(c.total)));

  const hasAnyError = Object.values(errors).some(Boolean);

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link to="/dwa-admin" className="text-xs text-white/40 hover:text-[#00d4ff]">← DWA Admin</Link>
            <h1 className="text-2xl font-black tracking-tight mt-1">
              📊 Trading <span className="text-[#00d4ff]">Bot Arena</span>
            </h1>
            <p className="text-sm text-white/50">Live P&L across Robinhood (secondary DB), Kalshi (primary), Alpaca (secondary)</p>
          </div>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded bg-[#00d4ff]/15 text-[#00d4ff] text-xs font-semibold hover:bg-[#00d4ff]/25 border border-[#00d4ff]/30"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {hasAnyError && (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1">
            <div className="font-semibold">Some data sources errored (other tabs still work):</div>
            {Object.entries(errors).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>• <span className="uppercase font-mono text-[10px]">{k}</span>: {v}</div>
            ))}
          </div>
        )}

        {/* Bot scoreboard cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BOTS.map((bot) => {
            const meta = BOT_META[bot];
            const row = cardRow(bot);
            const has = row.pnl_usd !== undefined && row.pnl_usd !== null;
            const positive = (row.pnl_usd ?? 0) >= 0;
            const isActive = tab === bot;
            return (
              <button
                key={bot}
                onClick={() => setTab(bot)}
                className={`text-left rounded-lg border p-4 transition ${
                  isActive ? "border-[#00d4ff] bg-white/[0.06]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-lg font-bold flex items-center gap-2">
                      <span>{meta.emoji}</span><span>{meta.label}</span>
                    </div>
                    <div className="text-[11px] text-white/40">{meta.tagline} · {meta.source}</div>
                  </div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-semibold"
                    style={{ background: `${meta.accent}22`, color: meta.accent, border: `1px solid ${meta.accent}55` }}
                  >
                    {has ? "LIVE" : "NO DATA"}
                  </span>
                </div>
                <div className={`text-3xl font-black ${positive ? "text-emerald-400" : "text-red-400"}`}>
                  {has ? `${positive ? "+" : ""}${fmtUSD(row.pnl_usd ?? 0)}` : "—"}
                </div>
                <div className="text-[11px] text-white/40 mb-3">{latestByBot.get(bot) ? `Daily · ${latestByBot.get(bot)?.date}` : "Aggregated from trades"}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Trades" value={row.trades?.toString() ?? "—"} />
                  <Stat label="Win rate" value={fmtPct(row.win_rate ?? null)} />
                  <Stat label="Wins" value={row.wins?.toString() ?? "—"} />
                  <Stat label="Losses" value={row.losses?.toString() ?? "—"} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === "kalshi" && (
          <KalshiTab
            cumulative={cumulative}
            maxAbs={maxAbs}
            positions={positions}
            orders={orders}
          />
        )}
        {tab === "robinhood" && (
          <RobinhoodTab trades={rhTrades} positions={rhPositions} />
        )}
        {tab === "alpaca" && (
          <AlpacaTab trades={alpacaTrades} positions={alpacaPositions} />
        )}

        <p className="text-[11px] text-white/30 text-center pt-2">
          Auto-refreshes every 30s · Kalshi = Lovable Cloud · Robinhood/Alpaca = secondary project ({"zmyczlfuufhngzovkjdh".slice(0, 8)}…)
        </p>
      </div>
    </div>
  );
}

// ============ TABS ============
function KalshiTab({
  cumulative, maxAbs, positions, orders,
}: {
  cumulative: { date: string; total: number }[];
  maxAbs: number;
  positions: KalshiPosition[];
  orders: KalshiOrder[];
}) {
  return (
    <>
      <Panel title="📈 Kalshi Cumulative P&L (last 120 days)">
        {cumulative.length === 0 ? (
          <Empty msg="No daily P&L recorded yet — bot still in paper mode or no trades closed." />
        ) : (
          <div className="h-48 flex items-end gap-0.5">
            {cumulative.map((p, i) => {
              const h = (Math.abs(p.total) / maxAbs) * 100;
              const positive = p.total >= 0;
              return (
                <div
                  key={i}
                  title={`${p.date}: ${fmtUSD(p.total)}`}
                  className={`flex-1 min-w-[2px] rounded-t ${positive ? "bg-emerald-400/60" : "bg-red-400/60"}`}
                  style={{ height: `${Math.max(2, h)}%` }}
                />
              );
            })}
          </div>
        )}
        <div className="text-[11px] text-white/40 mt-2 flex justify-between">
          <span>{cumulative[0]?.date ?? "—"}</span>
          <span>Latest: {fmtUSD(cumulative[cumulative.length - 1]?.total ?? 0)}</span>
          <span>{cumulative[cumulative.length - 1]?.date ?? "—"}</span>
        </div>
      </Panel>

      <Panel title="🎯 Kalshi Open Positions">
        {positions.filter((p) => !p.closed_at).length === 0 ? (
          <Empty msg="No open positions." />
        ) : (
          <Table
            cols={["Market", "Side", "Qty", "Avg", "Opened", "Mode"]}
            rows={positions.filter((p) => !p.closed_at).map((p) => [
              p.market_ticker,
              <span className={p.side === "yes" ? "text-emerald-400" : "text-red-400"}>{p.side.toUpperCase()}</span>,
              p.qty,
              `${p.avg_price_cents}¢`,
              new Date(p.opened_at).toLocaleString(),
              <Badge tone={p.is_paper ? "muted" : "live"}>{p.is_paper ? "PAPER" : "LIVE"}</Badge>,
            ])}
          />
        )}
      </Panel>

      <Panel title="📜 Recent Kalshi Orders">
        {orders.length === 0 ? (
          <Empty msg="No orders yet." />
        ) : (
          <Table
            cols={["When", "Market", "Action", "Side", "Qty", "Limit", "Filled", "Status", "Mode"]}
            rows={orders.map((o) => [
              new Date(o.created_at).toLocaleTimeString(),
              o.market_ticker,
              o.action.toUpperCase(),
              <span className={o.side === "yes" ? "text-emerald-400" : "text-red-400"}>{o.side.toUpperCase()}</span>,
              o.qty,
              `${o.limit_price_cents}¢`,
              o.filled_qty ? `${o.filled_qty} @ ${o.avg_fill_price_cents ?? "?"}¢` : "—",
              <Badge tone={o.status === "filled" ? "live" : o.status === "rejected" ? "danger" : "muted"}>{o.status}</Badge>,
              <Badge tone={o.is_paper ? "muted" : "live"}>{o.is_paper ? "PAPER" : "LIVE"}</Badge>,
            ])}
          />
        )}
      </Panel>
    </>
  );
}

function RobinhoodTab({ trades, positions }: { trades: RhTrade[]; positions: RhPosition[] }) {
  return (
    <>
      <Panel title="📈 Robinhood Open Positions">
        {positions.length === 0 ? (
          <Empty msg="No open positions — bot hasn't entered any trades yet, or table is empty." />
        ) : (
          <Table
            cols={["Symbol", "Qty", "Avg Cost", "Market Value", "Unrealized P&L", "Updated"]}
            rows={positions.map((p) => [
              <span className="font-mono font-bold">{p.symbol}</span>,
              p.qty,
              fmtUSD(p.avg_cost),
              fmtUSD(p.market_value),
              <span className={(p.unrealized_pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>
                {fmtUSD(p.unrealized_pnl)}
              </span>,
              p.updated_at ? new Date(p.updated_at).toLocaleString() : "—",
            ])}
          />
        )}
      </Panel>

      <Panel title="📜 Recent Robinhood Trades">
        {trades.length === 0 ? (
          <Empty msg="No trades yet." />
        ) : (
          <Table
            cols={["When", "Symbol", "Side", "Qty", "Price", "P&L", "Status"]}
            rows={trades.map((t) => [
              new Date(t.created_at).toLocaleString(),
              <span className="font-mono font-bold">{t.symbol}</span>,
              <span className={t.side?.toLowerCase() === "buy" ? "text-emerald-400" : "text-red-400"}>
                {(t.side ?? "").toUpperCase()}
              </span>,
              t.qty,
              fmtUSD(t.price),
              <span className={(t.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtUSD(t.pnl)}</span>,
              <Badge tone={t.status === "filled" ? "live" : t.status === "rejected" ? "danger" : "muted"}>
                {t.status ?? "—"}
              </Badge>,
            ])}
          />
        )}
      </Panel>
    </>
  );
}

function AlpacaTab({ trades, positions }: { trades: AlpacaTrade[]; positions: AlpacaPosition[] }) {
  return (
    <>
      <Panel title="🦙 Alpaca Open Positions (paper options)">
        {positions.length === 0 ? (
          <Empty msg="No open positions." />
        ) : (
          <Table
            cols={["Symbol", "Qty", "Avg Entry", "Market Value", "Unrealized P&L", "Updated"]}
            rows={positions.map((p) => [
              <span className="font-mono font-bold">{p.symbol}</span>,
              p.qty,
              fmtUSD(p.avg_entry_price),
              fmtUSD(p.market_value),
              <span className={(p.unrealized_pl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>
                {fmtUSD(p.unrealized_pl)}
              </span>,
              p.updated_at ? new Date(p.updated_at).toLocaleString() : "—",
            ])}
          />
        )}
      </Panel>

      <Panel title="📜 Recent Alpaca Trades">
        {trades.length === 0 ? (
          <Empty msg="No trades yet." />
        ) : (
          <Table
            cols={["When", "Symbol", "Side", "Qty", "Price", "P&L", "Contract", "Status"]}
            rows={trades.map((t) => [
              new Date(t.created_at).toLocaleString(),
              <span className="font-mono font-bold">{t.symbol}</span>,
              <span className={t.side?.toLowerCase() === "buy" ? "text-emerald-400" : "text-red-400"}>
                {(t.side ?? "").toUpperCase()}
              </span>,
              t.qty,
              fmtUSD(t.price),
              <span className={(t.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtUSD(t.pnl)}</span>,
              t.contract_type
                ? `${t.contract_type.toUpperCase()} ${t.strike ?? ""} ${t.expiry ?? ""}`
                : "—",
              <Badge tone={t.status === "filled" ? "live" : t.status === "rejected" ? "danger" : "muted"}>
                {t.status ?? "—"}
              </Badge>,
            ])}
          />
        )}
      </Panel>
    </>
  );
}

// ============ UI primitives ============
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-white/5 px-2 py-1.5">
      <div className="text-[10px] text-white/40 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h2 className="text-sm font-bold mb-3 text-white/90">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-sm text-white/40 italic py-6 text-center">{msg}</div>;
}

function Badge({ tone, children }: { tone: "live" | "muted" | "danger"; children: React.ReactNode }) {
  const styles =
    tone === "live"
      ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/40"
      : tone === "danger"
      ? "bg-red-400/15 text-red-300 border-red-400/40"
      : "bg-white/5 text-white/50 border-white/10";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${styles}`}>{children}</span>;
}

function Table({ cols, rows }: { cols: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-white/40 border-b border-white/10">
            {cols.map((c) => (
              <th key={c} className="py-2 px-2 font-semibold uppercase tracking-wider text-[10px]">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
              {r.map((cell, j) => (
                <td key={j} className="py-2 px-2 text-white/80">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


