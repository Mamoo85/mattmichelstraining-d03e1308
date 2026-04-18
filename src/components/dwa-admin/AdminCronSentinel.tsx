import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CheckResult {
  cron: string;
  description: string;
  critical: boolean;
  scheduleOk: boolean;
  freshnessOk: boolean;
  outputOk: boolean;
  lastRun: string | null;
  lastOutput: string | null;
  errors: string[];
}

interface AlertRow {
  id: string;
  checked_at: string;
  status: string;
  total_checks: number;
  failures: number;
  full_report: { results: CheckResult[] };
  trigger_source: string;
}

export default function AdminCronSentinel() {
  const [latest, setLatest] = useState<AlertRow | null>(null);
  const [history, setHistory] = useState<AlertRow[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("cron_sentinel_alerts")
      .select("*")
      .order("checked_at", { ascending: false })
      .limit(20);
    if (data && data.length > 0) {
      setLatest(data[0] as any);
      setHistory(data.slice(1) as any);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function runNow() {
    setRunning(true);
    try {
      await supabase.functions.invoke("cron-sentinel", { body: { trigger: "manual" } });
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function snooze(cron: string) {
    const hours = prompt(`Snooze ${cron} for how many hours?`, "24");
    if (!hours) return;
    const until = new Date(Date.now() + parseInt(hours) * 3600_000).toISOString();
    await supabase.from("cron_sentinel_snoozes").upsert({
      cron_name: cron,
      snoozed_until: until,
      reason: "Admin snoozed via UI",
    });
    alert(`${cron} snoozed for ${hours}h`);
  }

  if (loading) return <div className="text-white/40 text-sm">Loading sentinel data…</div>;

  const results = latest?.full_report?.results || [];
  const passCount = results.filter(r => r.scheduleOk && r.freshnessOk && r.outputOk).length;
  const criticalFails = results.filter(r => r.critical && (!r.scheduleOk || !r.freshnessOk || !r.outputOk)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">🛡️ Cron Sentinel</h2>
          <p className="text-white/60 text-sm">Autonomous watchdog. Runs every 6h. Catches broken crons before they cost you money.</p>
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="px-4 py-2 bg-[#00d4ff] text-[#0a1628] font-bold rounded hover:bg-[#00d4ff]/80 disabled:opacity-50 text-sm"
        >
          {running ? "Running…" : "▶ Run Sentinel Now"}
        </button>
      </div>

      {/* Status summary */}
      {latest && (
        <div className={`p-4 rounded-lg border ${
          latest.status === "pass" ? "bg-emerald-500/10 border-emerald-500/30" :
          latest.status === "warn" ? "bg-amber-500/10 border-amber-500/30" :
          "bg-red-500/10 border-red-500/30"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-white">
                {latest.status === "pass" ? "✅ All Systems Green" :
                 latest.status === "warn" ? "⚠️ Non-Critical Issues" :
                 "🚨 Critical Failures"}
              </div>
              <div className="text-white/70 text-sm mt-1">
                {passCount}/{results.length} passing · {criticalFails} critical fail(s) · last check {new Date(latest.checked_at).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cron table */}
      <div className="bg-[#0f172a] border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0a1628] border-b border-white/10">
            <tr className="text-left text-[#00d4ff] text-xs uppercase">
              <th className="p-3">Status</th>
              <th className="p-3">Cron</th>
              <th className="p-3 hidden md:table-cell">Purpose</th>
              <th className="p-3 hidden lg:table-cell">Last Run</th>
              <th className="p-3 hidden lg:table-cell">Last Output</th>
              <th className="p-3">Issues</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const ok = r.scheduleOk && r.freshnessOk && r.outputOk;
              return (
                <tr key={r.cron} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3">
                    <span className={`inline-block w-3 h-3 rounded-full ${ok ? 'bg-emerald-500' : (r.critical ? 'bg-red-500' : 'bg-amber-500')}`} />
                    {r.critical && <span className="ml-2 text-xs text-red-400">CRITICAL</span>}
                  </td>
                  <td className="p-3 text-white font-mono text-xs">{r.cron}</td>
                  <td className="p-3 text-white/60 hidden md:table-cell text-xs">{r.description}</td>
                  <td className="p-3 text-white/60 hidden lg:table-cell text-xs">{r.lastRun ? new Date(r.lastRun).toLocaleString() : "—"}</td>
                  <td className="p-3 text-white/60 hidden lg:table-cell text-xs">{r.lastOutput ? new Date(r.lastOutput).toLocaleString() : "—"}</td>
                  <td className="p-3 text-red-400 text-xs">{r.errors.length > 0 ? r.errors.join("; ") : "—"}</td>
                  <td className="p-3">
                    <button onClick={() => snooze(r.cron)} className="text-xs text-white/40 hover:text-white">Snooze</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="text-white/60 text-sm uppercase mb-2">Last 20 Checks</h3>
          <div className="bg-[#0f172a] border border-white/10 rounded-lg p-3 max-h-64 overflow-y-auto">
            {history.map(h => (
              <div key={h.id} className="flex justify-between text-xs py-1 border-b border-white/5 last:border-0">
                <span className="text-white/50">{new Date(h.checked_at).toLocaleString()}</span>
                <span className={
                  h.status === "pass" ? "text-emerald-400" :
                  h.status === "warn" ? "text-amber-400" : "text-red-400"
                }>
                  {h.status.toUpperCase()} · {h.failures}/{h.total_checks} fail · {h.trigger_source}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
