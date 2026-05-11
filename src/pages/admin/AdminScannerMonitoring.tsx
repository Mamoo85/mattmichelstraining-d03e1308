/**
 * /dwa-admin/scanner-monitoring — end-to-end scanner health.
 *
 * Reads `v_scanner_runs_unified` (framework + extras engines) and the
 * `scanner_alerts` table. All timestamps render in America/Detroit ET
 * so on-call decisions don't require timezone math.
 *
 * Columns: engine, product, source, status, failing step, error code,
 * rows returned, duration, ET timestamp, full error message.
 */
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Play, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Run = {
  engine: "framework" | "extras";
  id: string;
  source: string;
  product: string;
  segment: string;
  ok: boolean;
  rows: number;
  duration_ms: number;
  error: string | null;
  failing_step: string | null;
  error_code: string | null;
  ran_at: string;
};

type Alert = {
  id: string;
  product: string;
  source: string;
  severity: "warn" | "error" | "critical";
  reason: string;
  error_code: string | null;
  failing_step: string | null;
  first_seen_at: string;
  last_seen_at: string;
  occurrences: number;
  alerted_at: string | null;
  resolved_at: string | null;
};

const ET = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Detroit",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }) + " ET";

const sevTone: Record<string, string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/40",
  error: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  warn: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
};

