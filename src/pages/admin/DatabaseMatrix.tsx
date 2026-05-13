import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Loader2, RefreshCw, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  group: string;
  table: string;
  label: string;
  total: number;
  recent_24h: number;
  recent_7d: number;
  scanner: string | null;
  scanner_status: "ok" | "stale" | "failing" | "unknown" | "no_cron";
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
};

const STATUS_COLORS: Record<Row["scanner_status"], string> = {
  ok: "bg-green-500/20 text-green-300",
  stale: "bg-amber-500/20 text-amber-300",
  failing: "bg-red-500/20 text-red-300",
  unknown: "bg-slate-500/20 text-slate-300",
  no_cron: "bg-white/5 text-white/40",
};

export default function DatabaseMatrix() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [generated, setGenerated] = useState<string>("");
  const [filling, setFilling] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-database-matrix", { body: {} });
    if (error) toast.error(error.message);
    else {
      setRows(data?.rows || []);
      setGenerated(data?.generated_at || "");
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function fillSparse() {
    setFilling(true);
    toast.info("Triggering buyer-universe orchestrator + Apify runner + promoter…");
    const calls = [
      supabase.functions.invoke("buyer-universe-orchestrator", { body: {} }),
      supabase.functions.invoke("apify-actor-runner", { body: {} }),
      supabase.functions.invoke("buyer-pool-promote", { body: {} }),
      supabase.functions.invoke("dead-lead-pool-refresh", { body: {} }),
      supabase.functions.invoke("trade-radar-scanner", { body: {} }),
      supabase.functions.invoke("mortgage-radar-scanner", { body: {} }),
      supabase.functions.invoke("techalert-prospect-hunter", { body: {} }),
    ];
    const results = await Promise.allSettled(calls);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    toast.success(`Fired ${ok}/${results.length} fill jobs. Refreshing in 10s…`);
    setTimeout(load, 10000);
    setFilling(false);
  }

  const groups = Array.from(new Set(rows.map((r) => r.group)));

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <Helmet><title>Database Matrix — Admin</title></Helmet>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-6 h-6 text-cyan-400" />
          <p className="text-[#00d4ff] text-xs font-extrabold tracking-[3px]">⚙️ ADMIN — LIVE DATABASE MATRIX</p>
        </div>
        <h1 className="text-2xl font-bold mb-1">All tables · counts · scanner status</h1>
        <p className="text-[#94a3b8] text-sm mb-4">
          Row counts pulled live. Scanner status from <code>cron_job_health</code> (auto-monitored by cron-sentinel; auto-fixed by code-fixer-watchdog).
        </p>
        <div className="flex items-center gap-2 mb-6">
          <button onClick={load} disabled={loading} className="bg-white/5 hover:bg-white/10 text-white/80 text-sm px-3 py-2 rounded flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={fillSparse} disabled={filling} className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-sm px-3 py-2 rounded flex items-center gap-2">
            {filling ? <Loader2 className="w-4 h-4 animate-spin" /> : "⚡"} Fill sparse tables NOW
          </button>
          {generated && <span className="text-white/40 text-xs ml-auto">Generated {new Date(generated).toLocaleTimeString()}</span>}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-white/60"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (
          groups.map((g) => (
            <div key={g} className="mb-6">
              <h2 className="text-sm font-bold text-cyan-300 mb-2 uppercase tracking-wider">{g}</h2>
              <div className="overflow-x-auto rounded-xl border border-[#1e3a5f] bg-[#0a1628]">
                <table className="w-full text-sm">
                  <thead className="bg-[#061021] text-white/60 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-3">Table</th>
                      <th className="text-right px-4 py-3">Total</th>
                      <th className="text-right px-4 py-3">24h</th>
                      <th className="text-right px-4 py-3">7d</th>
                      <th className="text-left px-4 py-3">Scanner</th>
                      <th className="text-center px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Last success</th>
                      <th className="text-left px-4 py-3">Last error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.filter((r) => r.group === g).map((r) => (
                      <tr key={r.table} className="border-t border-white/5">
                        <td className="px-4 py-2">
                          <div className="text-white/90">{r.label}</div>
                          <div className="font-mono text-cyan-400/60 text-xs">{r.table}</div>
                        </td>
                        <td className={`px-4 py-2 text-right font-mono ${r.total < 100 ? "text-amber-300" : "text-white"}`}>{r.total.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono text-white/70">{r.recent_24h.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono text-white/70">{r.recent_7d.toLocaleString()}</td>
                        <td className="px-4 py-2 font-mono text-cyan-300/80 text-xs">{r.scanner || "—"}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${STATUS_COLORS[r.scanner_status]}`}>
                            {r.scanner_status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-white/50 text-xs">{r.last_success_at ? new Date(r.last_success_at).toLocaleString() : "—"}</td>
                        <td className="px-4 py-2 text-red-300/80 text-xs max-w-xs truncate" title={r.last_error || ""}>{r.last_error || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}

        <p className="text-xs text-white/40 mt-6">
          Amber row counts = sparse (&lt;100). Stale/failing scanners auto-alert Matt via SMS via cron-sentinel; errors auto-route to code-fixer-watchdog.
        </p>
      </div>
    </div>
  );
}
