import { useState, useEffect, useCallback } from "react";
import {
  Dumbbell, TrendingUp, BarChart3, Flame, Brain, Loader2,
  RefreshCw, Activity, Moon, Zap, Target, Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface PREntry {
  exercise: string;
  maxWeight: number;
  maxReps: number;
  max1rm: number;
  count: number;
  firstDate: string;
  lastDate: string;
}

interface FocusArea {
  area: string;
  count: number;
}

interface Stats {
  totalWorkouts: number;
  totalSets: number;
  totalReps: number;
  totalTonnageLbs: number;
  avgSessionsPerWeek: number;
  longestStreak: number;
  currentStreak: number;
  weeksActive: number;
  prs: PREntry[];
  focusAreaDistribution: FocusArea[];
  recovery: {
    avgSleepHours: number;
    avgSoreness: number;
    avgEnergy: number;
    totalRecoveryLogs: number;
  };
  memberSince: string;
  athleteName: string;
}

const CACHE_KEY = "m2-training-history-cache";
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

const TrainingHistory = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAllPRs, setShowAllPRs] = useState(false);

  const fetchData = useCallback(async (force = false) => {
    if (!user) return;

    // Check cache first
    if (!force) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            setStats(data.stats);
            setAnalysis(data.analysis);
            return;
          }
        }
      } catch { /* ignore */ }
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-training-history");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStats(data.stats);
      setAnalysis(data.analysis);

      // Cache result
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
      } catch { /* ignore */ }
    } catch (e: any) {
      toast.error(e.message || "Failed to load training history");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatTonnage = (lbs: number) => {
    if (lbs >= 1000000) return `${(lbs / 1000000).toFixed(1)}M`;
    if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}K`;
    return lbs.toString();
  };

  const maxFocusCount = stats?.focusAreaDistribution?.[0]?.count || 1;
  const visiblePRs = showAllPRs ? stats?.prs : stats?.prs?.slice(0, 8);

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={24} className="animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Analyzing your complete training history…</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-16">
        <Dumbbell size={32} className="text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-sm text-muted-foreground">No training data yet. Start logging workouts to see your history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Refresh button */}
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
          <Brain size={12} /> AI Training Analysis
        </h2>
        <button
          onClick={() => fetchData(true)}
          disabled={loading}
          className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? "Analyzing…" : "Refresh"}
        </button>
      </div>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-card border border-border p-3 text-center">
          <Calendar size={14} className="text-primary mx-auto mb-1" />
          <p className="text-xl font-mono font-bold text-foreground">{stats.totalWorkouts}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Workouts</p>
        </div>
        <div className="bg-card border border-border p-3 text-center">
          <TrendingUp size={14} className="text-primary mx-auto mb-1" />
          <p className="text-xl font-mono font-bold text-foreground">{formatTonnage(stats.totalTonnageLbs)}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Total Lbs</p>
        </div>
        <div className="bg-card border border-border p-3 text-center">
          <Flame size={14} className="text-primary mx-auto mb-1" />
          <p className="text-xl font-mono font-bold text-foreground">{stats.currentStreak}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Day Streak</p>
        </div>
        <div className="bg-card border border-border p-3 text-center">
          <Target size={14} className="text-primary mx-auto mb-1" />
          <p className="text-xl font-mono font-bold text-foreground">{stats.avgSessionsPerWeek}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Avg/Week</p>
        </div>
      </div>

      {/* Extended Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted/30 border border-white/[0.06] rounded-xl p-3 text-center">
          <p className="text-lg font-mono font-bold text-foreground">{stats.totalSets.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Total Sets</p>
        </div>
        <div className="bg-muted/30 border border-white/[0.06] rounded-xl p-3 text-center">
          <p className="text-lg font-mono font-bold text-foreground">{stats.totalReps.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Total Reps</p>
        </div>
        <div className="bg-muted/30 border border-white/[0.06] rounded-xl p-3 text-center">
          <p className="text-lg font-mono font-bold text-foreground">{stats.longestStreak}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Best Streak</p>
        </div>
      </div>

      {/* Recovery Averages */}
      {stats.recovery.totalRecoveryLogs > 0 && (
        <div className="bg-card border border-border p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
            <Activity size={12} /> Recovery Averages
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <Moon size={14} className="text-blue-400 mx-auto mb-1" />
              <p className="text-lg font-mono font-bold text-foreground">{stats.recovery.avgSleepHours}h</p>
              <p className="text-[9px] text-muted-foreground uppercase">Avg Sleep</p>
            </div>
            <div className="text-center">
              <Activity size={14} className="text-amber-400 mx-auto mb-1" />
              <p className="text-lg font-mono font-bold text-foreground">{stats.recovery.avgSoreness}/5</p>
              <p className="text-[9px] text-muted-foreground uppercase">Avg Soreness</p>
            </div>
            <div className="text-center">
              <Zap size={14} className="text-emerald-400 mx-auto mb-1" />
              <p className="text-lg font-mono font-bold text-foreground">{stats.recovery.avgEnergy}/5</p>
              <p className="text-[9px] text-muted-foreground uppercase">Avg Energy</p>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground text-center mt-2">
            Based on {stats.recovery.totalRecoveryLogs} recovery logs
          </p>
        </div>
      )}

      {/* All-Time PRs */}
      {stats.prs.length > 0 && (
        <div className="bg-card border border-border p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
            <TrendingUp size={12} /> All-Time PRs
          </h3>
          <div className="space-y-1.5">
            {visiblePRs?.map((pr, i) => (
              <div key={i} className="flex items-center gap-3 bg-muted/30 rounded-lg p-2.5 text-xs">
                <span className="text-primary font-mono font-bold w-5 text-right shrink-0">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-foreground block truncate">{pr.exercise}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {pr.count} sessions · {pr.firstDate?.split("T")[0]} → {pr.lastDate?.split("T")[0]}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-primary block">{Math.round(pr.maxWeight)} lbs</span>
                  {pr.max1rm > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      est 1RM: {Math.round(pr.max1rm)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {stats.prs.length > 8 && (
            <button
              onClick={() => setShowAllPRs(!showAllPRs)}
              className="mt-2 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
            >
              {showAllPRs ? "Show Less" : `Show All ${stats.prs.length} Lifts`}
            </button>
          )}
        </div>
      )}

      {/* Body Part Balance */}
      {stats.focusAreaDistribution.length > 0 && (
        <div className="bg-card border border-border p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
            <BarChart3 size={12} /> Training Balance
          </h3>
          <div className="space-y-2">
            {stats.focusAreaDistribution.slice(0, 10).map((fa, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold text-foreground capitalize">{fa.area}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{fa.count} sets</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(fa.count / maxFocusCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Analysis */}
      {analysis && (
        <div className="bg-card border border-primary/20 p-5 rounded-xl">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-1.5">
            <Brain size={12} /> Coach Matt's Analysis
          </h3>
          <div className="prose prose-sm prose-invert max-w-none text-foreground
            [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-primary [&_h2]:uppercase [&_h2]:tracking-widest [&_h2]:mt-4 [&_h2]:mb-2
            [&_h3]:text-xs [&_h3]:font-bold [&_h3]:text-primary [&_h3]:uppercase [&_h3]:tracking-widest [&_h3]:mt-3 [&_h3]:mb-1
            [&_p]:text-xs [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:mb-2
            [&_strong]:text-foreground
            [&_ul]:text-xs [&_ul]:text-muted-foreground [&_ul]:space-y-1
            [&_li]:text-xs [&_li]:text-muted-foreground
            [&_ol]:text-xs [&_ol]:text-muted-foreground [&_ol]:space-y-1
          ">
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Member Since */}
      <p className="text-center text-[10px] text-muted-foreground pt-2">
        M² member since {stats.memberSince ? new Date(stats.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
        {" · "}{stats.weeksActive} weeks of training data
      </p>
    </div>
  );
};

export default TrainingHistory;
