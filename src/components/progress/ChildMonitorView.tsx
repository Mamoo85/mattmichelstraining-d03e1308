import { memo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, ArrowLeft, Activity, Dumbbell, Calendar, TrendingUp, Moon, Zap, AlertTriangle } from "lucide-react";
import RecoveryChart from "@/components/progress/RecoveryChart";

interface ChildSummary {
  name: string;
  email: string;
  totalLogs: number;
  lastLogDate: string | null;
  recentLifts: { exercise: string; weight: number; date: string }[];
  workoutCount: number;
  latestRecovery: {
    sleep_hours: number | null;
    sleep_quality: number | null;
    soreness: number | null;
    energy: number | null;
    date: string;
  } | null;
}

export type { ChildSummary };

/* ---------- Recovery Metric ---------- */

const RecoveryMetric = memo(({
  icon,
  label,
  value,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: "good" | "ok" | "concern" | "none";
}) => {
  const statusColors = {
    good: "border-[hsl(140,60%,45%)]/40 bg-[hsl(140,60%,45%)]/5",
    ok: "border-[hsl(36,70%,50%)]/40 bg-[hsl(36,70%,50%)]/5",
    concern: "border-[hsl(0,60%,50%)]/40 bg-[hsl(0,60%,50%)]/5",
    none: "border-border bg-background",
  };

  return (
    <div className={`border p-3 ${statusColors[status]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <span className="text-lg font-mono font-bold text-foreground">{value}</span>
    </div>
  );
});
RecoveryMetric.displayName = "RecoveryMetric";

/* ---------- Helpers ---------- */

export function getStatus(val: number | null, good: number, bad: number): "good" | "ok" | "concern" | "none" {
  if (val == null) return "none";
  if (val >= good) return "good";
  if (val <= bad) return "concern";
  return "ok";
}

export function getStatusInverted(val: number | null, good: number, bad: number): "good" | "ok" | "concern" | "none" {
  if (val == null) return "none";
  if (val <= good) return "good";
  if (val >= bad) return "concern";
  return "ok";
}

/* ---------- Fetch ---------- */

export async function fetchChildSummary(childId: string): Promise<ChildSummary | null> {
  const [profileRes, logsRes, workoutRes] = await Promise.all([
    supabase.from("profiles").select("full_name, athlete_name, email").eq("user_id", childId).single(),
    supabase.from("progress_logs").select("exercise_name, weight, logged_at").eq("user_id", childId).order("logged_at", { ascending: false }).limit(100),
    supabase.from("workout_logs").select("date, sleep_hours, sleep_quality, soreness, energy").eq("user_id", childId).order("date", { ascending: false }).limit(30),
  ]);

  const profile = profileRes.data;
  const logs = logsRes.data || [];
  const workouts = workoutRes.data || [];

  const seen = new Set<string>();
  const recentLifts = logs
    .filter((l: any) => { if (seen.has(l.exercise_name)) return false; seen.add(l.exercise_name); return true; })
    .slice(0, 5)
    .map((l: any) => ({ exercise: l.exercise_name, weight: l.weight, date: l.logged_at }));

  const recoveryEntry = workouts.find((w: any) => w.sleep_hours || w.sleep_quality || w.soreness || w.energy);

  return {
    name: profile?.athlete_name || profile?.full_name || "Athlete",
    email: profile?.email || "",
    totalLogs: logs.length,
    lastLogDate: logs.length > 0 ? logs[0].logged_at : null,
    recentLifts,
    workoutCount: workouts.length,
    latestRecovery: recoveryEntry
      ? { sleep_hours: recoveryEntry.sleep_hours, sleep_quality: recoveryEntry.sleep_quality, soreness: recoveryEntry.soreness, energy: recoveryEntry.energy, date: recoveryEntry.date }
      : null,
  };
}

/* ---------- Component ---------- */

interface Props {
  childId: string;
  summary: ChildSummary | null;
  loading: boolean;
}

const ChildMonitorView = memo(({ childId, summary, loading }: Props) => {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-card border border-border p-8 text-center mb-6">
        <Shield size={32} className="text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Unable to load child data. Make sure this account is linked to yours.</p>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Link to="/dashboard" className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all">
          <ArrowLeft size={12} /> Back to Dashboard
        </Link>
      </div>

      <div className="bg-card border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">{summary.name[0]?.toUpperCase()}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Parent Monitoring</span>
            </div>
            <h1 className="text-lg font-black uppercase tracking-tight text-foreground">{summary.name}'s Progress</h1>
            <p className="text-[10px] text-muted-foreground">{summary.email}</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { icon: Dumbbell, label: "Lifts Logged", value: summary.totalLogs },
            { icon: Calendar, label: "Sessions", value: summary.workoutCount },
            { icon: TrendingUp, label: "Exercises", value: summary.recentLifts.length },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-background border border-border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} className="text-primary" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
              </div>
              <span className="text-xl font-mono font-bold text-foreground">{value}</span>
            </div>
          ))}
          <div className="bg-background border border-border p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity size={12} className="text-primary" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Last Active</span>
            </div>
            <span className="text-sm font-mono font-bold text-foreground">
              {summary.lastLogDate ? new Date(summary.lastLogDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
            </span>
          </div>
        </div>

        {/* Recent Lifts */}
        {summary.recentLifts.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <Dumbbell size={11} /> Recent Lifts
            </h3>
            <div className="space-y-1">
              {summary.recentLifts.map((lift, i) => (
                <div key={i} className="flex items-center justify-between bg-background border border-border px-3 py-2">
                  <span className="text-xs font-bold text-foreground">{lift.exercise}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-primary">{lift.weight} lbs</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(lift.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recovery */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <Activity size={11} /> Latest Recovery Check-In
          </h3>
          {summary.latestRecovery ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <RecoveryMetric icon={<Moon size={14} className="text-[hsl(220,70%,55%)]" />} label="Sleep" value={summary.latestRecovery.sleep_hours != null ? `${summary.latestRecovery.sleep_hours}h` : "—"} status={getStatus(summary.latestRecovery.sleep_hours, 7, 5)} />
              <RecoveryMetric icon={<Moon size={14} className="text-[hsl(270,50%,55%)]" />} label="Sleep Quality" value={summary.latestRecovery.sleep_quality != null ? `${summary.latestRecovery.sleep_quality}/10` : "—"} status={getStatus(summary.latestRecovery.sleep_quality, 7, 4)} />
              <RecoveryMetric icon={<AlertTriangle size={14} className="text-[hsl(0,60%,50%)]" />} label="Soreness" value={summary.latestRecovery.soreness != null ? `${summary.latestRecovery.soreness}/10` : "—"} status={getStatusInverted(summary.latestRecovery.soreness, 3, 7)} />
              <RecoveryMetric icon={<Zap size={14} className="text-[hsl(140,60%,45%)]" />} label="Energy" value={summary.latestRecovery.energy != null ? `${summary.latestRecovery.energy}/10` : "—"} status={getStatus(summary.latestRecovery.energy, 7, 4)} />
            </div>
          ) : (
            <div className="bg-background border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">No recovery data logged yet</p>
            </div>
          )}
        </div>
      </div>

      <RecoveryChart userId={childId} />
    </div>
  );
});

ChildMonitorView.displayName = "ChildMonitorView";

export default ChildMonitorView;
