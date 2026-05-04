import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, CheckCircle2, DollarSign, Filter, Loader2, RefreshCw, X, XCircle } from "lucide-react";

interface AuditRow {
  id: string;
  lead_id: string;
  vertical: string;
  function_name: string;
  stage: string;
  provider: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  success: boolean;
  http_status: number | null;
  error_code: string | null;
  error_message: string | null;
  fields_added: string[] | null;
  cost_cents: number | null;
  triggered_by: string | null;
  created_at: string;
}

const VERTICALS = ["all", "mortgage", "talent", "demand", "supply", "growth", "contractor", "prospect", "visitor", "other"];

export default function AdminEnrichmentAudit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [vertical, setVertical] = useState<string>("all");
  const [successFilter, setSuccessFilter] = useState<"all" | "success" | "failure">("all");
  const [hours, setHours] = useState<number>(24);
  const [drillLead, setDrillLead] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      let q = (supabase as any)
        .from("lead_enrichment_audit")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (vertical !== "all") q = q.eq("vertical", vertical);
      if (successFilter === "success") q = q.eq("success", true);
      if (successFilter === "failure") q = q.eq("success", false);
      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error("[AdminEnrichmentAudit] load", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [vertical, successFilter, hours]);

  const stats = useMemo(() => {
    const total = rows.length;
    const ok = rows.filter((r) => r.success).length;
    const fails = total - ok;
    const totalCost = rows.reduce((s, r) => s + (r.cost_cents || 0), 0);
    const avgDur = total ? Math.round(rows.reduce((s, r) => s + (r.duration_ms || 0), 0) / total) : 0;
    const byProvider: Record<string, { total: number; fail: number }> = {};
    rows.forEach((r) => {
      const p = r.provider || "unknown";
      byProvider[p] ||= { total: 0, fail: 0 };
      byProvider[p].total++;
      if (!r.success) byProvider[p].fail++;
    });
    return { total, ok, fails, totalCost, avgDur, byProvider };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#00d4ff]" /> Enrichment Audit Log
          </h2>
          <p className="text-xs text-white/50">Per-lead provider call trace. Last {hours}h, max 500 rows.</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center text-xs">
        <Filter className="w-3.5 h-3.5 text-white/40" />
        <select
          value={vertical}
          onChange={(e) => setVertical(e.target.value)}
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white"
        >
          {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select
          value={successFilter}
          onChange={(e) => setSuccessFilter(e.target.value as any)}
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white"
        >
          <option value="all">all results</option>
          <option value="success">success only</option>
          <option value="failure">failures only</option>
        </select>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white"
        >
          <option value={1}>last 1h</option>
          <option value={24}>last 24h</option>
          <option value={168}>last 7d</option>
          <option value={720}>last 30d</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Total calls" value={stats.total.toLocaleString()} />
        <Stat label="Succeeded" value={stats.ok.toLocaleString()} color="#10b981" />
        <Stat label="Failed" value={stats.fails.toLocaleString()} color={stats.fails > 0 ? "#ef4444" : "#64748b"} />
        <Stat label="Avg latency" value={`${stats.avgDur}ms`} />
        <Stat label="Cost" value={`$${(stats.totalCost / 100).toFixed(2)}`} />
      </div>

      {/* Provider failure breakdown */}
      {Object.keys(stats.byProvider).length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs font-bold text-white/70 mb-2">Provider failure rate</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byProvider).map(([prov, s]) => {
              const failRate = s.total ? Math.round((s.fail / s.total) * 100) : 0;
              const color = failRate >= 30 ? "#ef4444" : failRate >= 10 ? "#f59e0b" : "#10b981";
              return (
                <div
                  key={prov}
                  className="flex items-center gap-2 px-2 py-1 rounded text-[11px] border"
                  style={{ borderColor: `${color}40`, background: `${color}10` }}
                >
                  <span className="font-mono">{prov}</span>
                  <span className="text-white/50">·</span>
                  <span style={{ color }}>{s.fail}/{s.total} fail ({failRate}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-white/60">
              <tr>
                <th className="text-left p-2 font-mono">when</th>
                <th className="text-left p-2 font-mono">vertical</th>
                <th className="text-left p-2 font-mono">function · stage</th>
                <th className="text-left p-2 font-mono">provider</th>
                <th className="text-left p-2 font-mono">lead</th>
                <th className="text-right p-2 font-mono">ms</th>
                <th className="text-center p-2 font-mono">status</th>
                <th className="text-left p-2 font-mono">error</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="p-6 text-center text-white/40"><Loader2 className="w-4 h-4 inline animate-spin" /> Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-white/40">No audit rows in this window.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02] cursor-pointer" onClick={() => setDrillLead(r.lead_id)}>
                  <td className="p-2 font-mono text-white/60 whitespace-nowrap">{new Date(r.created_at).toLocaleTimeString()}</td>
                  <td className="p-2"><span className="px-1.5 py-0.5 rounded bg-white/5 font-mono">{r.vertical}</span></td>
                  <td className="p-2 font-mono">
                    <div className="text-white/90">{r.function_name}</div>
                    <div className="text-white/40 text-[10px]">{r.stage}</div>
                  </td>
                  <td className="p-2 font-mono text-white/80">{r.provider}</td>
                  <td className="p-2 font-mono text-[#00d4ff] hover:underline">{r.lead_id?.slice(0, 8)}…</td>
                  <td className="p-2 text-right font-mono text-white/60">{r.duration_ms}</td>
                  <td className="p-2 text-center">
                    {r.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 inline" />
                    )}
                    {r.http_status && <div className="text-[10px] text-white/40 font-mono">{r.http_status}</div>}
                  </td>
                  <td className="p-2 text-rose-300 max-w-xs truncate" title={r.error_message || ""}>
                    {r.error_message || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {stats.fails > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded p-2">
          <AlertTriangle className="w-4 h-4" />
          {stats.fails} failures in this window — drill into providers above to identify root cause.
        </div>
      )}

      {drillLead && <LeadWaterfallModal leadId={drillLead} onClose={() => setDrillLead(null)} />}
    </div>
  );
}

function LeadWaterfallModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [trace, setTrace] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("lead_enrichment_audit")
        .select("*")
        .eq("lead_id", leadId)
        .order("started_at", { ascending: true })
        .limit(100);
      setTrace(data || []);
      setLoading(false);
    })();
  }, [leadId]);

  const totalCost = trace.reduce((s, r) => s + (r.cost_cents || 0), 0);
  const totalMs = trace.reduce((s, r) => s + (r.duration_ms || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0a1628] border border-white/10 rounded-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <div className="text-sm font-bold text-white">Enrichment waterfall</div>
            <div className="text-xs text-white/50 font-mono">{leadId}</div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-3 px-4 py-2 border-b border-white/5 text-xs text-white/60">
          <span>{trace.length} stages</span>
          <span>·</span>
          <span>{totalMs}ms total</span>
          <span>·</span>
          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${(totalCost / 100).toFixed(3)}</span>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          {loading && <div className="text-white/40 text-sm"><Loader2 className="w-4 h-4 inline animate-spin" /> Loading trace…</div>}
          {!loading && trace.length === 0 && <div className="text-white/40 text-sm">No audit rows for this lead.</div>}
          {trace.map((r, i) => (
            <div key={r.id} className="flex items-start gap-3 p-2 rounded border border-white/5 bg-white/[0.02]">
              <div className="text-xs font-mono text-white/30 w-6 pt-0.5">{i + 1}</div>
              <div className="flex-shrink-0 pt-0.5">
                {r.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-white/90">{r.provider}</span>
                  <span className="text-white/30">·</span>
                  <span className="font-mono text-white/60">{r.stage}</span>
                  <span className="ml-auto text-white/40 font-mono">{r.duration_ms}ms</span>
                  {!!r.cost_cents && <span className="text-amber-300 font-mono">${(r.cost_cents / 100).toFixed(3)}</span>}
                </div>
                <div className="text-[10px] text-white/40 font-mono mt-0.5">{r.function_name}</div>
                {r.fields_added && r.fields_added.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.fields_added.map((f) => (
                      <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono">+{f}</span>
                    ))}
                  </div>
                )}
                {r.error_message && (
                  <div className="text-[11px] text-rose-300 mt-1 font-mono break-words">
                    {r.error_code ? `[${r.error_code}] ` : ""}{r.error_message}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-lg font-bold mt-1" style={{ color: color || "white" }}>{value}</div>
    </div>
  );
}
