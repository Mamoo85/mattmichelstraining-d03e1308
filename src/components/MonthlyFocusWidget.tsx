import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Flame, Trophy, Plus, Loader2, Eye, EyeOff, Target, Medal, Award,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

/* ─── Types ────────────────────────────────── */

interface FocusData {
  id: string;
  title: string;
  topic: string;
  reasoning: string;
  biomechanics: string[];
  common_mistakes: string[];
  exercises: string[];
  challenge_metric: string;
  matt_quote: string;
  metric_label: string;
  target_goal: number;
}

interface ChallengeData {
  id: string;
  title: string;
  description: string;
  metric_label: string;
}

interface LeaderboardEntry {
  user_id: string;
  current_value: number;
  athlete_name: string | null;
  full_name: string | null;
  is_public: boolean;
}

/* ─── Custom Tooltip ───────────────────────── */

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur border border-primary/30 px-3 py-2 shadow-lg shadow-primary/10">
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{label}</p>
      <p className="text-sm font-mono font-bold text-foreground">{payload[0].value}</p>
    </div>
  );
};

/* ─── Main Widget ──────────────────────────── */

const MonthlyFocusWidget = () => {
  const { user, subscribed } = useAuth();
  const now = new Date();

  // Focus
  const [focus, setFocus] = useState<FocusData | null>(null);
  const [focusLogs, setFocusLogs] = useState<{ metric_value: number; logged_date: string }[]>([]);
  const [focusLogTotal, setFocusLogTotal] = useState(0);
  const [focusLogInput, setFocusLogInput] = useState("");

  // Challenge (legacy leaderboard system)
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [optedIn, setOptedIn] = useState(false);
  const [publicVisible, setPublicVisible] = useState(false);
  const [currentValue, setCurrentValue] = useState(0);
  const [progressInput, setProgressInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [entries, setEntries] = useState<{ value: number; logged_at: string }[]>([]);

  // Load focus
  useEffect(() => {
    supabase
      .from("monthly_focus")
      .select("id, title, topic, reasoning, exercises, matt_quote, biomechanics, common_mistakes, challenge_metric, metric_label, target_goal")
      .eq("month", now.getMonth() + 1)
      .eq("year", now.getFullYear())
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => { if (data) setFocus(data as any); });
  }, []);

  // Load challenge
  useEffect(() => {
    supabase
      .from("monthly_challenges")
      .select("id, title, description, metric_label")
      .eq("month", now.getMonth() + 1)
      .eq("year", now.getFullYear())
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => { if (data) setChallenge(data as any); });
  }, []);

  // Load focus_logs for the user
  useEffect(() => {
    if (!focus || !user) return;
    supabase
      .from("focus_logs")
      .select("metric_value, logged_date")
      .eq("user_id", user.id)
      .eq("focus_id", focus.id)
      .order("logged_date", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setFocusLogs(data as any[]);
          const total = (data as any[]).reduce((s, r) => s + Number(r.metric_value), 0);
          setFocusLogTotal(total);
        }
      });
  }, [focus, user]);

  const handleFocusLog = async () => {
    if (!user || !focus) return;
    const val = parseFloat(focusLogInput);
    if (!val || val <= 0) { toast({ title: "Enter a number", variant: "destructive" }); return; }
    setActionLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("focus_logs").upsert(
      { user_id: user.id, focus_id: focus.id, metric_value: val, logged_date: today } as any,
      { onConflict: "user_id,focus_id,logged_date" }
    );
    if (error) { toast({ title: "Log failed", description: error.message, variant: "destructive" }); }
    else {
      toast({ title: `${val} ${focus.metric_label} logged!` });
      setFocusLogInput("");
      // Refresh
      const { data } = await supabase
        .from("focus_logs")
        .select("metric_value, logged_date")
        .eq("user_id", user.id)
        .eq("focus_id", focus.id)
        .order("logged_date", { ascending: true });
      if (data) {
        setFocusLogs(data as any[]);
        setFocusLogTotal((data as any[]).reduce((s, r) => s + Number(r.metric_value), 0));
      }
    }
    setActionLoading(false);
  };

  // Load participation
  useEffect(() => {
    if (!challenge || !user) return;
    supabase
      .from("challenge_participants")
      .select("current_value, is_public")
      .eq("user_id", user.id)
      .eq("challenge_id", challenge.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setOptedIn(true);
          setPublicVisible((data as any).is_public);
          setCurrentValue((data as any).current_value);
        }
      });
    loadLeaderboard();
    loadEntries();
  }, [challenge, user]);

  const loadLeaderboard = async () => {
    if (!challenge) return;
    const { data: parts } = await supabase
      .from("challenge_participants")
      .select("user_id, current_value, is_public")
      .eq("challenge_id", challenge.id)
      .eq("is_public", true)
      .order("current_value", { ascending: false });
    if (!parts || parts.length === 0) { setLeaderboard([]); return; }
    const userIds = (parts as any[]).map(p => p.user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, athlete_name, full_name").in("user_id", userIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    setLeaderboard((parts as any[]).map(p => ({
      ...p,
      athlete_name: profileMap.get(p.user_id)?.athlete_name || null,
      full_name: profileMap.get(p.user_id)?.full_name || null,
    })));
  };

  const loadEntries = async () => {
    if (!challenge || !user) return;
    const { data: part } = await supabase
      .from("challenge_participants")
      .select("id")
      .eq("user_id", user.id)
      .eq("challenge_id", challenge.id)
      .maybeSingle();
    if (!part) return;
    const { data } = await supabase
      .from("challenge_entries")
      .select("value, logged_at")
      .eq("participant_id", (part as any).id)
      .order("logged_at", { ascending: true });
    if (data) setEntries(data as any[]);
  };

  // Build cumulative chart data from focus_logs (preferred) or challenge_entries (fallback)
  const focusChartData = useMemo(() => {
    if (!focusLogs.length) return [];
    let cumulative = 0;
    return focusLogs.map((e) => {
      cumulative += Number(e.metric_value);
      const d = new Date(e.logged_date + "T00:00:00");
      return {
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: cumulative,
      };
    });
  }, [focusLogs]);

  const challengeChartData = useMemo(() => {
    if (!entries.length) return [];
    let cumulative = 0;
    return entries.map((e) => {
      cumulative += e.value;
      const d = new Date(e.logged_at);
      return {
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: cumulative,
      };
    });
  }, [entries]);

  const chartData = focusChartData.length > 0 ? focusChartData : challengeChartData;

  // Use target_goal from focus table (preferred), fallback to parsing challenge_metric text
  const targetValue = useMemo(() => {
    if (focus?.target_goal && focus.target_goal > 0) return focus.target_goal;
    if (!focus?.challenge_metric) return null;
    const match = focus.challenge_metric.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }, [focus?.target_goal, focus?.challenge_metric]);

  const handleOptIn = async () => {
    if (!subscribed) { toast({ title: "Members only", description: "Subscribe to join challenges.", variant: "destructive" }); return; }
    if (!user || !challenge) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("challenge_participants")
      .insert({ user_id: user.id, challenge_id: challenge.id, is_public: false, current_value: 0, monthly_challenge_id: challenge.id } as any);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); }
    else { setOptedIn(true); toast({ title: "You're in!" }); }
    setActionLoading(false);
  };

  const handleLogProgress = async () => {
    if (!user || !challenge) return;
    const val = parseInt(progressInput);
    if (!val || val <= 0) { toast({ title: "Enter a number", variant: "destructive" }); return; }
    setActionLoading(true);
    try {
      const { data: newVal, error } = await supabase.rpc("log_challenge_progress", {
        _user_id: user.id,
        _challenge_id: challenge.id,
        _value: val,
      });
      if (error) throw error;
      setCurrentValue(newVal as number);
      setProgressInput("");
      toast({ title: `+${val} logged!`, description: `Total: ${newVal} · +10 M² Points` });
      loadLeaderboard();
      loadEntries();
    } catch (e: any) {
      toast({ title: "Log failed", description: e.message, variant: "destructive" });
    }
    setActionLoading(false);
  };

  const handleVisibilityToggle = async (val: boolean) => {
    if (!user || !challenge) return;
    setPublicVisible(val);
    await supabase.from("challenge_participants").update({ is_public: val } as any).eq("user_id", user.id).eq("challenge_id", challenge.id);
    loadLeaderboard();
  };

  const getMedalIcon = (rank: number) => {
    if (rank === 0) return <Trophy size={14} className="text-primary" />;
    if (rank === 1) return <Medal size={14} className="text-muted-foreground" />;
    if (rank === 2) return <Award size={14} className="text-primary/70" />;
    return <span className="text-[10px] font-mono font-bold text-muted-foreground w-3.5 text-center">{rank + 1}</span>;
  };

  if (!focus && !challenge) {
    return (
      <div className="bg-card border border-border p-6 text-center">
        <Flame size={24} className="mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">No monthly focus or challenge right now. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Flame size={14} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
          Monthly Focus & Challenge
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {now.toLocaleString("default", { month: "long", year: "numeric" })}
        </span>
      </div>

      {/* ═══ BENTO GRID ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* ── Card 1: The Breakdown ── */}
        {focus && (
          <div className="bg-card border border-border overflow-hidden relative group">
            {/* Subtle glow border effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 pointer-events-none" />
            <div className="relative p-5 space-y-4">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-0.5">
                  {focus.title}
                </h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
                  {focus.topic}
                </p>
              </div>

              {/* The Why */}
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60 block mb-1.5">
                  The Why
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {focus.reasoning}
                </p>
              </div>

              {/* Biomechanics */}
              {(focus.biomechanics?.length ?? 0) > 0 && (
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60 block mb-1.5">
                    Perfect Form
                  </span>
                  <div className="space-y-1.5">
                    {focus.biomechanics.map((b, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                        <span className="text-primary mt-0.5 text-xs">▸</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Common Mistakes */}
              {(focus.common_mistakes?.length ?? 0) > 0 && (
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-destructive to-destructive/60 block mb-1.5">
                    What to Avoid
                  </span>
                  <div className="space-y-1.5">
                    {focus.common_mistakes.map((m, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-foreground/60">
                        <span className="text-destructive mt-0.5 text-xs">✗</span>
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exercises */}
              {focus.exercises.length > 0 && (
                <div className="bg-muted/50 border border-border p-3.5 space-y-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/70 block">Drills</span>
                  {focus.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-primary font-bold text-xs w-4 font-mono">{i + 1}.</span>
                      <span className="text-xs text-foreground/80 font-mono">{ex}</span>
                    </div>
                  ))}
                </div>
              )}

              {focus.matt_quote && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                  "{focus.matt_quote}" — Matt
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Card 2: The Input + Chart ── */}
        <div className="space-y-3">
          {/* Challenge Goal */}
          {focus?.challenge_metric && (
            <div className="bg-card border border-primary/20 p-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <Target size={18} className="text-primary shrink-0" />
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/70 block">Monthly Goal</span>
                  <p className="text-sm font-semibold text-foreground">{focus.challenge_metric}</p>
                </div>
              </div>
            </div>
          )}

          {/* Focus Log Input (uses focus_logs table) */}
          {focus && user && (
            <div className="bg-card border border-border p-4 space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-black text-primary tracking-tight">
                  {focusLogTotal}
                </span>
                <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                  {focus.metric_label}
                </span>
                {targetValue && targetValue > 0 && (
                  <span className="text-xs text-muted-foreground font-mono ml-auto">
                    / {targetValue} goal
                  </span>
                )}
              </div>
              {targetValue && targetValue > 0 && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(100, (focusLogTotal / Number(targetValue)) * 100)}%` }}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder={`+${focus.metric_label}`}
                  value={focusLogInput}
                  onChange={(e) => setFocusLogInput(e.target.value)}
                  className="font-mono text-primary text-right w-24 shrink-0"
                />
                <button
                  onClick={handleFocusLog}
                  disabled={actionLoading}
                  className="flex-1 bg-primary text-primary-foreground h-10 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Log Today
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                One entry per day · updates if you log again today
              </p>
            </div>
          )}

          {/* Challenge + Log (legacy leaderboard) */}
          {challenge ? (
            <div className="bg-card border border-border p-5 space-y-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/3 pointer-events-none" />
              <div className="relative space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy size={14} className="text-primary" />
                    <h4 className="text-sm font-bold uppercase tracking-widest text-foreground">{challenge.title}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{challenge.description}</p>
                </div>

                {optedIn ? (
                  <div className="space-y-3">
                    {/* Current value */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-mono font-black text-primary tracking-tight">
                        {currentValue}
                      </span>
                      <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                        {challenge.metric_label}
                      </span>
                      {targetValue && (
                        <span className="text-xs text-muted-foreground font-mono ml-auto">
                          / {targetValue} goal
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {targetValue && targetValue > 0 && (
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 rounded-full"
                          style={{ width: `${Math.min(100, (currentValue / targetValue) * 100)}%` }}
                        />
                      </div>
                    )}

                    {/* Log input */}
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder={`+${challenge.metric_label}`}
                        value={progressInput}
                        onChange={(e) => setProgressInput(e.target.value)}
                        className="font-mono text-primary text-right w-24 shrink-0"
                      />
                      <button
                        onClick={handleLogProgress}
                        disabled={actionLoading}
                        className="flex-1 bg-primary text-primary-foreground h-10 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        Log Progress
                      </button>
                    </div>

                    {/* Visibility */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {publicVisible ? <Eye size={12} className="text-primary" /> : <EyeOff size={12} className="text-muted-foreground" />}
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {publicVisible ? "On Leaderboard" : "Coach Only"}
                        </span>
                      </div>
                      <Switch checked={publicVisible} onCheckedChange={handleVisibilityToggle} />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleOptIn}
                    disabled={actionLoading}
                    className="w-full bg-primary text-primary-foreground py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={14} />}
                    Join Challenge
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {/* ── Area Chart ── */}
          {(chartData.length > 1) && (
            <div className="bg-card border border-border p-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-primary/3 to-transparent pointer-events-none" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground block mb-3 relative">
                Cumulative Progress
              </span>
              <div className="relative h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="focusGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(18, 82%, 50%)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(18, 82%, 50%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(0, 0%, 55%)", fontSize: 9, fontFamily: "monospace" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} cursor={false} />
                    {targetValue && (
                      <ReferenceLine
                        y={targetValue}
                        stroke="hsl(0, 0%, 35%)"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                        label={{
                          value: `Goal: ${targetValue}`,
                          position: "right",
                          fill: "hsl(0, 0%, 55%)",
                          fontSize: 9,
                          fontFamily: "monospace",
                        }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(18, 82%, 50%)"
                      strokeWidth={2}
                      fill="url(#focusGradient)"
                      dot={false}
                      activeDot={{
                        r: 4,
                        fill: "hsl(18, 82%, 50%)",
                        stroke: "hsl(0, 0%, 9%)",
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Leaderboard ── */}
          {leaderboard.length > 0 && (
            <div className="bg-card border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/50 flex items-center gap-2">
                <Trophy size={12} className="text-primary" />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Leaderboard</span>
                <span className="text-[9px] text-muted-foreground ml-auto font-mono">{leaderboard.length}</span>
              </div>
              <div className="divide-y divide-border">
                {leaderboard.slice(0, 8).map((entry, idx) => {
                  const name = entry.athlete_name || entry.full_name || "Athlete";
                  const isYou = entry.user_id === user?.id;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 px-4 py-2 transition-all ${isYou ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                    >
                      <div className="w-5 flex justify-center">{getMedalIcon(idx)}</div>
                      <span className={`text-xs font-bold flex-1 truncate ${isYou ? "text-primary" : "text-foreground"}`}>
                        {name}
                        {isYou && <span className="text-[8px] text-primary ml-1 font-mono uppercase">(you)</span>}
                      </span>
                      <span className="text-sm font-mono font-bold text-primary">{entry.current_value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthlyFocusWidget;