export default function AdminScannerMonitoring() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [windowH, setWindowH] = useState<number>(6);
  const [statusFilter, setStatusFilter] = useState<"all" | "fail" | "ok">("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - windowH * 3600_000).toISOString();
    const [runsRes, alertsRes] = await Promise.all([
      supabase
        .from("v_scanner_runs_unified" as never)
        .select("*")
        .gte("ran_at", since)
        .order("ran_at", { ascending: false })
        .limit(1000),
      supabase
        .from("scanner_alerts" as never)
        .select("*")
        .is("resolved_at", null)
        .order("severity", { ascending: true })
        .order("last_seen_at", { ascending: false })
        .limit(100),
    ]);
    setRuns(((runsRes.data as Run[]) || []));
    setAlerts(((alertsRes.data as Alert[]) || []));
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowH]);

  const products = useMemo(
    () => Array.from(new Set(runs.map((r) => r.product))).sort(),
    [runs],
  );

  const filtered = useMemo(() => {
    return runs.filter((r) => {
      if (statusFilter === "fail" && r.ok) return false;
      if (statusFilter === "ok" && !r.ok) return false;
      if (productFilter !== "all" && r.product !== productFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.source.toLowerCase().includes(q) &&
          !(r.error_code ?? "").toLowerCase().includes(q) &&
          !(r.error ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [runs, statusFilter, productFilter, search]);

  const stats = useMemo(() => {
    const total = runs.length;
    const ok = runs.filter((r) => r.ok).length;
    const fail = total - ok;
    const sources = new Set(runs.map((r) => `${r.product}::${r.source}`)).size;
    return { total, ok, fail, sources, rate: total ? Math.round((fail / total) * 100) : 0 };
  }, [runs]);

  async function runMonitor() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("scanner-monitor-alert", { body: {} });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(
      `Sweep done: ${data?.runs_inspected ?? 0} runs · ${data?.issues_found ?? 0} issues · ${data?.new_alerts_opened ?? 0} new alerts · ${data?.sms_paged ?? 0} SMS · ${data?.auto_resolved ?? 0} resolved`,
    );
    load();
  }

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <Helmet>
        <title>Scanner Monitoring — DWA Admin</title>
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-[#00d4ff] text-xs font-extrabold tracking-[3px] mb-2">
          📡 ADMIN — SCANNER MONITORING
        </p>
        <h1 className="text-2xl font-bold mb-1">End-to-End Run Health</h1>
        <p className="text-[#94a3b8] text-sm mb-6">
          Unified feed across framework + extras engines. Failing step and error code are surfaced
          per run. Times in <span className="text-white font-mono">America/Detroit (ET)</span>.
          Monitor sweep runs every 15 min and pages Matt on new critical/error issues.
        </p>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Runs" value={stats.total} />
          <StatCard label="Sources" value={stats.sources} />
          <StatCard label="OK" value={stats.ok} tone="ok" />
          <StatCard label="Failed" value={stats.fail} tone={stats.fail > 0 ? "fail" : undefined} />
          <StatCard
            label="Fail rate"
            value={`${stats.rate}%`}
            tone={stats.rate > 25 ? "fail" : stats.rate > 10 ? "warn" : "ok"}
          />
        </div>

        {/* Open alerts */}
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Open Alerts ({alerts.length})
            </h2>
            <button
              onClick={runMonitor}
              disabled={busy}
              className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold px-3 py-1.5 rounded inline-flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Run sweep now
            </button>
          </div>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-300 text-sm">
              <CheckCircle2 className="w-4 h-4" /> No open alerts — every scanner is producing
              successful runs.
            </div>
          ) : (
            <div className="space-y-1">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`flex flex-wrap items-center gap-2 border rounded px-3 py-2 text-xs ${sevTone[a.severity]}`}
                >
                  <span className="font-bold uppercase">{a.severity}</span>
                  <span className="font-mono text-white/90">
                    {a.product} / {a.source}
                  </span>
                  <span className="text-white/60">step={a.failing_step ?? "—"}</span>
                  <span className="text-white/60">code={a.error_code ?? "—"}</span>
                  <span className="text-white/50">×{a.occurrences}</span>
                  <span className="text-white/50">{a.reason}</span>
                  <span className="ml-auto text-white/40">
                    first {ET(a.first_seen_at)} · last {ET(a.last_seen_at)}
                  </span>
                  {a.alerted_at && (
                    <span className="text-red-300">📱 SMS {ET(a.alerted_at)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select
            value={windowH}
            onChange={(e) => setWindowH(Number(e.target.value))}
            className="bg-slate-900 border border-white/10 text-white text-sm px-3 py-2 rounded"
          >
            <option value={1}>Last 1h</option>
            <option value={6}>Last 6h</option>
            <option value={24}>Last 24h</option>
            <option value={72}>Last 72h</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as never)}
            className="bg-slate-900 border border-white/10 text-white text-sm px-3 py-2 rounded"
          >
            <option value="all">All status</option>
            <option value="fail">Failed only</option>
            <option value="ok">OK only</option>
          </select>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="bg-slate-900 border border-white/10 text-white text-sm px-3 py-2 rounded"
          >
            <option value="all">All products</option>
            {products.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search source / code / error..."
            className="bg-slate-900 border border-white/10 text-white text-sm px-3 py-2 rounded flex-1 min-w-[200px]"
          />
          <button
            onClick={load}
            disabled={loading}
            className="bg-white/5 hover:bg-white/10 text-white/80 text-sm px-3 py-2 rounded inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Run feed */}
        <div className="overflow-x-auto rounded-xl border border-[#1e3a5f] bg-[#0a1628]">
          <table className="w-full text-sm">
            <thead className="bg-[#061021] text-white/60 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">When (ET)</th>
                <th className="text-left px-3 py-2">Engine</th>
                <th className="text-left px-3 py-2">Product</th>
                <th className="text-left px-3 py-2">Source</th>
                <th className="text-center px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Failing step</th>
                <th className="text-left px-3 py-2">Error code</th>
                <th className="text-right px-3 py-2">Rows</th>
                <th className="text-right px-3 py-2">ms</th>
                <th className="text-left px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-white/40">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-white/40">
                    No runs match the current filters in the selected window.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 400).map((r) => (
                  <tr key={`${r.engine}-${r.id}`} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 text-white/70 text-xs whitespace-nowrap">{ET(r.ran_at)}</td>
                    <td className="px-3 py-1.5 text-white/50 text-xs">{r.engine}</td>
                    <td className="px-3 py-1.5 text-white/80 text-xs">{r.product}</td>
                    <td className="px-3 py-1.5 font-mono text-cyan-300 text-xs">{r.source}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.ok
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {r.ok ? "OK" : "FAIL"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-white/70 text-xs">{r.failing_step ?? "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-amber-300 text-xs">
                      {r.error_code ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right text-white/80 text-xs">{r.rows}</td>
                    <td className="px-3 py-1.5 text-right text-white/50 text-xs">{r.duration_ms}</td>
                    <td className="px-3 py-1.5 text-white/60 text-xs max-w-[420px] truncate" title={r.error ?? ""}>
                      {r.error ?? ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-white/40 mt-3">
          Showing up to 400 most recent runs. Adjust the window or filters to narrow further.
          Auto-refresh every 60s.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "ok" | "warn" | "fail";
}) {
  const toneCls =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : tone === "fail"
          ? "border-red-500/30 bg-red-500/10 text-red-300"
          : "border-white/10 bg-white/[0.03] text-white/70";
  return (
    <div className={`rounded-lg border p-3 ${toneCls}`}>
      <div className="text-[10px] uppercase tracking-wider font-bold opacity-80">{label}</div>
      <div className="text-2xl font-black text-white mt-1">{value}</div>
    </div>
  );
}
