import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface CronHealth {
  jobname: string;
  last_success_at: string | null;
  consecutive_failures: number | null;
  active: boolean | null;
}
interface ExpectedJob {
  jobname: string;
  surface: string;
  critical: boolean;
  stale_after_minutes: number;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CronStatusWidget({ jobnames }: { jobnames?: string[] }) {
  const [rows, setRows] = useState<Array<ExpectedJob & Partial<CronHealth>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: expected }, { data: health }] = await Promise.all([
        supabase.from("cron_expected_jobs").select("jobname, surface, critical, stale_after_minutes"),
        supabase.from("cron_job_health" as any).select("jobname, last_success_at, consecutive_failures, active"),
      ]);
      const healthMap = new Map<string, CronHealth>();
      for (const h of (health as any[]) || []) healthMap.set(h.jobname, h);
      const list = ((expected as any[]) || [])
        .filter((e) => !jobnames || jobnames.includes(e.jobname))
        .map((e) => ({ ...e, ...(healthMap.get(e.jobname) || {}) }));
      setRows(list);
      setLoading(false);
    })();
  }, [JSON.stringify(jobnames)]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading cron status…</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map((r) => {
        const lastMs = r.last_success_at ? Date.now() - new Date(r.last_success_at).getTime() : Infinity;
        const stale = lastMs > (r.stale_after_minutes || 1440) * 60 * 1000;
        const failing = (r.consecutive_failures || 0) >= 3;
        const missing = !("last_success_at" in r) || r.active === undefined;
        const status = missing ? "missing" : failing ? "failing" : stale ? "stale" : "ok";
        const color =
          status === "ok"
            ? "border-emerald-500/40 bg-emerald-500/5"
            : status === "stale"
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-rose-500/40 bg-rose-500/5";
        const Icon = status === "ok" ? CheckCircle2 : status === "stale" ? Clock : AlertTriangle;
        return (
          <div key={r.jobname} className={`border rounded-lg p-3 ${color}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs truncate">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{r.jobname}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide font-semibold">{status}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              <div>Surface: {r.surface}</div>
              <div>Last success: {timeAgo(r.last_success_at ?? null)}</div>
              <div>Failures (consecutive): {r.consecutive_failures ?? 0}</div>
              {r.critical && <div className="text-rose-400 font-semibold">CRITICAL</div>}
            </div>
          </div>
        );
      })}
      {rows.length === 0 && <div className="text-sm text-muted-foreground">No expected crons configured.</div>}
    </div>
  );
}
