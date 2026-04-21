import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface JobHealth {
  jobname: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  next_run_at: string | null;
  consecutive_failures: number;
  total_runs: number;
  expected_interval_minutes: number | null;
  stale_after_minutes: number | null;
}

interface Job {
  jobname: string;
  schedule: string | null;
  command: string | null;
  health: JobHealth | null;
}

interface AuditRow {
  id: string;
  jobname: string;
  schedule: string | null;
  command: string | null;
  attempted_by: string | null;
  outcome: string;
  error_rule: string | null;
  error_message: string | null;
  mode: string;
  attempted_at: string;
}

interface StatusPayload {
  kpis: { total: number; healthy: number; failing: number; stale: number };
  jobs: Job[];
  audit: AuditRow[];
}

function formatInterval(mins: number | null | undefined): string {
  if (!mins) return "—";
  if (mins < 60) return `Every ${mins}m`;
  if (mins < 1440) return `Every ${Math.round(mins / 60)}h`;
  if (mins < 1440 * 7) return `Every ${Math.round(mins / 1440)}d`;
  return `Every ${Math.round(mins / (1440 * 7))}w`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60_000);
  const hrs = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const suffix = ms >= 0 ? "from now" : "ago";
  if (mins < 60) return `${mins}m ${suffix}`;
  if (hrs < 48) return `${hrs}h ${suffix}`;
  return `${days}d ${suffix}`;
}

function isStale(h: JobHealth | null): boolean {
  if (!h?.last_success_at) return true;
  const staleMin = h.stale_after_minutes || 26 * 60;
  const ageMin = (Date.now() - new Date(h.last_success_at).getTime()) / 60_000;
  return ageMin > staleMin;
}

