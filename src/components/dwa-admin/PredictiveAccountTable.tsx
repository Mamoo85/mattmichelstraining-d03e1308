import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, TrendingDown, Minus, Sparkles, AlertTriangle, DollarSign } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

interface Row {
  account_key: string;
  company_name: string | null;
  vertical: string | null;
  location: string | null;
  score: number;
  tier: string | null;
  trajectory_delta_7d: number | null;
  trajectory_delta_14d: number | null;
  signal_count: number;
  category_count: number;
  is_surging: boolean | null;
  is_at_risk: boolean | null;
  is_budget_released: boolean | null;
}

interface History {
  computed_at: string;
  score: number;
}

interface Props {
  onSelectAccount?: (accountKey: string, companyName: string) => void;
}

type SortKey = "score" | "trajectory_delta_7d" | "trajectory_delta_14d";

export default function PredictiveAccountTable({ onSelectAccount }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [history, setHistory] = useState<Record<string, History[]>>({});
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("v_latest_intent_scores" as any)
      .select("account_key, company_name, vertical, location, score, tier, trajectory_delta_7d, trajectory_delta_14d, signal_count, category_count, is_surging, is_at_risk, is_budget_released")
      .order("score", { ascending: false })
      .limit(100);
    if (error) {
      console.error("[PredictiveAccountTable] load failed", error);
    }
    const list = ((data as any) || []) as Row[];
    setRows(list);

    // Batch-load 14d snapshot history for the visible top 30 (avoid N+1)
    const top = list.slice(0, 30).map((r) => r.account_key);
    if (top.length > 0) {
      const cutoff = new Date(Date.now() - 14 * 86400_000).toISOString();
      const { data: hist } = await supabase
        .from("intent_score_snapshots" as any)
        .select("account_key, computed_at, score")
        .in("account_key", top)
        .gte("computed_at", cutoff)
        .order("computed_at", { ascending: true });
      const grouped: Record<string, History[]> = {};
      for (const h of ((hist as any) || []) as { account_key: string; computed_at: string; score: number }[]) {
        if (!grouped[h.account_key]) grouped[h.account_key] = [];
        grouped[h.account_key].push({ computed_at: h.computed_at, score: Number(h.score) });
      }
      setHistory(grouped);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    let out = rows;
    if (tierFilter !== "all") out = out.filter((r) => r.tier === tierFilter);
    out = [...out].sort((a, b) => (Number(b[sortKey] ?? -999)) - (Number(a[sortKey] ?? -999)));
    return out;
  }, [rows, sortKey, tierFilter]);

  if (loading) {
    return <div className="flex items-center gap-2 text-white/50 p-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading predictive accounts…</div>;
  }
  if (rows.length === 0) {
    return <div className="text-white/40 text-sm p-6 text-center">No scored accounts yet. Trigger <code className="text-[#00d4ff]">intent-score-recompute</code> to populate.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-white/50">
          <span className="text-white font-bold">{filtered.length}</span> accounts · sorted by{" "}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-white/10 border border-white/10 rounded px-1 py-0.5 text-white text-xs"
          >
            <option value="score">Current score</option>
            <option value="trajectory_delta_7d">Δ 7-day</option>
            <option value="trajectory_delta_14d">Δ 14-day</option>
          </select>
        </div>
        <div className="flex gap-1">
          {["all", "blazing", "hot", "warm", "cool"].map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`text-[10px] px-2 py-1 rounded font-mono uppercase ${
                tierFilter === t ? "bg-[#00d4ff]/30 text-[#00d4ff] border border-[#00d4ff]/50" : "bg-white/5 text-white/50 border border-white/10"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="text-left p-2">Account</th>
              <th className="text-left p-2 hidden md:table-cell">Vertical</th>
              <th className="text-right p-2">Score</th>
              <th className="text-right p-2 hidden sm:table-cell">Δ 7d</th>
              <th className="text-right p-2 hidden md:table-cell">Δ 14d</th>
              <th className="text-center p-2 hidden lg:table-cell">14-day trend</th>
              <th className="text-left p-2 hidden md:table-cell">Flags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const hist = history[r.account_key] || [];
              const d7 = Number(r.trajectory_delta_7d ?? 0);
              const TrendIcon = d7 > 1 ? TrendingUp : d7 < -1 ? TrendingDown : Minus;
              const trendColor = d7 > 1 ? "text-emerald-400" : d7 < -1 ? "text-rose-400" : "text-white/40";
              return (
                <tr
                  key={r.account_key}
                  onClick={() => onSelectAccount?.(r.account_key, r.company_name || "Unknown")}
                  className="border-t border-white/5 hover:bg-[#00d4ff]/5 cursor-pointer transition-colors"
                >
                  <td className="p-2">
                    <div className="font-bold text-white truncate max-w-[180px]">{r.company_name || "Unknown"}</div>
                    <div className="text-[10px] text-white/40 truncate max-w-[180px]">{r.location || ""}</div>
                  </td>
                  <td className="p-2 hidden md:table-cell text-white/60 text-[11px]">{r.vertical || "—"}</td>
                  <td className="p-2 text-right">
                    <span className={`font-bold font-mono ${
                      r.score >= 80 ? "text-rose-300" : r.score >= 65 ? "text-amber-300" : r.score >= 50 ? "text-yellow-300" : "text-[#00d4ff]"
                    }`}>{Math.round(r.score)}</span>
                    <span className="text-[10px] text-white/40 ml-1">{r.tier}</span>
                  </td>
                  <td className={`p-2 text-right hidden sm:table-cell font-mono ${trendColor}`}>
                    <span className="inline-flex items-center gap-1"><TrendIcon className="w-3 h-3" />{d7 > 0 ? "+" : ""}{d7.toFixed(1)}</span>
                  </td>
                  <td className="p-2 text-right hidden md:table-cell font-mono text-white/60">
                    {r.trajectory_delta_14d != null ? `${Number(r.trajectory_delta_14d) > 0 ? "+" : ""}${Number(r.trajectory_delta_14d).toFixed(1)}` : "—"}
                  </td>
                  <td className="p-2 hidden lg:table-cell" style={{ width: 120 }}>
                    {hist.length >= 2 ? (
                      <div style={{ width: 100, height: 28 }}>
                        <ResponsiveContainer>
                          <LineChart data={hist}>
                            <YAxis hide domain={[0, 100]} />
                            <Line type="monotone" dataKey="score" stroke="#00d4ff" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <span className="text-white/30 text-[10px]">no history</span>}
                  </td>
                  <td className="p-2 hidden md:table-cell">
                    <div className="flex gap-1">
                      {r.is_surging && <span title="Surging" className="text-rose-300"><Sparkles className="w-3 h-3" /></span>}
                      {r.is_budget_released && <span title="Budget released" className="text-emerald-300"><DollarSign className="w-3 h-3" /></span>}
                      {r.is_at_risk && <span title="At risk" className="text-amber-300"><AlertTriangle className="w-3 h-3" /></span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
