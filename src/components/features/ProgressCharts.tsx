import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import SectionHeader from "@/components/shared/SectionHeader";
import { Loader2, TrendingUp } from "lucide-react";
import { LIFT_CATEGORIES, ALL_LIFTS, getLiftConfig } from "@/components/progress/liftConfig";
import StatsRow from "@/components/progress/StatsRow";
import LogForm from "@/components/progress/LogForm";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import { lazyRetry } from "@/lib/lazyRetry";

// Lazy-load heavy chart components — Recharts is ~95KB gz, body maps + heatmap render off-screen
const TronChart = lazyRetry(() => import("@/components/progress/TronChart"));
const BodyAvatar = lazyRetry(() => import("@/components/progress/BodyAvatar"));
const BodyProgressMap = lazyRetry(() => import("@/components/progress/BodyProgressMap"));
const VolumeChart = lazyRetry(() => import("@/components/progress/VolumeChart"));
const StreakHeatmap = lazyRetry(() => import("@/components/progress/StreakHeatmap"));
const LogHistory = lazyRetry(() => import("@/components/progress/LogHistory"));
const RecoveryChart = lazyRetry(() => import("@/components/progress/RecoveryChart"));
const AiRecoveryAdvisor = lazyRetry(() => import("@/components/progress/AiRecoveryAdvisor"));
const LiftInsights = lazyRetry(() => import("@/components/progress/LiftInsights"));

const ChartFallback = () => (
  <div className="flex justify-center py-6">
    <Loader2 size={16} className="text-primary animate-spin" />
  </div>
);

interface ProgressLog {
  id: string;
  weight: number;
  reps: number;
  estimated_1rm: number | null;
  logged_at: string;
}

interface AllLog {
  exercise_name: string;
  weight: number;
  reps: number;
  logged_at: string;
}

interface ProgressChartsProps {
  targetUserId?: string;
  targetUserName?: string;
}

const ProgressCharts = ({ targetUserId, targetUserName }: ProgressChartsProps) => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [activeLift, setActiveLift] = useState(ALL_LIFTS[0].name);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [allLogs, setAllLogs] = useState<AllLog[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveUserId = targetUserId || user?.id;
  const config = getLiftConfig(activeLift);
  const repMax = config?.repMax ?? 3;

  const fetchData = useCallback(async () => {
    if (!effectiveUserId) { setLoading(false); return; }
    setLoading(true);

    // Server-side caps: per-lift 90 days, all-lifts last 500 entries (covers ~1 year for active users)
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const [liftRes, allRes] = await Promise.all([
      supabase
        .from("progress_logs")
        .select("id, weight, reps, estimated_1rm, logged_at")
        .eq("user_id", effectiveUserId)
        .eq("exercise_name", activeLift)
        .gte("logged_at", since90)
        .order("logged_at")
        .limit(500),
      supabase
        .from("progress_logs")
        .select("exercise_name, weight, reps, logged_at")
        .eq("user_id", effectiveUserId)
        .order("logged_at", { ascending: false })
        .limit(500),
    ]);

    if (liftRes.data) setLogs(liftRes.data);
    if (allRes.data) setAllLogs(allRes.data as AllLog[]);
    setLoading(false);
  }, [effectiveUserId, activeLift]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Memoize derived chart data so LogForm keystrokes don't re-render charts
  const data = useMemo(
    () => logs.map((l) => ({
      date: new Date(l.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Math.round(l.weight),
    })),
    [logs]
  );

  const stats = useMemo(() => {
    const current = data.length > 0 ? data[data.length - 1].value : 0;
    const previous = data.length > 1 ? data[data.length - 2].value : current;
    const delta = Math.round(current - previous);
    const max = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 0;
    return { current, delta, max };
  }, [data]);

  return (
    <div>
      <SectionHeader
        title={targetUserName ? `${targetUserName} — Lift Tracker` : "Lift Tracker"}
        timestamp={targetUserId ? "Admin view — logging for this client" : "Track your maxes and watch them climb"}
      />

      {/* Lift category selector */}
      {LIFT_CATEGORIES.map((cat) => (
        <div key={cat.label} className="mb-2">
          <span className="text-[9px] font-mono font-bold uppercase tracking-widest mb-1 block text-primary">
            {cat.label}
          </span>
          <div className="flex gap-1 flex-wrap">
            {cat.lifts.map((lift) => (
              <button
                key={lift.name}
                onClick={() => setActiveLift(lift.name)}
                className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-300 rounded ${
                  activeLift === lift.name
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {lift.name}
                <span className="ml-0.5 opacity-50 text-[8px]">
                  {lift.repMax === 1 ? "1RM" : `${lift.repMax}RM`}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Log form */}
      {effectiveUserId && (
        <LogForm
          activeLift={activeLift}
          repMax={repMax}
          effectiveUserId={effectiveUserId}
          onLogged={fetchData}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="text-primary animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <EmptyStateCard
          icon={<TrendingUp size={28} className="text-primary" />}
          title={`No ${activeLift} Data Yet`}
          description="Log your first set above and watch your progression chart build over time."
          ctaLabel="Log Your First Set ↑"
          ctaTo="/dashboard"
        />
      ) : (
        <>
          <StatsRow current={stats.current} delta={stats.delta} max={stats.max} repMax={repMax} />

          {/* Main chart + body avatar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Suspense fallback={<ChartFallback />}>
                <TronChart data={data} repMax={repMax} />
              </Suspense>
            </div>
            <div>
              <Suspense fallback={<ChartFallback />}>
                <BodyAvatar activeLift={activeLift} />
              </Suspense>
            </div>
          </div>

          <Suspense fallback={null}>
            <LiftInsights logs={logs} liftName={activeLift} />
          </Suspense>

          {/* Volume chart */}
          <div className="mt-4">
            <Suspense fallback={<ChartFallback />}>
              <VolumeChart logs={logs} liftName={activeLift} />
            </Suspense>
          </div>
        </>
      )}

      {/* Activity heatmap — always visible if any logs exist */}
      {allLogs.length > 0 && (
        <div className="mt-4" style={{ contentVisibility: "auto", containIntrinsicSize: "300px" } as React.CSSProperties}>
          <Suspense fallback={<ChartFallback />}>
            <StreakHeatmap logs={allLogs} />
          </Suspense>
        </div>
      )}

      {/* Body Progress Heat Map — shows all-lift improvement across muscle groups */}
      {allLogs.length > 2 && (
        <div className="mt-4" style={{ contentVisibility: "auto", containIntrinsicSize: "400px" } as React.CSSProperties}>
          <Suspense fallback={<ChartFallback />}>
            <BodyProgressMap allLogs={allLogs} />
          </Suspense>
        </div>
      )}

      {effectiveUserId && (
        <Suspense fallback={null}>
          <LogHistory
            logs={logs}
            isAdmin={isAdmin}
            effectiveUserId={effectiveUserId}
            onRefresh={fetchData}
          />
        </Suspense>
      )}

      {effectiveUserId && (
        <div style={{ contentVisibility: "auto", containIntrinsicSize: "300px" } as React.CSSProperties}>
          <Suspense fallback={null}>
            <RecoveryChart userId={effectiveUserId} />
          </Suspense>
        </div>
      )}
      {effectiveUserId && (
        <div style={{ contentVisibility: "auto", containIntrinsicSize: "300px" } as React.CSSProperties}>
          <Suspense fallback={null}>
            <AiRecoveryAdvisor userId={effectiveUserId} />
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default ProgressCharts;
