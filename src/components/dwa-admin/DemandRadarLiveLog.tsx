import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Window = "1h" | "24h" | "7d";

interface RunRow {
  id: string;
  run_at: string;
  source: string;
  signals_found: number | null;
  signals_new: number | null;
  status: string | null;
  errors: string | null;
  duration_ms: number | null;
}

const windowToHours: Record<Window, number> = { "1h": 1, "24h": 24, "7d": 24 * 7 };

function statusOf(row: RunRow): "ok" | "empty" | "error" {
  if (row.status === "error" || (row.errors && row.errors.length > 0)) return "error";
  if ((row.signals_found ?? 0) === 0) return "empty";
  return "ok";
}

const statusStyles = {
  ok:    { dot: "bg-emerald-400", text: "text-emerald-300", border: "border-emerald-500/30", bg: "bg-emerald-500/5", icon: CheckCircle2 },
  empty: { dot: "bg-amber-400",   text: "text-amber-300",   border: "border-amber-500/30",   bg: "bg-amber-500/5",   icon: AlertTriangle },
  error: { dot: "bg-rose-400",    text: "text-rose-300",    border: "border-rose-500/30",    bg: "bg-rose-500/5",    icon: XCircle },
} as const;

export default function DemandRadarLiveLog() {
  const [rows, setRows] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowSel, setWindowSel] = useState<Window>("24h");
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "empty" | "error">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [running, setRunning] = useState<string | null>(null);

  const runScanner = async (fn: string) => {
    setRunning(fn);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: { trigger: "manual" } });
      if (error) alert(`${fn} error: ${error.message}`);
      else alert(`${fn} done: ${JSON.stringify(data).slice(0, 300)}`);
      await load();
    } finally {
      setRunning(null);
    }
  };

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - windowToHours[windowSel] * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("demand_radar_runs" as any)
      .select("id, run_at, source, signals_found, signals_new, status, errors, duration_ms")
      .gte("run_at", since)
      .order("run_at", { ascending: false })
      .limit(500);
    if (!error) setRows(((data as any) || []) as RunRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowSel]);

  const sources = Array.from(new Set(rows.map((r) => r.source))).sort();
  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && statusOf(r) !== statusFilter) return false;
    if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
    return true;
  });

  const counts = {
    ok: rows.filter((r) => statusOf(r) === "ok").length,
    empty: rows.filter((r) => statusOf(r) === "empty").length,
    error: rows.filter((r) => statusOf(r) === "error").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          Demand Radar Live Log
        </h3>
        <div className="flex gap-1 ml-auto">
          {(["1h", "24h", "7d"] as Window[]).map((w) => (
            <button
              key={w}
              onClick={() => setWindowSel(w)}
              className={`px-3 py-1 text-xs rounded font-semibold transition-colors ${
                windowSel === w ? "bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40" : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {w}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="bg-white/5 border-white/10">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        </Button>
      </div>

      {rows.length === 0 && !loading && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          ⚠️ No demand radar runs logged yet. Scanners need to be wired to insert into <code className="bg-black/30 px-1 rounded">demand_radar_runs</code>.
          The table now exists; next scanner runs will populate this feed.
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {(["ok", "empty", "error"] as const).map((s) => {
          const cfg = statusStyles[s];
          const Icon = cfg.icon;
          const isActive = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(isActive ? "all" : s)}
              className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${cfg.border} ${cfg.bg} ${
                isActive ? "ring-2 ring-[#00d4ff]/40" : ""
              }`}
            >
              <Icon className={`w-4 h-4 ${cfg.text}`} />
              <div className="text-left">
                <div className={`text-lg font-bold ${cfg.text}`}>{counts[s]}</div>
                <div className="text-[10px] uppercase tracking-wide text-white/40">
                  {s === "ok" ? "Found Signals" : s === "empty" ? "Empty Runs" : "Errors"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSourceFilter("all")}
            className={`px-2 py-1 text-[11px] rounded font-mono ${
              sourceFilter === "all" ? "bg-[#00d4ff]/20 text-[#00d4ff]" : "bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            all ({rows.length})
          </button>
          {sources.map((s) => {
            const c = rows.filter((r) => r.source === s).length;
            return (
              <button
                key={s}
                onClick={() => setSourceFilter(s === sourceFilter ? "all" : s)}
                className={`px-2 py-1 text-[11px] rounded font-mono ${
                  sourceFilter === s ? "bg-[#00d4ff]/20 text-[#00d4ff]" : "bg-white/5 text-white/50 hover:bg-white/10"
                }`}
              >
                {s} ({c})
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
        {filtered.map((r) => {
          const s = statusOf(r);
          const cfg = statusStyles[s];
          return (
            <div key={r.id} className={`flex items-start gap-3 px-3 py-2 rounded border ${cfg.border} ${cfg.bg} font-mono text-xs`}>
              <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot} mt-1.5 shrink-0`} />
              <div className="text-white/40 shrink-0 w-32">{new Date(r.run_at).toLocaleString()}</div>
              <div className="text-[#00d4ff] shrink-0 w-40 truncate">{r.source}</div>
              <div className="text-white/70 shrink-0 w-44">
                found <span className="text-white font-bold">{r.signals_found ?? 0}</span>
                {" · new "}
                <span className="text-white font-bold">{r.signals_new ?? 0}</span>
                {r.duration_ms != null && <> {" · "}<span className="text-white/40">{r.duration_ms}ms</span></>}
              </div>
              {r.errors && <div className={`${cfg.text} flex-1 break-all`}>{r.errors}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
