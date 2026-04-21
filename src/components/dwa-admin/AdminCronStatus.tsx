import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface JobHealth {
  jobname: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  next_run_at: string | null;
  consecutive_failures: number;
  total_runs: number;
}

interface Job {
  jobname: string;
  schedule: string | null;
  command: string | null;
  health: JobHealth | null;
}

interface StatusPayload {
  kpis: { total: number; healthy: number; failing: number; stale: number };
  jobs: Job[];
}

export default function AdminCronStatus() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("cron-status");
      if (err) throw err;
      setData(res as StatusPayload);
    } catch (e: any) {
      setError(e.message || "Failed to load cron status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function rollback(jobname: string) {
    if (!confirm(`Rollback "${jobname}" to its previous schedule? This will replace the current command.`)) return;
    setRollingBack(jobname);
    try {
      const { error: err } = await supabase.functions.invoke("cron-rollback", { body: { jobname } });
      if (err) throw err;
      alert(`✅ ${jobname} rolled back`);
      await load();
    } catch (e: any) {
      alert(`❌ Rollback failed: ${e.message || e}`);
    } finally {
      setRollingBack(null);
    }
  }

  if (loading) return <div className="text-white/40 text-sm">Loading cron status…</div>;
  if (error) return <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded">Error: {error}</div>;
  if (!data) return null;

  const { kpis, jobs } = data;
  const failingJobs = jobs.filter(j => j.health && j.health.consecutive_failures > 0);
  const allJobs = [...jobs].sort((a, b) => a.jobname.localeCompare(b.jobname));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">🛡️ Cron Status</h2>
          <p className="text-white/60 text-sm">Live view of every scheduled job. Rollback in one click.</p>
        </div>
        <button onClick={load} className="px-4 py-2 bg-[#00d4ff] text-[#0a1628] font-bold rounded hover:bg-[#00d4ff]/80 text-sm">
          🔄 Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total Jobs" value={kpis.total} color="text-white" />
        <Kpi label="Healthy" value={kpis.healthy} color="text-emerald-400" />
        <Kpi label="Failing" value={kpis.failing} color="text-red-400" />
        <Kpi label="Stale" value={kpis.stale} color="text-amber-400" />
      </div>

      {/* Failing jobs */}
      {failingJobs.length > 0 && (
        <div>
          <h3 className="text-red-400 text-sm uppercase mb-2">🚨 Failing Jobs ({failingJobs.length})</h3>
          <div className="bg-red-500/5 border border-red-500/30 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-red-500/10">
                <tr className="text-left text-red-300 text-xs uppercase">
                  <th className="p-3">Job</th>
                  <th className="p-3">Last Failure</th>
                  <th className="p-3">Streak</th>
                  <th className="p-3">Error</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {failingJobs.map(j => (
                  <tr key={j.jobname} className="border-b border-red-500/10">
                    <td className="p-3 font-mono text-xs text-white">{j.jobname}</td>
                    <td className="p-3 text-white/60 text-xs">{j.health?.last_failure_at ? new Date(j.health.last_failure_at).toLocaleString() : "—"}</td>
                    <td className="p-3 text-red-400 font-bold">{j.health?.consecutive_failures}×</td>
                    <td className="p-3 text-red-300 text-xs max-w-md">
                      <details>
                        <summary className="cursor-pointer truncate">{j.health?.last_error?.slice(0, 80) || "—"}</summary>
                        <pre className="mt-2 whitespace-pre-wrap text-xs bg-black/40 p-2 rounded">{j.health?.last_error || "(none)"}</pre>
                      </details>
                      {j.command && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-white/40">Show command</summary>
                          <pre className="mt-2 whitespace-pre-wrap text-xs bg-black/40 p-2 rounded">{j.command}</pre>
                        </details>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => rollback(j.jobname)}
                        disabled={rollingBack === j.jobname}
                        className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-xs hover:bg-amber-500/30 disabled:opacity-50"
                      >
                        {rollingBack === j.jobname ? "…" : "↩ Rollback"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All jobs */}
      <div>
        <h3 className="text-white/60 text-sm uppercase mb-2">All Jobs ({allJobs.length})</h3>
        <div className="bg-[#0f172a] border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0a1628] border-b border-white/10">
              <tr className="text-left text-[#00d4ff] text-xs uppercase">
                <th className="p-3">Job</th>
                <th className="p-3 hidden md:table-cell">Schedule</th>
                <th className="p-3">Last Success</th>
                <th className="p-3 hidden lg:table-cell">Next Run</th>
                <th className="p-3 hidden sm:table-cell">Runs</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {allJobs.map(j => {
                const ok = !j.health?.consecutive_failures;
                return (
                  <tr key={j.jobname} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 font-mono text-xs text-white">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {j.jobname}
                    </td>
                    <td className="p-3 text-white/50 hidden md:table-cell font-mono text-xs">{j.schedule || "—"}</td>
                    <td className="p-3 text-white/60 text-xs">{j.health?.last_success_at ? new Date(j.health.last_success_at).toLocaleString() : "—"}</td>
                    <td className="p-3 text-white/60 hidden lg:table-cell text-xs">{j.health?.next_run_at ? new Date(j.health.next_run_at).toLocaleString() : "—"}</td>
                    <td className="p-3 text-white/60 hidden sm:table-cell text-xs">{j.health?.total_runs ?? 0}</td>
                    <td className="p-3">
                      {j.command && (
                        <details>
                          <summary className="cursor-pointer text-white/40 text-xs">⚙</summary>
                          <pre className="mt-2 whitespace-pre-wrap text-xs bg-black/40 p-2 rounded max-w-xl">{j.command}</pre>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#0f172a] border border-white/10 rounded-lg p-4">
      <div className="text-white/40 text-xs uppercase">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
