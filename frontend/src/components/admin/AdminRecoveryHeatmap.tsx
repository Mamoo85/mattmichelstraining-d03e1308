import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import RecoveryChart from "@/components/progress/RecoveryChart";

interface AthleteRecovery {
  userId: string;
  name: string;
  tier: string;
  sessions: SessionScore[];
}

interface SessionScore {
  date: string;
  score: number; // 0-10 composite
  sleep: number | null;
  sleepQuality: number | null;
  soreness: number | null;
  energy: number | null;
}

/** Composite score: higher = better recovery (0–10 scale) */
function computeScore(s: { sleep: number | null; sleepQuality: number | null; soreness: number | null; energy: number | null }): number {
  const parts: number[] = [];
  // Sleep hours: 8+ = 10, 6 = 5, <5 = 2
  if (s.sleep != null) parts.push(Math.min(10, Math.max(0, (s.sleep / 8) * 10)));
  // Sleep quality 1-5 → 0-10
  if (s.sleepQuality != null) parts.push((s.sleepQuality / 5) * 10);
  // Soreness 1-5 → inverted (1=great → 10, 5=wrecked → 2)
  if (s.soreness != null) parts.push(Math.max(0, 12 - s.soreness * 2));
  // Energy 1-5 → 0-10
  if (s.energy != null) parts.push((s.energy / 5) * 10);
  if (parts.length === 0) return -1; // no data
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function scoreColor(score: number): string {
  if (score < 0) return "bg-muted/30"; // no data
  if (score >= 7) return "bg-green-600";
  if (score >= 5) return "bg-yellow-500";
  if (score >= 3) return "bg-orange-500";
  return "bg-red-600";
}

function scoreLabel(score: number): string {
  if (score < 0) return "—";
  return score.toFixed(1);
}

const TIER_PRIORITY: Record<string, number> = { team: 4, elite: 3, pro: 2, basic: 1, free: 0 };

const AdminRecoveryHeatmap = () => {
  const [athletes, setAthletes] = useState<AthleteRecovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Get all workout_logs with recovery data (last 60 days)
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("user_id, date, sleep_hours, sleep_quality, soreness, energy")
        .gte("date", sixtyDaysAgo)
        .order("date", { ascending: false });

      if (!logs || logs.length === 0) {
        setAthletes([]);
        setLoading(false);
        return;
      }

      // Filter to only logs with at least one recovery metric
      const recoveryLogs = logs.filter(
        (l: any) => l.sleep_hours || l.sleep_quality || l.soreness || l.energy
      );

      // Group by user
      const userMap = new Map<string, any[]>();
      recoveryLogs.forEach((l: any) => {
        const arr = userMap.get(l.user_id) || [];
        arr.push(l);
        userMap.set(l.user_id, arr);
      });

      if (userMap.size === 0) {
        setAthletes([]);
        setLoading(false);
        return;
      }

      // Get profiles
      const userIds = [...userMap.keys()];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, subscription_tier")
        .in("user_id", userIds);

      const nameMap: Record<string, string> = {};
      const tierMap: Record<string, string> = {};
      profiles?.forEach((p) => {
        nameMap[p.user_id] = p.athlete_name || p.full_name || "Unknown";
        tierMap[p.user_id] = p.subscription_tier || "free";
      });

      const result: AthleteRecovery[] = userIds.map((uid) => {
        const userLogs = userMap.get(uid) || [];
        // Take last 7 sessions
        const last7 = userLogs.slice(0, 7);
        return {
          userId: uid,
          name: nameMap[uid] || "Unknown",
          tier: tierMap[uid] || "free",
          sessions: last7.map((l: any) => ({
            date: l.date,
            score: computeScore({
              sleep: l.sleep_hours ? Number(l.sleep_hours) : null,
              sleepQuality: l.sleep_quality,
              soreness: l.soreness,
              energy: l.energy,
            }),
            sleep: l.sleep_hours ? Number(l.sleep_hours) : null,
            sleepQuality: l.sleep_quality,
            soreness: l.soreness,
            energy: l.energy,
          })),
        };
      });

      // Sort: worst average score first (so coach sees problems), then by tier priority
      result.sort((a, b) => {
        const avgA = a.sessions.filter((s) => s.score >= 0).reduce((sum, s) => sum + s.score, 0) / Math.max(1, a.sessions.filter((s) => s.score >= 0).length);
        const avgB = b.sessions.filter((s) => s.score >= 0).reduce((sum, s) => sum + s.score, 0) / Math.max(1, b.sessions.filter((s) => s.score >= 0).length);
        // Higher tier athletes first when scores are similar
        const tierDiff = (TIER_PRIORITY[b.tier] ?? 0) - (TIER_PRIORITY[a.tier] ?? 0);
        if (Math.abs(avgA - avgB) < 1) return tierDiff;
        return avgA - avgB; // worst first
      });

      setAthletes(result);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-primary" />
      </div>
    );
  }

  if (athletes.length === 0) {
    return (
      <div className="bg-card border border-border p-6 text-center">
        <Activity size={24} className="mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-bold text-foreground">No recovery data yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Athletes will appear here once they log sleep, soreness, or energy in their workouts
        </p>
      </div>
    );
  }

  // Pad sessions to always show 7 columns
  const maxCols = 7;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Team Recovery</h3>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          {athletes.length} athlete{athletes.length !== 1 ? "s" : ""} · last 7 sessions
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Score:</span>
        {[
          { color: "bg-green-600", label: "7+ Good" },
          { color: "bg-yellow-500", label: "5-7 Moderate" },
          { color: "bg-orange-500", label: "3-5 Fatigued" },
          { color: "bg-red-600", label: "<3 Red Flag" },
          { color: "bg-muted/30", label: "No Data" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1">
            <div className={`w-3 h-3 ${l.color}`} />
            <span className="text-[9px] font-mono text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Heatmap Grid */}
      <div className="bg-card border border-border overflow-hidden">
        {/* Header */}
        <div className="grid gap-0.5 px-3 py-2 bg-muted" style={{ gridTemplateColumns: `1fr repeat(${maxCols}, 36px) 28px` }}>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Athlete</span>
          {Array.from({ length: maxCols }, (_, i) => (
            <span key={i} className="text-[8px] font-mono text-muted-foreground text-center">
              {i === 0 ? "Latest" : `-${i}`}
            </span>
          ))}
          <span />
        </div>

        {/* Rows */}
        {athletes.map((a) => {
          const isExpanded = expandedUser === a.userId;
          const paddedSessions = [...a.sessions];
          while (paddedSessions.length < maxCols) paddedSessions.push({ date: "", score: -1, sleep: null, sleepQuality: null, soreness: null, energy: null });

          const avgScore = a.sessions.filter((s) => s.score >= 0);
          const avg = avgScore.length > 0
            ? avgScore.reduce((sum, s) => sum + s.score, 0) / avgScore.length
            : -1;

          return (
            <div key={a.userId}>
              <button
                onClick={() => setExpandedUser(isExpanded ? null : a.userId)}
                className="w-full grid gap-0.5 px-3 py-2 border-b border-border items-center hover:bg-secondary/30 transition-colors"
                style={{ gridTemplateColumns: `1fr repeat(${maxCols}, 36px) 28px` }}
              >
                {/* Name + tier */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-bold text-foreground truncate">{a.name}</span>
                  {a.tier !== "free" && (
                    <span className={`text-[8px] font-bold uppercase tracking-widest px-1 py-0.5 shrink-0 ${
                      a.tier === "custom" || a.tier === "team_elite"
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {a.tier}
                    </span>
                  )}
                </div>

                {/* Heatmap cells */}
                {paddedSessions.slice(0, maxCols).map((s, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 flex items-center justify-center text-[9px] font-mono font-bold text-white ${scoreColor(s.score)}`}
                    title={s.date ? `${s.date}: ${scoreLabel(s.score)}` : "No data"}
                  >
                    {s.score >= 0 ? s.score.toFixed(0) : ""}
                  </div>
                ))}

                {/* Expand arrow */}
                <div className="flex items-center justify-center text-muted-foreground">
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-3 py-3 bg-secondary/20 border-b border-border space-y-3">
                  {/* Quick stats */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Avg Score", value: avg >= 0 ? avg.toFixed(1) : "—", color: avg >= 7 ? "text-green-500" : avg >= 5 ? "text-yellow-500" : avg >= 0 ? "text-red-500" : "text-muted-foreground" },
                      { label: "Avg Sleep", value: (() => { const sl = a.sessions.filter(s => s.sleep != null); return sl.length ? (sl.reduce((sum, s) => sum + (s.sleep || 0), 0) / sl.length).toFixed(1) + "h" : "—"; })(), color: "text-foreground" },
                      { label: "Worst Soreness", value: (() => { const so = a.sessions.filter(s => s.soreness != null).map(s => s.soreness!); return so.length ? Math.max(...so) + "/5" : "—"; })(), color: "text-foreground" },
                      { label: "Sessions", value: String(a.sessions.length), color: "text-foreground" },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-card border border-border p-2 text-center">
                        <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                        <p className={`text-sm font-mono font-bold ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Session detail rows */}
                  <div className="space-y-1">
                    {a.sessions.map((s, i) => (
                      <div key={i} className="grid grid-cols-[70px_1fr_1fr_1fr_1fr] gap-1 text-[10px] font-mono">
                        <span className="text-muted-foreground">
                          {s.date ? new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        </span>
                        <span className="text-foreground">
                          {s.sleep != null ? `😴 ${s.sleep}h` : ""}
                        </span>
                        <span className="text-foreground">
                          {s.sleepQuality != null ? `💤 ${s.sleepQuality}/5` : ""}
                        </span>
                        <span className={s.soreness != null && s.soreness >= 4 ? "text-red-400 font-bold" : "text-foreground"}>
                          {s.soreness != null ? `🔥 ${s.soreness}/5` : ""}
                        </span>
                        <span className={s.energy != null && s.energy <= 2 ? "text-red-400 font-bold" : "text-foreground"}>
                          {s.energy != null ? `⚡ ${s.energy}/5` : ""}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Full chart */}
                  <RecoveryChart userId={a.userId} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminRecoveryHeatmap;
