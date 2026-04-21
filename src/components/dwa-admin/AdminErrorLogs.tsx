/**
 * AdminErrorLogs — surfaces silent failures (Twilio/Resend/Stripe/cron)
 * captured by _shared/error-log.ts. Live view, filterable by severity + source.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type ErrorLog = {
  id: string;
  created_at: string;
  source: string;
  function_name: string | null;
  severity: "warn" | "error" | "critical";
  recipient: string | null;
  payload: unknown;
  error_message: string;
  http_status: number | null;
  alerted_admin: boolean;
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/40",
  error: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  warn: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
};

const SOURCE_DOT: Record<string, string> = {
  twilio: "bg-cyan-400",
  resend: "bg-purple-400",
  stripe: "bg-emerald-400",
  cron: "bg-blue-400",
  edge_function: "bg-pink-400",
  ai: "bg-amber-400",
};

export default function AdminErrorLogs() {
  const [rows, setRows] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<string>("all");
  const [source, setSource] = useState<string>("all");

  async function load() {
    setLoading(true);
    let q = supabase
      .from("error_logs" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(250);
    if (severity !== "all") q = q.eq("severity", severity) as typeof q;
    if (source !== "all") q = q.eq("source", source) as typeof q;
    const { data } = await q;
    setRows((data as ErrorLog[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity, source]);

  const counts = useMemo(() => {
    const c = { critical: 0, error: 0, warn: 0 };
    for (const r of rows) c[r.severity] = (c[r.severity] || 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">🚨 Error Logs</h2>
        <p className="text-white/50 text-sm mt-1">
          Silent failures across SMS, email, payments, and crons. Critical entries also page Matt by SMS.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <div className="text-[10px] uppercase tracking-wider text-red-300 font-bold">Critical</div>
          <div className="text-2xl font-black text-white mt-1">{counts.critical}</div>
        </div>
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
          <div className="text-[10px] uppercase tracking-wider text-orange-300 font-bold">Error</div>
          <div className="text-2xl font-black text-white mt-1">{counts.error}</div>
        </div>
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
          <div className="text-[10px] uppercase tracking-wider text-yellow-300 font-bold">Warn</div>
          <div className="text-2xl font-black text-white mt-1">{counts.warn}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-white/50 text-xs">Severity:</label>
        <select
          className="bg-[#0d1f3c] border border-white/10 rounded text-white text-sm px-2 py-1"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="all">All</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
        </select>
        <label className="text-white/50 text-xs ml-2">Source:</label>
        <select
          className="bg-[#0d1f3c] border border-white/10 rounded text-white text-sm px-2 py-1"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="all">All</option>
          <option value="twilio">Twilio</option>
          <option value="resend">Resend</option>
          <option value="stripe">Stripe</option>
          <option value="cron">Cron</option>
          <option value="edge_function">Edge function</option>
          <option value="ai">AI</option>
        </select>
        <button
          onClick={load}
          className="ml-auto px-3 py-1 rounded bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 text-xs font-bold hover:bg-[#00d4ff]/30"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#0d1f3c] overflow-hidden">
        {loading ? (
          <div className="p-6 text-white/40 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-white/40 text-sm">
            ✅ No errors logged. Either everything is healthy, or no edge functions have called <code>logError()</code> yet.
          </div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[640px] overflow-y-auto">
            {rows.map((r) => (
              <div key={r.id} className="p-3 hover:bg-white/[0.02]">
                <div className="flex items-start gap-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mt-2 ${SOURCE_DOT[r.source] || "bg-gray-400"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${
                          SEVERITY_BADGE[r.severity] || "bg-white/10 text-white/60"
                        }`}
                      >
                        {r.severity}
                      </span>
                      <span className="text-white/80 text-sm font-mono">{r.source}</span>
                      {r.function_name && (
                        <span className="text-white/50 text-xs">/ {r.function_name}</span>
                      )}
                      {r.http_status && (
                        <span className="text-white/40 text-xs">HTTP {r.http_status}</span>
                      )}
                      {r.alerted_admin && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                          📱 SMS sent
                        </span>
                      )}
                      <span className="text-white/30 text-xs ml-auto">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-white/90 text-sm mt-1 break-words">{r.error_message}</div>
                    {r.recipient && (
                      <div className="text-white/40 text-xs mt-0.5">→ {r.recipient}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
