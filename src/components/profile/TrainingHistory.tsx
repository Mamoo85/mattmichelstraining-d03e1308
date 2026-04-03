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

const NEON_COLORS = [
  "hsl(24, 100%, 55%)",   // neon orange
  "hsl(190, 100%, 50%)",  // neon cyan
  "hsl(140, 90%, 50%)",   // neon green
  "hsl(280, 90%, 60%)",   // neon purple
  "hsl(45, 100%, 55%)",   // neon gold
  "hsl(340, 100%, 55%)",  // neon rose
  "hsl(170, 90%, 45%)",   // neon teal
  "hsl(200, 100%, 55%)",  // neon blue
];

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 text-xs font-mono rounded-lg shadow-xl" style={{ background: "rgba(15,15,15,0.95)", border: "1px solid rgba(249,115,22,0.3)" }}>
      {label && <p style={{ color: "#f97316" }} className="mb-1 font-bold">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-bold">
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

const NeonStatCard = ({ icon: Icon, value, label, color, glow }: { icon: any; value: string | number; label: string; color: string; glow?: boolean }) => (
  <div
    className="rounded-xl p-3 text-center transition-all hover:scale-[1.02]"
    style={{
      background: `linear-gradient(160deg, ${color}15, rgba(10,10,10,0.9))`,
      border: `1px solid ${color}40`,
      boxShadow: glow ? `0 0 16px ${color}20, inset 0 0 12px ${color}08` : undefined,
    }}
  >
    <Icon size={16} style={{ color, margin: "0 auto 6px" }} />
    <p className="text-2xl font-mono font-black" style={{ color: "#fafafa" }}>{value}</p>
    <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: `${color}cc` }}>{label}</p>
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

  const pieData = useMemo(() => {
    if (!stats?.focusAreaDistribution?.length) return [];
    return stats.focusAreaDistribution.slice(0, 8).map((fa) => ({ name: fa.area, value: fa.count }));
  }, [stats]);

  const prBarData = useMemo(() => {
    if (!stats?.prs?.length) return [];
    return stats.prs.slice(0, 8).map((pr) => ({
      name: pr.exercise.length > 12 ? pr.exercise.slice(0, 12) + "…" : pr.exercise,
      weight: Math.round(pr.maxWeight),
      est1rm: Math.round(pr.max1rm),
    }));
  }, [stats]);

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
        <Loader2 size={24} className="animate-spin" style={{ color: "#f97316" }} />
        <p className="text-xs" style={{ color: "#f9731680" }}>Analyzing your complete training history…</p>
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
    <div className="space-y-4">
      {/* Header with neon orange accent */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2" style={{ color: "#f97316" }}>
          <Brain size={14} />
          <span>AI Training Analysis</span>
          <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
        </h2>
        <button
          onClick={() => fetchData(true)}
          disabled={loading}
          className="flex items-center gap-1.5 text-[10px] font-bold hover:opacity-80 transition-colors disabled:opacity-50"
          style={{ color: "#f97316" }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? "Analyzing…" : "Refresh"}
        </button>
      </div>

      {/* Hero Stats Grid — neon glow cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <NeonStatCard icon={Calendar} value={stats.totalWorkouts} label="Workouts" color="#f97316" glow />
        <NeonStatCard icon={TrendingUp} value={formatTonnage(stats.totalTonnageLbs)} label="Total Lbs" color="#06b6d4" glow />
        <NeonStatCard icon={Flame} value={stats.currentStreak} label="Day Streak" color="#f43f5e" glow />
        <NeonStatCard icon={Target} value={stats.avgSessionsPerWeek} label="Avg/Week" color="#a855f7" glow />
      </div>

      {/* Extended Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <NeonStatCard icon={Dumbbell} value={stats.totalSets.toLocaleString()} label="Total Sets" color="#3b82f6" />
        <NeonStatCard icon={Activity} value={stats.totalReps.toLocaleString()} label="Total Reps" color="#22c55e" />
        <NeonStatCard icon={Trophy} value={stats.longestStreak} label="Best Streak" color="#eab308" />
      </div>

      {/* ========== CHARTS SECTION ========== */}

      {/* Focus Area Pie Chart */}
      {pieData.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "linear-gradient(160deg, rgba(249,115,22,0.08), rgba(10,10,10,0.95))",
            border: "1px solid rgba(249,115,22,0.25)",
            boxShadow: "0 0 20px rgba(249,115,22,0.08)",
          }}
        >
          <h3 className="text-[11px] font-black uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "#f97316" }}>
            <BarChart3 size={14} /> Training Focus Distribution
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
                      <Cell key={i} fill={NEON_COLORS[i % NEON_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2">
              {pieData.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: NEON_COLORS[i % NEON_COLORS.length], boxShadow: `0 0 6px ${NEON_COLORS[i % NEON_COLORS.length]}40` }} />
                  <span className="text-xs text-foreground capitalize truncate font-semibold">{item.name}</span>
                  <span className="text-[11px] font-mono ml-auto font-bold" style={{ color: NEON_COLORS[i % NEON_COLORS.length] }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PR Bar Chart */}
      {prBarData.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "linear-gradient(160deg, rgba(6,182,212,0.06), rgba(10,10,10,0.95))",
            border: "1px solid rgba(6,182,212,0.2)",
            boxShadow: "0 0 20px rgba(6,182,212,0.06)",
          }}
        >
          <h3 className="text-[11px] font-black uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "#06b6d4" }}>
            <Trophy size={14} /> Top Lifts Comparison
          </h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prBarData} barGap={2}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 9, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="weight" name="Max Weight" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="est1rm" name="Est 1RM" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: "#f97316", boxShadow: "0 0 6px #f9731640" }} />
              <span className="text-[11px] font-bold" style={{ color: "#f97316" }}>Max Weight</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: "#06b6d4", boxShadow: "0 0 6px #06b6d440" }} />
              <span className="text-[11px] font-bold" style={{ color: "#06b6d4" }}>Est 1RM</span>
            </div>
          </div>
        </div>
      )}

      {/* Sessions Per Lift Area Chart */}
      {volumeByLift.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "linear-gradient(160deg, rgba(249,115,22,0.06), rgba(10,10,10,0.95))",
            border: "1px solid rgba(249,115,22,0.2)",
          }}
        >
          <h3 className="text-[11px] font-black uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "#f97316" }}>
            <Activity size={14} /> Sessions Per Lift
          </h3>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeByLift}>
                <defs>
                  <linearGradient id="sessionGradNeon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 9, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={45}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="sessions"
                  name="Sessions"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#sessionGradNeon)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recovery Radar */}
      {radarData.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "linear-gradient(160deg, rgba(34,197,94,0.06), rgba(10,10,10,0.95))",
            border: "1px solid rgba(34,197,94,0.2)",
          }}
        >
          <h3 className="text-[11px] font-black uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "#22c55e" }}>
            <Zap size={14} /> Recovery & Readiness Profile
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-1/2" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius={70}>
                  <PolarGrid stroke="rgba(34,197,94,0.15)" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "monospace" }}
                  />
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <Moon size={18} style={{ color: "#3b82f6" }} />
                <div className="flex-1">
                  <p className="text-base font-mono font-black text-foreground">{stats.recovery.avgSleepHours}h</p>
                  <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#3b82f680" }}>Avg Sleep</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.15)" }}>
                <Activity size={18} style={{ color: "#eab308" }} />
                <div className="flex-1">
                  <p className="text-base font-mono font-black text-foreground">{stats.recovery.avgSoreness}/5</p>
                  <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#eab30880" }}>Avg Soreness</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                <Zap size={18} style={{ color: "#22c55e" }} />
                <div className="flex-1">
                  <p className="text-base font-mono font-black text-foreground">{stats.recovery.avgEnergy}/5</p>
                  <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#22c55e80" }}>Avg Energy</p>
                </div>
              </div>
              <p className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
                Based on <span className="font-bold text-foreground">{stats.recovery.totalRecoveryLogs}</span> recovery logs
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All-Time PRs */}
      {stats.prs.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "linear-gradient(160deg, rgba(168,85,247,0.06), rgba(10,10,10,0.95))",
            border: "1px solid rgba(168,85,247,0.2)",
          }}
        >
          <h3 className="text-[11px] font-black uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "#a855f7" }}>
            <Award size={14} /> All-Time PRs
          </h3>
          <div className="space-y-1.5">
            {visiblePRs?.map((pr, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg p-3 text-xs transition-all hover:scale-[1.01]"
                style={{
                  background: i === 0 ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${i === 0 ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <span className="font-mono font-black w-6 text-right shrink-0" style={{ color: i < 3 ? "#f97316" : "#a855f7" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-foreground block truncate text-sm">{pr.exercise}</span>
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                    • {pr.count} sessions • {pr.firstDate?.split("T")[0]} → {pr.lastDate?.split("T")[0]}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-black text-sm block" style={{ color: "#f97316" }}>{Math.round(pr.maxWeight)} lbs</span>
                  {pr.max1rm > 0 && (
                    <span className="text-[10px] font-mono" style={{ color: "#06b6d4" }}>1RM: {Math.round(pr.max1rm)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {stats.prs.length > 6 && (
            <button
              onClick={() => setShowAllPRs(!showAllPRs)}
              className="mt-3 w-full text-xs font-bold py-2.5 rounded-lg transition-all"
              style={{
                color: "#a855f7",
                background: "rgba(168,85,247,0.08)",
                border: "1px solid rgba(168,85,247,0.2)",
              }}
            >
              {showAllPRs ? "Show Less" : `Show All ${stats.prs.length} Lifts →`}
            </button>
          )}
        </div>
      )}

      {/* AI Analysis */}
      {analysis && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "linear-gradient(160deg, rgba(249,115,22,0.08), rgba(10,10,10,0.95))",
            border: "1px solid rgba(249,115,22,0.3)",
            boxShadow: "0 0 24px rgba(249,115,22,0.08)",
          }}
        >
          <h3 className="text-[11px] font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: "#f97316" }}>
            <Brain size={14} /> Coach Matt's Analysis
          </h3>
          <div className="prose prose-sm prose-invert max-w-none text-foreground
            [&_h2]:text-sm [&_h2]:font-black [&_h2]:uppercase [&_h2]:tracking-widest [&_h2]:mt-5 [&_h2]:mb-2
            [&_h3]:text-xs [&_h3]:font-black [&_h3]:uppercase [&_h3]:tracking-widest [&_h3]:mt-4 [&_h3]:mb-2
            [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-3
            [&_strong]:text-foreground
            [&_ul]:text-sm [&_ul]:space-y-2 [&_ul]:mb-3
            [&_li]:text-sm [&_li]:leading-relaxed
            [&_ol]:text-sm [&_ol]:space-y-2 [&_ol]:mb-3
          " style={{ 
            ['--tw-prose-body' as any]: "rgba(255,255,255,0.7)",
            ['--tw-prose-headings' as any]: "#f97316",
            ['--tw-prose-strong' as any]: "#fafafa",
            ['--tw-prose-bullets' as any]: "#f97316",
            ['--tw-prose-counters' as any]: "#f97316",
          }}>
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Member Since */}
      <div className="text-center pt-3 pb-1">
        <p className="text-[11px] font-mono" style={{ color: "rgba(249,115,22,0.5)" }}>
          M² member since{" "}
          <span className="font-bold" style={{ color: "#f97316" }}>
            {stats.memberSince ? new Date(stats.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
          </span>
          {" · "}
          <span className="font-bold" style={{ color: "#06b6d4" }}>{stats.weeksActive}</span> weeks of training data
        </p>
      </div>
    </div>
  );
};

export default TrainingHistory;
