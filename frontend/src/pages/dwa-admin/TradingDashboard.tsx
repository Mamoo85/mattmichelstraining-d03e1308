// TradingDashboard.tsx — Autonomous trading bot monitor
// Route: /dwa-admin/trading
// Reads from secondary Supabase project (zmyczlfuufhngzovkjdh)
// Tables: trading_bot_health, robinhood_trades, robinhood_position_state,
//         kalshi_trades, kalshi_positions, alpaca_trades, alpaca_positions

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, Activity, RefreshCw, DollarSign, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

const tradingDb = createClient(
  "https://zmyczlfuufhngzovkjdh.supabase.co",
  "eyJ.REDACTED.JWT"
);

interface BotHealth {
  bot_name: string;
  last_run: string;
  status: string;
  notes: string;
}

interface Trade {
  id?: number;
  action: string;
  ticker?: string;
  underlying?: string;
  option_symbol?: string;
  market_title?: string;
  quantity?: number;
  contracts?: number;
  price?: number;
  premium_per_contract?: number;
  price_per_contract?: number;
  total_value?: number;
  total_cost?: number;
  pnl: number;
  pnl_pct: number;
  reason: string;
  score?: number;
  strike?: number;
  expiry?: string;
  is_paper?: boolean;
  created_at: string;
}

interface Position {
  ticker?: string;
  option_symbol?: string;
  underlying?: string;
  market_title?: string;
  side?: string;
  option_type?: string;
  strike?: number;
  expiry?: string;
  quantity?: number;
  contracts?: number;
  entry_price?: number;
  entry_premium?: number;
  current_price?: number;
  current_premium?: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  is_paper?: boolean;
  entry_time: string;
}

function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "Never";
  try {
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return d;
  }
}

