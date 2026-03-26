import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import SectionHeader from "@/components/shared/SectionHeader";
import { Loader2, TrendingUp } from "lucide-react";
import { LIFT_CATEGORIES, ALL_LIFTS, getLiftConfig } from "@/components/progress/liftConfig";
import TronChart from "@/components/progress/TronChart";
import BodyAvatar from "@/components/progress/BodyAvatar";
import LogForm from "@/components/progress/LogForm";
import StatsRow from "@/components/progress/StatsRow";
import LogHistory from "@/components/progress/LogHistory";
import RecoveryChart from "@/components/progress/RecoveryChart";
import AiRecoveryAdvisor from "@/components/progress/AiRecoveryAdvisor";
import LiftInsights from "@/components/progress/LiftInsights";
import EmptyStateCard from "@/components/shared/EmptyStateCard";

interface ProgressLog {
  id: string;
  weight: number;
  reps: number;
  estimated_1rm: number | null;
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
  const [data, setData] = useState<{ date: string; value: number }[]>([]);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveUserId = targetUserId || user?.id;
  const config = getLiftConfig(activeLift);
  const repMax = config?.repMax ?? 3;

  const fetchData = useCallback(async () => {
    if (!effectiveUserId) { setLoading(false); return; }
    setLoading(true);
    const { data: rawLogs } = await supabase
      .from("progress_logs")
      .select("id, weight, reps, estimated_1rm, logged_at")
      .eq("user_id", effectiveUserId)
      .eq("exercise_name", activeLift)
      .order("logged_at");
    if (rawLogs) {
      setLogs(rawLogs);
      setData(
        rawLogs.map((l) => ({
          date: new Date(l.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          value: Math.round(l.weight),
        }))
      );
    }
    setLoading(false);
  }, [effectiveUserId, activeLift]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const current = data.length > 0 ? data[data.length - 1].value : 0;
  const previous = data.length > 1 ? data[data.length - 2].value : current;
  const delta = Math.round(current - previous);
  const max = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 0;

  return (
    <div>
      <SectionHeader
        title={targetUserName ? `${targetUserName} — Lift Tracker` : "Lift Tracker"}
        timestamp={targetUserId ? "Admin view — logging for this client" : "Track your maxes and watch them climb"}
      />

      {/* Lift category selector */}
      {LIFT_CATEGORIES.map((cat) => (
        <div key={cat.label} className="mb-4">
          <span className="text-xs font-mono font-bold uppercase tracking-widest mb-2 block text-primary">
            {cat.label}
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {cat.lifts.map((lift) => (
              <button
                key={lift.name}
                onClick={() => setActiveLift(lift.name)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all duration-300 rounded ${
                  activeLift === lift.name
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {lift.name}
                <span className="ml-1 opacity-50">
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
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="text-primary animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <EmptyStateCard
          icon={<TrendingUp size={32} className="text-primary" />}
          title={`No ${activeLift} Data Yet`}
          description="Log your first set above and watch your progression chart build over time. Every rep gets tracked — Matt reviews your numbers weekly."
          ctaLabel="Log Your First Set ↑"
          ctaTo="/dashboard"
        />
      ) : (
        <>
          {/* Stats */}
          <StatsRow current={current} delta={delta} max={max} repMax={repMax} />

          {/* Chart + Avatar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <TronChart data={data} repMax={repMax} />
            </div>
            <div>
              <BodyAvatar activeLift={activeLift} />
            </div>
          </div>

          {/* Lift Insights */}
          <LiftInsights logs={logs} liftName={activeLift} />
        </>
      )}

      {/* Log History */}
      {effectiveUserId && (
        <LogHistory
          logs={logs}
          isAdmin={isAdmin}
          effectiveUserId={effectiveUserId}
          onRefresh={fetchData}
        />
      )}

      {/* Recovery trends */}
      {effectiveUserId && <RecoveryChart userId={effectiveUserId} />}

      {/* Recovery Advisor */}
      {effectiveUserId && <AiRecoveryAdvisor userId={effectiveUserId} />}
    </div>
  );
};

export default ProgressCharts;
