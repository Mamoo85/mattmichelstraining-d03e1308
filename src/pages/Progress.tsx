import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import ProgressCharts from "@/components/ProgressCharts";
import RecoveryChart from "@/components/progress/RecoveryChart";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, ArrowLeft, Activity, Dumbbell, Calendar, TrendingUp, Moon, Zap, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

interface ClientOption {
  user_id: string;
  label: string;
}

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

const Progress = () => {
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [searchParams] = useSearchParams();
  const childId = searchParams.get("child");

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [loadingClients, setLoadingClients] = useState(false);

  // Parent viewing child
  const [childSummary, setChildSummary] = useState<ChildSummary | null>(null);
  const [loadingChild, setLoadingChild] = useState(false);
  const [isParentViewing, setIsParentViewing] = useState(false);

  // Admin client list
  useEffect(() => {
    if (!isAdmin) return;
    const fetchClients = async () => {
      setLoadingClients(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, email")
        .order("created_at", { ascending: false });
      if (data) {
        setClients(
          data.map((p) => ({
            user_id: p.user_id,
            label: p.athlete_name || p.full_name || p.email || p.user_id.slice(0, 8),
          }))
        );
      }
      setLoadingClients(false);
    };
    fetchClients();
  }, [isAdmin]);

  // Parent-child detection & data fetch
  useEffect(() => {
    if (!childId || !user) return;

    const fetchChildData = async () => {
      setLoadingChild(true);
      setIsParentViewing(true);

      // Verify parent-child link
      const { data: link } = await supabase
        .from("parent_child_links")
        .select("id")
        .eq("parent_user_id", user.id)
        .eq("child_user_id", childId)
        .maybeSingle();

      if (!link && !isAdmin) {
        setLoadingChild(false);
        setIsParentViewing(false);
        return;
      }

      // Fetch child profile, progress logs, workout logs in parallel
      const [profileRes, logsRes, workoutRes] = await Promise.all([
        supabase.from("profiles").select("full_name, athlete_name, email").eq("user_id", childId).single(),
        supabase.from("progress_logs").select("exercise_name, weight, logged_at").eq("user_id", childId).order("logged_at", { ascending: false }).limit(100),
        supabase.from("workout_logs").select("date, sleep_hours, sleep_quality, soreness, energy").eq("user_id", childId).order("date", { ascending: false }).limit(30),
      ]);

      const profile = profileRes.data;
      const logs = logsRes.data || [];
      const workouts = workoutRes.data || [];

      // Get unique recent lifts (top 5 by recency)
      const seen = new Set<string>();
      const recentLifts = logs
        .filter((l: any) => {
          if (seen.has(l.exercise_name)) return false;
          seen.add(l.exercise_name);
          return true;
        })
        .slice(0, 5)
        .map((l: any) => ({
          exercise: l.exercise_name,
          weight: l.weight,
          date: l.logged_at,
        }));

      // Latest recovery data
      const recoveryEntry = workouts.find(
        (w: any) => w.sleep_hours || w.sleep_quality || w.soreness || w.energy
      );

      setChildSummary({
        name: profile?.athlete_name || profile?.full_name || "Athlete",
        email: profile?.email || "",
        totalLogs: logs.length,
        lastLogDate: logs.length > 0 ? logs[0].logged_at : null,
        recentLifts,
        workoutCount: workouts.length,
        latestRecovery: recoveryEntry
          ? {
              sleep_hours: recoveryEntry.sleep_hours,
              sleep_quality: recoveryEntry.sleep_quality,
              soreness: recoveryEntry.soreness,
              energy: recoveryEntry.energy,
              date: recoveryEntry.date,
            }
          : null,
      });

      setLoadingChild(false);
    };

    fetchChildData();
  }, [childId, user, isAdmin]);

  const selected = clients.find((c) => c.user_id === selectedClient);

  // Determine effective user to show progress for
  const effectiveTargetId = childId || selectedClient || undefined;
  const effectiveTargetName = childId
    ? childSummary?.name
    : selected?.label;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-12">

        {/* Parent Monitoring Header */}
        {isParentViewing && childId && (
          <>
            {loadingChild ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-primary" size={24} />
              </div>
            ) : childSummary ? (
              <div className="mb-6 space-y-4">
                {/* Back + child header */}
                <div className="flex items-center gap-3 mb-2">
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
                  >
                    <ArrowLeft size={12} /> Back to Dashboard
                  </Link>
                </div>

                <div className="bg-card border border-border p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">
                        {childSummary.name[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                          Parent Monitoring
                        </span>
                      </div>
                      <h1 className="text-lg font-black uppercase tracking-tight text-foreground">
                        {childSummary.name}'s Progress
                      </h1>
                      <p className="text-[10px] text-muted-foreground">{childSummary.email}</p>
                    </div>
                  </div>

                  {/* Quick Stats Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-background border border-border p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Dumbbell size={12} className="text-primary" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Lifts Logged</span>
                      </div>
                      <span className="text-xl font-mono font-bold text-foreground">{childSummary.totalLogs}</span>
                    </div>
                    <div className="bg-background border border-border p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Calendar size={12} className="text-primary" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Sessions</span>
                      </div>
                      <span className="text-xl font-mono font-bold text-foreground">{childSummary.workoutCount}</span>
                    </div>
                    <div className="bg-background border border-border p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <TrendingUp size={12} className="text-primary" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Exercises</span>
                      </div>
                      <span className="text-xl font-mono font-bold text-foreground">{childSummary.recentLifts.length}</span>
                    </div>
                    <div className="bg-background border border-border p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Activity size={12} className="text-primary" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Last Active</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-foreground">
                        {childSummary.lastLogDate
                          ? new Date(childSummary.lastLogDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Recent Lifts */}
                  {childSummary.recentLifts.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Dumbbell size={11} /> Recent Lifts
                      </h3>
                      <div className="space-y-1">
                        {childSummary.recentLifts.map((lift, i) => (
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

                  {/* Recovery Snapshot */}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Activity size={11} /> Latest Recovery Check-In
                    </h3>
                    {childSummary.latestRecovery ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <RecoveryMetric
                          icon={<Moon size={14} className="text-[hsl(220,70%,55%)]" />}
                          label="Sleep"
                          value={childSummary.latestRecovery.sleep_hours != null ? `${childSummary.latestRecovery.sleep_hours}h` : "—"}
                          status={getStatus(childSummary.latestRecovery.sleep_hours, 7, 5)}
                        />
                        <RecoveryMetric
                          icon={<Moon size={14} className="text-[hsl(270,50%,55%)]" />}
                          label="Sleep Quality"
                          value={childSummary.latestRecovery.sleep_quality != null ? `${childSummary.latestRecovery.sleep_quality}/10` : "—"}
                          status={getStatus(childSummary.latestRecovery.sleep_quality, 7, 4)}
                        />
                        <RecoveryMetric
                          icon={<AlertTriangle size={14} className="text-[hsl(0,60%,50%)]" />}
                          label="Soreness"
                          value={childSummary.latestRecovery.soreness != null ? `${childSummary.latestRecovery.soreness}/10` : "—"}
                          status={getStatusInverted(childSummary.latestRecovery.soreness, 3, 7)}
                        />
                        <RecoveryMetric
                          icon={<Zap size={14} className="text-[hsl(140,60%,45%)]" />}
                          label="Energy"
                          value={childSummary.latestRecovery.energy != null ? `${childSummary.latestRecovery.energy}/10` : "—"}
                          status={getStatus(childSummary.latestRecovery.energy, 7, 4)}
                        />
                      </div>
                    ) : (
                      <div className="bg-background border border-border p-4 text-center">
                        <p className="text-xs text-muted-foreground">No recovery data logged yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recovery Chart (full timeline) */}
                <RecoveryChart userId={childId} />
              </div>
            ) : (
              <div className="bg-card border border-border p-8 text-center mb-6">
                <Shield size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Unable to load child data. Make sure this account is linked to yours.</p>
              </div>
            )}
          </>
        )}

        {/* Admin client selector */}
        {isAdmin && !adminLoading && !childId && (
          <div className="mb-6 p-4 bg-card border border-border">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              Admin — Select Client
            </span>
            {loadingClients ? (
              <Loader2 size={16} className="text-primary animate-spin" />
            ) : (
              <div className="flex items-center gap-3">
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="bg-background border border-border text-foreground text-sm px-3 h-9 font-mono focus:ring-1 focus:ring-primary outline-none flex-1 max-w-xs"
                >
                  <option value="">My Progress</option>
                  {clients.map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {selectedClient && (
                  <button
                    onClick={() => setSelectedClient("")}
                    className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-widest"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main Progress Charts */}
        <ProgressCharts
          targetUserId={effectiveTargetId}
          targetUserName={effectiveTargetName}
        />
      </div>
    </div>
  );
};

/* ---------- Helper components ---------- */

const RecoveryMetric = ({
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
};

function getStatus(val: number | null, good: number, bad: number): "good" | "ok" | "concern" | "none" {
  if (val == null) return "none";
  if (val >= good) return "good";
  if (val <= bad) return "concern";
  return "ok";
}

function getStatusInverted(val: number | null, good: number, bad: number): "good" | "ok" | "concern" | "none" {
  if (val == null) return "none";
  if (val <= good) return "good";
  if (val >= bad) return "concern";
  return "ok";
}

export default Progress;
