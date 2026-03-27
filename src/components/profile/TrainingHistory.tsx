import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dumbbell, TrendingUp, BarChart3, Flame, Brain, Loader2,
  RefreshCw, Activity, Moon, Zap, Target, Calendar, Trophy, Award
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area,
} from "recharts";
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
const CACHE_TTL = 1000 * 60 * 30;

const PIE_COLORS = [
  "hsl(24, 95%, 53%)",   // primary orange
  "hsl(200, 70%, 50%)",  // blue
  "hsl(140, 60%, 45%)",  // green
  "hsl(280, 55%, 55%)",  // purple
  "hsl(45, 90%, 55%)",   // gold
  "hsl(340, 65%, 50%)",  // rose
  "hsl(170, 60%, 45%)",  // teal
  "hsl(20, 80%, 60%)",   // coral
];

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 text-xs font-mono bg-card border border-border rounded-lg shadow-lg">
      {label && <p className="text-muted-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-bold">
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

const StatCard = ({ icon: Icon, value, label, color }: { icon: any; value: string | number; label: string; color?: string }) => (
  <div className="bg-card border border-border rounded-xl p-3 text-center hover:border-primary/30 transition-colors">
    <Icon size={16} className={color || "text-primary"} style={{ margin: "0 auto 4px" }} />
    <p className="text-xl font-mono font-black text-foreground">{value}</p>
    <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">{label}</p>
  </div>
);

const TrainingHistory = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAllPRs, setShowAllPRs] = useState(false);

  const fetchData = useCallback(async (force = false) => {
    if (!user) return;
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
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
      } catch { /* ignore */ }
    } catch (e: any) {
      toast.error(e.message || "Failed to load training history");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatTonnage = (lbs: number) => {
    if (lbs >= 1000000) return `${(lbs / 1000000).toFixed(1)}M`;
    if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}K`;
    return lbs.toString();
  };

  // Pie chart data for focus area distribution
  const pieData = useMemo(() => {
    if (!stats?.focusAreaDistribution?.length) return [];
    const top = stats.focusAreaDistribution.slice(0, 8);
    return top.map((fa) => ({ name: fa.area, value: fa.count }));
  }, [stats]);

  // Bar chart for top PRs
  const prBarData = useMemo(() => {
    if (!stats?.prs?.length) return [];
    return stats.prs.slice(0, 8).map((pr) => ({
      name: pr.exercise.length > 12 ? pr.exercise.slice(0, 12) + "…" : pr.exercise,
      weight: Math.round(pr.maxWeight),
      est1rm: Math.round(pr.max1rm),
    }));
  }, [stats]);

  // Radar chart for recovery
  const radarData = useMemo(() => {
    if (!stats?.recovery || stats.recovery.totalRecoveryLogs === 0) return [];
    return [
      { metric: "Sleep", value: (stats.recovery.avgSleepHours / 10) * 100, fullMark: 100 },
      { metric: "Energy", value: (stats.recovery.avgEnergy / 5) * 100, fullMark: 100 },
      { metric: "Low Soreness", value: ((5 - stats.recovery.avgSoreness) / 5) * 100, fullMark: 100 },
      { metric: "Consistency", value: Math.min((stats.avgSessionsPerWeek / 6) * 100, 100), fullMark: 100 },
      { metric: "Streak", value: Math.min((stats.currentStreak / 14) * 100, 100), fullMark: 100 },
    ];
  }, [stats]);

  // Volume distribution for area chart
  const volumeByLift = useMemo(() => {
    if (!stats?.prs?.length) return [];
    return stats.prs.slice(0, 10).map((pr) => ({
      name: pr.exercise.length > 10 ? pr.exercise.slice(0, 10) + "…" : pr.exercise,
      sessions: pr.count,
    }));
  }, [stats]);

  const visiblePRs = showAllPRs ? stats?.prs : stats?.prs?.slice(0, 6);

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
      {/* Header */}
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

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard icon={Calendar} value={stats.totalWorkouts} label="Workouts" />
        <StatCard icon={TrendingUp} value={formatTonnage(stats.totalTonnageLbs)} label="Total Lbs" />
        <StatCard icon={Flame} value={stats.currentStreak} label="Day Streak" color="text-orange-400" />
        <StatCard icon={Target} value={stats.avgSessionsPerWeek} label="Avg/Week" />
      </div>

      {/* Extended Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
          <p className="text-lg font-mono font-bold text-foreground">{stats.totalSets.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Total Sets</p>
        </div>
        <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
          <p className="text-lg font-mono font-bold text-foreground">{stats.totalReps.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Total Reps</p>
        </div>
        <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
          <p className="text-lg font-mono font-bold text-foreground">{stats.longestStreak}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Best Streak</p>
        </div>
      </div>

      {/* ========== CHARTS SECTION ========== */}

      {/* Focus Area Pie Chart + Legend */}
      {pieData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
            <BarChart3 size={12} /> Training Focus Distribution
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-1/2" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {pieData.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-[11px] text-foreground capitalize truncate">{item.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PR Bar Chart */}
      {prBarData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
            <Trophy size={12} /> Top Lifts Comparison
          </h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prBarData} barGap={2}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="weight" name="Max Weight" fill="hsl(24, 95%, 53%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="est1rm" name="Est 1RM" fill="hsl(200, 70%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "hsl(24, 95%, 53%)" }} />
              <span className="text-[10px] text-muted-foreground">Max Weight</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "hsl(200, 70%, 50%)" }} />
              <span className="text-[10px] text-muted-foreground">Est 1RM</span>
            </div>
          </div>
        </div>
      )}

      {/* Training Volume Area Chart */}
      {volumeByLift.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
            <Activity size={12} /> Sessions Per Lift
          </h3>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeByLift}>
                <defs>
                  <linearGradient id="sessionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={45}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="sessions"
                  name="Sessions"
                  stroke="hsl(24, 95%, 53%)"
                  strokeWidth={2}
                  fill="url(#sessionGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recovery Radar */}
      {radarData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
            <Activity size={12} /> Recovery & Readiness Profile
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-1/2" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius={70}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "monospace" }}
                  />
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke="hsl(140, 60%, 45%)"
                    fill="hsl(140, 60%, 45%)"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <Moon size={16} className="text-blue-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-mono font-bold text-foreground">{stats.recovery.avgSleepHours}h</p>
                  <p className="text-[9px] text-muted-foreground uppercase">Avg Sleep</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Activity size={16} className="text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-mono font-bold text-foreground">{stats.recovery.avgSoreness}/5</p>
                  <p className="text-[9px] text-muted-foreground uppercase">Avg Soreness</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Zap size={16} className="text-emerald-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-mono font-bold text-foreground">{stats.recovery.avgEnergy}/5</p>
                  <p className="text-[9px] text-muted-foreground uppercase">Avg Energy</p>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground">
                Based on {stats.recovery.totalRecoveryLogs} recovery logs
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All-Time PRs List */}
      {stats.prs.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
            <Award size={12} /> All-Time PRs
          </h3>
          <div className="space-y-1.5">
            {visiblePRs?.map((pr, i) => (
              <div key={i} className="flex items-center gap-3 bg-muted/30 rounded-lg p-2.5 text-xs">
                <span className="text-primary font-mono font-bold w-5 text-right shrink-0">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-foreground block truncate">{pr.exercise}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {pr.count} sessions · {pr.firstDate?.split("T")[0]} → {pr.lastDate?.split("T")[0]}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-primary block">{Math.round(pr.maxWeight)} lbs</span>
                  {pr.max1rm > 0 && (
                    <span className="text-[10px] text-muted-foreground">est 1RM: {Math.round(pr.max1rm)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {stats.prs.length > 6 && (
            <button
              onClick={() => setShowAllPRs(!showAllPRs)}
              className="mt-3 w-full text-xs font-bold text-primary hover:text-primary/80 transition-colors py-2 rounded-lg bg-primary/5 hover:bg-primary/10"
            >
              {showAllPRs ? "Show Less" : `Show All ${stats.prs.length} Lifts`}
            </button>
          )}
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