function PnlBadge({ pnl, pct }: { pnl: number; pct: number }) {
  const pos = pnl >= 0;
  return (
    <span className={`font-mono text-sm font-semibold ${pos ? "text-green-400" : "text-red-400"}`}>
      {fmt$(pnl)} ({fmtPct(pct)})
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "ok" ? "bg-green-400" : status === "error" ? "bg-red-400" : "bg-yellow-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color} mr-2`} />;
}

function TradesTable({ trades, bot }: { trades: Trade[]; bot: string }) {
  if (!trades.length) return <p className="text-slate-400 text-sm py-4 text-center">No trades yet</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
            <th className="text-left py-2 pr-4">Time</th>
            <th className="text-left py-2 pr-4">Action</th>
            <th className="text-left py-2 pr-4">{bot === "kalshi" ? "Market" : bot === "alpaca" ? "Option" : "Ticker"}</th>
            <th className="text-right py-2 pr-4">Amount</th>
            <th className="text-right py-2 pr-4">P&L</th>
            <th className="text-left py-2">Reason</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const label = bot === "kalshi" ? t.market_title?.slice(0, 40) : bot === "alpaca" ? t.option_symbol : t.ticker;
            const amount = bot === "alpaca" ? t.total_cost : bot === "kalshi" ? t.total_cost : t.total_value;
            const isBuy = ["BUY", "YES", "NO"].includes(t.action?.toUpperCase());
            return (
              <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/40">
                <td className="py-2 pr-4 text-slate-400 whitespace-nowrap">{fmtDate(t.created_at)}</td>
                <td className="py-2 pr-4">
                  <Badge variant={isBuy ? "default" : "secondary"} className={`text-xs ${isBuy ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
                    {t.action}
                  </Badge>
                  {t.is_paper && <Badge variant="outline" className="ml-1 text-xs text-yellow-400 border-yellow-600">PAPER</Badge>}
                </td>
                <td className="py-2 pr-4 font-mono text-xs">{label || "—"}</td>
                <td className="py-2 pr-4 text-right font-mono">{fmt$(amount)}</td>
                <td className="py-2 pr-4 text-right">
                  {t.pnl != null ? <PnlBadge pnl={t.pnl} pct={t.pnl_pct} /> : <span className="text-slate-500">—</span>}
                </td>
                <td className="py-2 text-slate-400 text-xs max-w-[200px] truncate" title={t.reason}>{t.reason || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PositionsTable({ positions, bot }: { positions: Position[]; bot: string }) {
  if (!positions.length) return <p className="text-slate-400 text-sm py-4 text-center">No open positions</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
            <th className="text-left py-2 pr-4">Symbol</th>
            <th className="text-left py-2 pr-4">Side / Type</th>
            <th className="text-right py-2 pr-4">Entry</th>
            <th className="text-right py-2 pr-4">Current</th>
            <th className="text-right py-2">Unrealized P&L</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p, i) => {
            const label = bot === "kalshi" ? p.market_title?.slice(0, 40) : bot === "alpaca" ? p.option_symbol : p.ticker;
            const entry = p.entry_price ?? p.entry_premium;
            const current = p.current_price ?? p.current_premium;
            const side = p.side ?? p.option_type ?? "—";
            return (
              <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/40">
                <td className="py-2 pr-4 font-mono text-xs">{label}</td>
                <td className="py-2 pr-4">
                  <Badge variant="outline" className="text-xs border-blue-600 text-blue-300">{side}</Badge>
                  {p.is_paper && <Badge variant="outline" className="ml-1 text-xs text-yellow-400 border-yellow-600">PAPER</Badge>}
                </td>
                <td className="py-2 pr-4 text-right font-mono">{fmt$(entry)}</td>
                <td className="py-2 pr-4 text-right font-mono">{fmt$(current)}</td>
                <td className="py-2 text-right"><PnlBadge pnl={p.unrealized_pnl ?? 0} pct={p.unrealized_pnl_pct ?? 0} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function TradingDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<BotHealth[]>([]);
  const [rhTrades, setRhTrades] = useState<Trade[]>([]);
  const [rhPositions, setRhPositions] = useState<Position[]>([]);
  const [kalshiTrades, setKalshiTrades] = useState<Trade[]>([]);
  const [kalshiPositions, setKalshiPositions] = useState<Position[]>([]);
  const [alpacaTrades, setAlpacaTrades] = useState<Trade[]>([]);
  const [alpacaPositions, setAlpacaPositions] = useState<Position[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function load() {
    setLoading(true);
    try {
      const [
        { data: healthData },
        { data: rht }, { data: rhp },
        { data: kt }, { data: kp },
        { data: at }, { data: ap },
      ] = await Promise.all([
        tradingDb.from("trading_bot_health").select("*").order("last_run", { ascending: false }),
        tradingDb.from("robinhood_trades").select("*").order("created_at", { ascending: false }).limit(50),
        tradingDb.from("robinhood_position_state").select("*"),
        tradingDb.from("kalshi_trades").select("*").order("created_at", { ascending: false }).limit(50),
        tradingDb.from("kalshi_positions").select("*"),
        tradingDb.from("alpaca_trades").select("*").order("created_at", { ascending: false }).limit(50),
        tradingDb.from("alpaca_positions").select("*"),
      ]);
      setHealth(healthData ?? []);
      setRhTrades(rht ?? []);
      setRhPositions(rhp ?? []);
      setKalshiTrades(kt ?? []);
      setKalshiPositions(kp ?? []);
      setAlpacaTrades(at ?? []);
      setAlpacaPositions(ap ?? []);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Aggregate P&L
  const totalPnl = [
    ...rhTrades, ...kalshiTrades, ...alpacaTrades,
  ].reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  const totalUnrealized = [
    ...rhPositions, ...kalshiPositions, ...alpacaPositions,
  ].reduce((sum, p) => sum + (p.unrealized_pnl ?? 0), 0);

  const totalTrades = rhTrades.length + kalshiTrades.length + alpacaTrades.length;
  const wins = [...rhTrades, ...kalshiTrades, ...alpacaTrades].filter(t => (t.pnl ?? 0) > 0).length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

  const getHealth = (name: string) => health.find(h => h.bot_name === name);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dwa-admin")} className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Trading Dashboard</h1>
              <p className="text-slate-400 text-sm">Autonomous bots — Robinhood · Kalshi · Alpaca</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-xs">Last refresh: {lastRefresh.toLocaleTimeString()}</span>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="border-slate-700 text-slate-300">
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Realized P&L</p>
              <p className={`text-2xl font-bold font-mono ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt$(totalPnl)}</p>
              <p className="text-slate-500 text-xs mt-1">All closed trades</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Unrealized P&L</p>
              <p className={`text-2xl font-bold font-mono ${totalUnrealized >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt$(totalUnrealized)}</p>
              <p className="text-slate-500 text-xs mt-1">Open positions</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Trades</p>
              <p className="text-2xl font-bold font-mono text-white">{totalTrades}</p>
              <p className="text-slate-500 text-xs mt-1">Across all bots</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Win Rate</p>
              <p className={`text-2xl font-bold font-mono ${winRate >= 50 ? "text-green-400" : "text-yellow-400"}`}>{winRate}%</p>
              <p className="text-slate-500 text-xs mt-1">{wins} wins / {totalTrades} trades</p>
            </CardContent>
          </Card>
        </div>

        {/* Bot Health */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Bot Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["robinhood_trader", "kalshi_trader", "alpaca_options"].map(name => {
                const h = getHealth(name);
                const label = name === "robinhood_trader" ? "Robinhood" : name === "kalshi_trader" ? "Kalshi" : "Alpaca";
                return (
                  <div key={name} className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{label}</span>
                      {h ? (
                        <span className="flex items-center text-xs text-slate-300">
                          <StatusDot status={h.status} />
                          {h.status}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">No data</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs">Last run: {fmtDate(h?.last_run)}</p>
                    {h?.notes && <p className="text-slate-500 text-xs mt-1 truncate" title={h.notes}>{h.notes}</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Bot Tabs */}
        <Tabs defaultValue="robinhood">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="robinhood" className="data-[state=active]:bg-slate-700">
              🤖 Robinhood
              {rhPositions.length > 0 && <Badge className="ml-1 bg-green-700 text-xs">{rhPositions.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="kalshi" className="data-[state=active]:bg-slate-700">
              🎯 Kalshi
              {kalshiPositions.length > 0 && <Badge className="ml-1 bg-blue-700 text-xs">{kalshiPositions.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="alpaca" className="data-[state=active]:bg-slate-700">
              📈 Alpaca
              {alpacaPositions.length > 0 && <Badge className="ml-1 bg-purple-700 text-xs">{alpacaPositions.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Robinhood Tab */}
          <TabsContent value="robinhood" className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Realized P&L", value: fmt$(rhTrades.reduce((s, t) => s + (t.pnl ?? 0), 0)), color: "text-green-400" },
                { label: "Open Positions", value: String(rhPositions.length), color: "text-white" },
                { label: "Total Trades", value: String(rhTrades.length), color: "text-white" },
              ].map(c => (
                <Card key={c.label} className="bg-slate-900 border-slate-700">
                  <CardContent className="pt-3 pb-3">
                    <p className="text-slate-400 text-xs">{c.label}</p>
                    <p className={`text-xl font-bold font-mono ${c.color}`}>{c.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {rhPositions.length > 0 && (
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Open Positions</CardTitle></CardHeader>
                <CardContent><PositionsTable positions={rhPositions} bot="robinhood" /></CardContent>
              </Card>
            )}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Trade History (last 50)</CardTitle></CardHeader>
              <CardContent><TradesTable trades={rhTrades} bot="robinhood" /></CardContent>
            </Card>
          </TabsContent>

          {/* Kalshi Tab */}
          <TabsContent value="kalshi" className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Realized P&L", value: fmt$(kalshiTrades.reduce((s, t) => s + (t.pnl ?? 0), 0)), color: "text-green-400" },
                { label: "Open Positions", value: String(kalshiPositions.length), color: "text-white" },
                { label: "Total Trades", value: String(kalshiTrades.length), color: "text-white" },
              ].map(c => (
                <Card key={c.label} className="bg-slate-900 border-slate-700">
                  <CardContent className="pt-3 pb-3">
                    <p className="text-slate-400 text-xs">{c.label}</p>
                    <p className={`text-xl font-bold font-mono ${c.color}`}>{c.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {kalshiPositions.length > 0 && (
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Open Positions</CardTitle></CardHeader>
                <CardContent><PositionsTable positions={kalshiPositions} bot="kalshi" /></CardContent>
              </Card>
            )}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Trade History (last 50)</CardTitle></CardHeader>
              <CardContent><TradesTable trades={kalshiTrades} bot="kalshi" /></CardContent>
            </Card>
          </TabsContent>

          {/* Alpaca Tab */}
          <TabsContent value="alpaca" className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Realized P&L", value: fmt$(alpacaTrades.reduce((s, t) => s + (t.pnl ?? 0), 0)), color: "text-green-400" },
                { label: "Open Positions", value: String(alpacaPositions.length), color: "text-white" },
                { label: "Total Trades", value: String(alpacaTrades.length), color: "text-white" },
              ].map(c => (
                <Card key={c.label} className="bg-slate-900 border-slate-700">
                  <CardContent className="pt-3 pb-3">
                    <p className="text-slate-400 text-xs">{c.label}</p>
                    <p className={`text-xl font-bold font-mono ${c.color}`}>{c.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="bg-slate-800/50 border-yellow-700/40">
              <CardContent className="pt-3 pb-3">
                <p className="text-yellow-400 text-xs font-semibold">⚠ Paper Trading Mode</p>
                <p className="text-slate-400 text-xs mt-1">All Alpaca positions are paper trades ($100k simulated capital). No real money at risk until account is verified for live trading.</p>
              </CardContent>
            </Card>
            {alpacaPositions.length > 0 && (
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Open Option Positions</CardTitle></CardHeader>
                <CardContent><PositionsTable positions={alpacaPositions} bot="alpaca" /></CardContent>
              </Card>
            )}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Trade History (last 50)</CardTitle></CardHeader>
              <CardContent><TradesTable trades={alpacaTrades} bot="alpaca" /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick links */}
        <div className="text-center text-xs text-slate-600 space-x-4">
          <a href="https://claude.ai/code/routines" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 underline">Bot Routines</a>
          <span>·</span>
          <a href="https://robinhood.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 underline">Robinhood</a>
          <span>·</span>
          <a href="https://kalshi.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 underline">Kalshi</a>
          <span>·</span>
          <a href="https://app.alpaca.markets" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 underline">Alpaca</a>
        </div>
      </div>
    </div>
  );
}