export default function AdminCronStatus() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dry-run state
  const [dryJobname, setDryJobname] = useState("");
  const [drySchedule, setDrySchedule] = useState("");
  const [dryCommand, setDryCommand] = useState("");
  const [dryResult, setDryResult] = useState<any>(null);
  const [dryRunning, setDryRunning] = useState(false);

  // Audit filter
  const [auditFilter, setAuditFilter] = useState<"all" | "rejected" | "24h">("all");

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

  async function runDryRun() {
    setDryRunning(true);
    setDryResult(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("cron-validate", {
        body: { jobname: dryJobname, schedule: drySchedule, command: dryCommand },
      });
      if (err) throw err;
      setDryResult(res);
      await load(); // refresh audit log
    } catch (e: any) {
      setDryResult({ ok: false, error: e.message || String(e) });
    } finally {
      setDryRunning(false);
    }
  }

  const filteredAudit = useMemo(() => {
    if (!data?.audit) return [];
    const since24h = Date.now() - 24 * 60 * 60 * 1000;
    return data.audit.filter((a) => {
      if (auditFilter === "rejected") return a.outcome === "rejected";
      if (auditFilter === "24h") return new Date(a.attempted_at).getTime() >= since24h;
      return true;
    });
  }, [data, auditFilter]);

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
          <p className="text-white/60 text-sm">Live view of every scheduled job. Per-job stale windows, dry-run validator, audit log.</p>
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
        <div className="bg-[#0f172a] border border-white/10 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-[#0a1628] border-b border-white/10">
              <tr className="text-left text-[#00d4ff] text-xs uppercase">
                <th className="p-3">Job</th>
                <th className="p-3 hidden md:table-cell">Schedule</th>
                <th className="p-3 hidden lg:table-cell">Expected Gap</th>
                <th className="p-3">Last Success</th>
                <th className="p-3 hidden lg:table-cell">Next Run</th>
                <th className="p-3 hidden sm:table-cell">Runs</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {allJobs.map(j => {
                const failing = (j.health?.consecutive_failures ?? 0) > 0;
                const stale = !failing && isStale(j.health);
                const dotColor = failing ? "bg-red-500" : stale ? "bg-amber-400" : "bg-emerald-500";
                return (
                  <tr key={j.jobname} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 font-mono text-xs text-white">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${dotColor}`} />
                      {j.jobname}
                    </td>
                    <td className="p-3 text-white/50 hidden md:table-cell font-mono text-xs">{j.schedule || "—"}</td>
                    <td className="p-3 text-white/60 hidden lg:table-cell text-xs">{formatInterval(j.health?.expected_interval_minutes)}</td>
                    <td className="p-3 text-white/60 text-xs">{j.health?.last_success_at ? new Date(j.health.last_success_at).toLocaleString() : "—"}</td>
                    <td
                      className="p-3 text-white/60 hidden lg:table-cell text-xs"
                      title={j.health?.next_run_at ? new Date(j.health.next_run_at).toLocaleString() : ""}
                    >
                      {relativeTime(j.health?.next_run_at ?? null)}
                    </td>
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

      {/* Dry-run validator */}
      <div>
        <h3 className="text-[#00d4ff] text-sm uppercase mb-2">🧪 Dry-Run Validator</h3>
        <div className="bg-[#0f172a] border border-white/10 rounded-lg p-4 space-y-3">
          <p className="text-white/50 text-xs">Validate a cron schedule + command without actually scheduling. Same checks as <code>safe_cron_schedule</code>.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={dryJobname}
              onChange={(e) => setDryJobname(e.target.value)}
              placeholder="jobname (e.g. my-cron-daily)"
              className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white text-sm font-mono"
            />
            <input
              value={drySchedule}
              onChange={(e) => setDrySchedule(e.target.value)}
              placeholder="schedule (e.g. 0 * * * *)"
              className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white text-sm font-mono"
            />
          </div>
          <textarea
            value={dryCommand}
            onChange={(e) => setDryCommand(e.target.value)}
            placeholder="SQL command (must include canonical URL + Bearer eyJ...)"
            rows={6}
            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded text-white text-xs font-mono"
          />
          <button
            onClick={runDryRun}
            disabled={dryRunning || !dryJobname || !drySchedule || !dryCommand}
            className="px-4 py-2 bg-[#00d4ff] text-[#0a1628] font-bold rounded hover:bg-[#00d4ff]/80 text-sm disabled:opacity-50"
          >
            {dryRunning ? "Validating…" : "Validate"}
          </button>
          {dryResult && (
            <div className={`mt-3 p-3 rounded text-xs ${dryResult.ok ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border border-red-500/30 text-red-300"}`}>
              {dryResult.ok ? (
                <>
                  <div className="font-bold mb-2">✅ Validation passed</div>
                  {dryResult.would_replace ? (
                    <div>
                      <div className="text-white/60 mb-1">Would replace existing schedule:</div>
                      <pre className="bg-black/40 p-2 rounded overflow-x-auto">{JSON.stringify(dryResult.would_replace, null, 2)}</pre>
                    </div>
                  ) : (
                    <div className="text-white/60">No prior version — would create new job.</div>
                  )}
                </>
              ) : (
                <>
                  <div className="font-bold mb-1">❌ Rejected: <span className="font-mono">{dryResult.rule || "unknown"}</span></div>
                  <div>{dryResult.error}</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Audit log */}
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-white/60 text-sm uppercase">📜 Audit Log ({filteredAudit.length})</h3>
          <div className="flex gap-1">
            {(["all", "rejected", "24h"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setAuditFilter(f)}
                className={`px-3 py-1 rounded text-xs ${auditFilter === f ? "bg-[#00d4ff] text-[#0a1628] font-bold" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
              >
                {f === "all" ? "All" : f === "rejected" ? "Rejected" : "Last 24h"}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-[#0f172a] border border-white/10 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-[#0a1628] border-b border-white/10">
              <tr className="text-left text-[#00d4ff] text-xs uppercase">
                <th className="p-3">When</th>
                <th className="p-3">Mode</th>
                <th className="p-3">Job</th>
                <th className="p-3">Outcome</th>
                <th className="p-3">Rule</th>
                <th className="p-3 hidden md:table-cell">By</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredAudit.length === 0 ? (
                <tr><td colSpan={7} className="p-4 text-center text-white/40 text-xs">No audit entries match filter.</td></tr>
              ) : filteredAudit.map((a) => {
                const outcomeIcon = a.outcome === "success" ? "✅" : a.outcome === "rejected" ? "❌" : a.outcome === "rolled_back" ? "↩" : "⏳";
                const outcomeColor = a.outcome === "success" ? "text-emerald-400" : a.outcome === "rejected" ? "text-red-400" : "text-amber-400";
                return (
                  <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 text-white/60 text-xs">{new Date(a.attempted_at).toLocaleString()}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-white/10 text-white/70 text-xs font-mono">{a.mode}</span></td>
                    <td className="p-3 font-mono text-xs text-white">{a.jobname}</td>
                    <td className={`p-3 text-xs ${outcomeColor}`}>{outcomeIcon} {a.outcome}</td>
                    <td className="p-3 text-xs">
                      {a.error_rule ? <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-300 font-mono">{a.error_rule}</span> : <span className="text-white/30">—</span>}
                    </td>
                    <td className="p-3 text-white/50 hidden md:table-cell text-xs">{a.attempted_by || "—"}</td>
                    <td className="p-3">
                      {(a.command || a.error_message) && (
                        <details>
                          <summary className="cursor-pointer text-white/40 text-xs">⚙</summary>
                          <div className="mt-2 space-y-2">
                            {a.error_message && <pre className="whitespace-pre-wrap text-xs bg-red-500/10 text-red-300 p-2 rounded">{a.error_message}</pre>}
                            {a.schedule && <div className="text-xs text-white/60">Schedule: <code className="text-white/80">{a.schedule}</code></div>}
                            {a.command && <pre className="whitespace-pre-wrap text-xs bg-black/40 text-white/70 p-2 rounded max-w-xl overflow-x-auto">{a.command}</pre>}
                          </div>
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
