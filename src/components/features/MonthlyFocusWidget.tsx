import { useState, useEffect, useMemo, memo } from "react";
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

/* ─── Types ────────────────────────────── */

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

/* ─── Organic River Pattern SVGs ─── */

const RiverWave = memo(() => (
  <svg viewBox="0 0 400 80" preserveAspectRatio="none" className="w-full h-16 opacity-[0.08]">
    <path d="M0,40 C40,20 80,60 120,40 C160,20 200,55 240,35 C280,15 320,50 360,30 C380,20 400,40 400,40 L400,80 L0,80 Z"
      fill="hsl(var(--primary))" />
    <path d="M0,55 C50,35 100,65 150,50 C200,35 250,60 300,45 C350,30 380,55 400,50 L400,80 L0,80 Z"
      fill="hsl(var(--primary))" opacity="0.5" />
  </svg>
));
RiverWave.displayName = "RiverWave";

const OrganicDivider = memo(() => (
  <svg viewBox="0 0 300 20" preserveAspectRatio="none" className="w-full h-3 opacity-[0.15]">
    <path d="M0,10 C30,4 60,16 90,10 C120,4 150,16 180,10 C210,4 240,16 270,10 C285,6 300,10 300,10"
      fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
  </svg>
));
OrganicDivider.displayName = "OrganicDivider";

const TribalAccent = memo(({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={`w-8 h-8 opacity-[0.12] ${className}`}>
    <circle cx="20" cy="20" r="18" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" />
    <circle cx="20" cy="20" r="12" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" strokeDasharray="3 3" />
    <circle cx="20" cy="20" r="5" fill="hsl(var(--primary))" opacity="0.3" />
    <line x1="20" y1="2" x2="20" y2="8" stroke="hsl(var(--primary))" strokeWidth="0.8" />
    <line x1="20" y1="32" x2="20" y2="38" stroke="hsl(var(--primary))" strokeWidth="0.8" />
    <line x1="2" y1="20" x2="8" y2="20" stroke="hsl(var(--primary))" strokeWidth="0.8" />
    <line x1="32" y1="20" x2="38" y2="20" stroke="hsl(var(--primary))" strokeWidth="0.8" />
  </svg>
));
TribalAccent.displayName = "TribalAccent";

/* ─── Custom Tooltip ─── */

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur border border-primary/30 px-3 py-2 shadow-lg shadow-primary/10">
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{label}</p>
      <p className="text-sm font-mono font-bold text-foreground">{payload[0].value}</p>
    </div>
  );
};

/* ─── Main Widget ──────────────────────── */

const MonthlyFocusWidget = () => {
  const { user, subscribed } = useAuth();
  const now = new Date();

  const [focus, setFocus] = useState<FocusData | null>(null);
  const [focusLogs, setFocusLogs] = useState<{ metric_value: number; logged_date: string }[]>([]);
  const [focusLogTotal, setFocusLogTotal] = useState(0);
  const [focusLogInput, setFocusLogInput] = useState("");

  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [optedIn, setOptedIn] = useState(false);
  const [publicVisible, setPublicVisible] = useState(false);
  const [currentValue, setCurrentValue] = useState(0);
  const [progressInput, setProgressInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [entries, setEntries] = useState<{ value: number; logged_at: string }[]>([]);

  useEffect(() => {
    supabase.from("monthly_focus")
      .select("id, title, topic, reasoning, exercises, matt_quote, biomechanics, common_mistakes, challenge_metric, metric_label, target_goal")
      .eq("month", now.getMonth() + 1).eq("year", now.getFullYear()).eq("status", "published")
      .maybeSingle().then(({ data }) => { if (data) setFocus(data as any); });
  }, []);

  useEffect(() => {
    supabase.from("monthly_challenges").select("id, title, description, metric_label")
      .eq("month", now.getMonth() + 1).eq("year", now.getFullYear()).eq("is_active", true)
      .maybeSingle().then(({ data }) => { if (data) setChallenge(data as any); });
  }, []);

  useEffect(() => {
    if (!focus || !user) return;
    supabase.from("focus_logs").select("metric_value, logged_date")
      .eq("user_id", user.id).eq("focus_id", focus.id).order("logged_date", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setFocusLogs(data as any[]);
          setFocusLogTotal((data as any[]).reduce((s, r) => s + Number(r.metric_value), 0));
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
      const { data } = await supabase.from("focus_logs").select("metric_value, logged_date")
        .eq("user_id", user.id).eq("focus_id", focus.id).order("logged_date", { ascending: true });
      if (data) {
        setFocusLogs(data as any[]);
        setFocusLogTotal((data as any[]).reduce((s, r) => s + Number(r.metric_value), 0));
      }
    }
    setActionLoading(false);
  };

  useEffect(() => {
    if (!challenge || !user) return;
    supabase.from("challenge_participants").select("current_value, is_public")
      .eq("user_id", user.id).eq("challenge_id", challenge.id).maybeSingle()
      .then(({ data }) => {
        if (data) { setOptedIn(true); setPublicVisible((data as any).is_public); setCurrentValue((data as any).current_value); }
      });
    loadLeaderboard();
    loadEntries();
  }, [challenge, user]);

  const loadLeaderboard = async () => {
    if (!challenge) return;
    const { data: parts } = await supabase.from("challenge_participants").select("user_id, current_value, is_public")
      .eq("challenge_id", challenge.id).eq("is_public", true).order("current_value", { ascending: false });
    if (!parts || parts.length === 0) { setLeaderboard([]); return; }
    const userIds = (parts as any[]).map(p => p.user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, athlete_name, full_name, random_alias").in("user_id", userIds);
    const { data: privacyData } = await supabase.from("user_privacy_settings" as any).select("user_id, show_name").in("user_id", userIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    const privacyMap = new Map(((privacyData || []) as any[]).map(p => [p.user_id, p]));
    setLeaderboard((parts as any[]).map(p => ({
      ...p, athlete_name: profileMap.get(p.user_id)?.athlete_name || null, full_name: profileMap.get(p.user_id)?.full_name || null,
      random_alias: profileMap.get(p.user_id)?.random_alias || null, show_name: privacyMap.get(p.user_id)?.show_name ?? true,
    })));
  };

  const loadEntries = async () => {
    if (!challenge || !user) return;
    const { data: part } = await supabase.from("challenge_participants").select("id")
      .eq("user_id", user.id).eq("challenge_id", challenge.id).maybeSingle();
    if (!part) return;
    const { data } = await supabase.from("challenge_entries").select("value, logged_at")
      .eq("participant_id", (part as any).id).order("logged_at", { ascending: true });
    if (data) setEntries(data as any[]);
  };

  const focusChartData = useMemo(() => {
    if (!focusLogs.length) return [];
    let cumulative = 0;
    return focusLogs.map((e) => {
      cumulative += Number(e.metric_value);
      const d = new Date(e.logged_date + "T00:00:00");
      return { date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: cumulative };
    });
  }, [focusLogs]);

  const challengeChartData = useMemo(() => {
    if (!entries.length) return [];
    let cumulative = 0;
    return entries.map((e) => {
      cumulative += e.value;
      const d = new Date(e.logged_at);
      return { date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: cumulative };
    });
  }, [entries]);

  const chartData = focusChartData.length > 0 ? focusChartData : challengeChartData;

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
    const { error } = await supabase.from("challenge_participants")
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
      const { data: newVal, error } = await supabase.rpc("log_challenge_progress", { _user_id: user.id, _challenge_id: challenge.id, _value: val });
      if (error) throw error;
      setCurrentValue(newVal as number); setProgressInput("");
      toast({ title: `+${val} logged!`, description: `Total: ${newVal} · +10 M² Points` });
      loadLeaderboard(); loadEntries();
    } catch (e: any) { toast({ title: "Log failed", description: e.message, variant: "destructive" }); }
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
      <div className="bg-card border border-border p-6 text-center relative overflow-hidden">
        <RiverWave />
        <Flame size={24} className="mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">No monthly focus or challenge right now. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* ── Flowing River Header ── */}
      <div className="relative overflow-hidden bg-card border border-border border-b-0">
        <div className="absolute inset-0 pointer-events-none">
          <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="w-full h-full opacity-[0.06]">
            <path d="M0,100 C60,60 120,140 180,100 C240,60 300,130 360,90 C420,50 480,120 540,80 C570,60 600,100 600,100 L600,200 L0,200 Z"
              fill="hsl(var(--primary))" />
            <path d="M0,130 C80,100 160,160 240,120 C320,80 400,150 480,110 C540,80 600,130 600,130 L600,200 L0,200 Z"
              fill="hsl(var(--primary))" opacity="0.4" />
            <path d="M0,160 C100,140 200,180 300,150 C400,120 500,170 600,155 L600,200 L0,200 Z"
              fill="hsl(var(--primary))" opacity="0.2" />
          </svg>
        </div>
        <div className="relative px-5 pt-5 pb-4 flex items-center gap-3">
          <TribalAccent />
          <div>
            <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground">
              Monthly Focus
            </h2>
            <span className="text-[10px] text-muted-foreground font-mono">
              {now.toLocaleString("default", { month: "long", year: "numeric" })}
            </span>
          </div>
          <TribalAccent className="ml-auto" />
        </div>
        <OrganicDivider />
      </div>

      {/* ── Focus Content — Organic flowing sections ── */}
      {focus && (
        <div className="bg-card border border-border border-t-0 relative overflow-hidden">
          {/* Background river texture */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
            <RiverWave />
          </div>

          <div className="relative p-5 space-y-5">
            {/* Title + topic */}
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-1">
                {focus.title}
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-8 h-[2px] bg-primary rounded-full" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
                  {focus.topic}
                </p>
              </div>
            </div>

            {/* The Why — flowing text with organic left accent */}
            <div className="relative pl-4">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full" style={{
                background: "linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.2) 100%)"
              }} />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary block mb-1.5">
                The Why
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {focus.reasoning}
              </p>
            </div>

            <OrganicDivider />

            {/* Biomechanics — organic cards */}
            {(focus.biomechanics?.length ?? 0) > 0 && (
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary block mb-2">
                  Perfect Form
                </span>
                <div className="space-y-2">
                  {focus.biomechanics.map((b, i) => (
                    <div key={i} className="flex items-start gap-3 bg-muted/30 border border-border/50 p-3 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary/30 rounded-r-full" />
                      <span className="text-primary mt-0.5 text-xs font-bold shrink-0 ml-2">▸</span>
                      <span className="text-sm text-foreground/80">{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Common Mistakes */}
            {(focus.common_mistakes?.length ?? 0) > 0 && (
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-destructive block mb-2">
                  What to Avoid
                </span>
                <div className="space-y-1.5">
                  {focus.common_mistakes.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-foreground/60 pl-1">
                      <span className="text-destructive mt-0.5 text-xs">✗</span>
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <OrganicDivider />

            {/* Exercises — earthy card grid */}
            {focus.exercises.length > 0 && (
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary block mb-2">Drills</span>
                <div className="grid grid-cols-2 gap-2">
                  {focus.exercises.map((ex, i) => (
                    <div key={i} className="bg-muted/40 border border-border/50 p-3 relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/40 to-transparent" />
                      <span className="text-primary font-bold text-xs font-mono block mb-0.5">{i + 1}.</span>
                      <span className="text-xs text-foreground/80">{ex}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matt quote — organic style */}
            {focus.matt_quote && (
              <div className="relative bg-primary/5 border border-primary/15 p-4 overflow-hidden">
                <div className="absolute -top-2 -left-2 opacity-20">
                  <TribalAccent />
                </div>
                <p className="text-xs text-muted-foreground italic pl-4 relative">
                  <span className="absolute left-0 top-0 text-primary text-lg leading-none">"</span>
                  {focus.matt_quote}
                  <span className="text-[10px] text-primary not-italic ml-1">— Matt</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Progress & Challenge Section ── */}
      <div className="mt-3 space-y-3">
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

        {/* Focus Log Input */}
        {focus && user && (
          <div className="bg-card border border-border p-4 space-y-3 relative overflow-hidden">
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none opacity-50">
              <RiverWave />
            </div>
            <div className="relative">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-black text-primary tracking-tight">
                  {focusLogTotal}
                </span>
                <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                  {focus.metric_label}
                </span>
                {targetValue && targetValue > 0 && (
                  <span className="text-xs text-muted-foreground font-mono ml-auto">/ {targetValue} goal</span>
                )}
              </div>
              {targetValue && targetValue > 0 && (
                <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (focusLogTotal / Number(targetValue)) * 100)}%`,
                      background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))"
                    }}
                  />
                </div>
              )}
              <div className="flex items-center gap-2 mt-3">
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
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                One entry per day · updates if you log again today
              </p>
            </div>
          </div>
        )}

        {/* Challenge + Log */}
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
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-mono font-black text-primary tracking-tight">{currentValue}</span>
                    <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{challenge.metric_label}</span>
                    {targetValue && <span className="text-xs text-muted-foreground font-mono ml-auto">/ {targetValue} goal</span>}
                  </div>
                  {targetValue && targetValue > 0 && (
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (currentValue / targetValue) * 100)}%`, background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))" }} />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input type="number" placeholder={`+${challenge.metric_label}`} value={progressInput}
                      onChange={(e) => setProgressInput(e.target.value)} className="font-mono text-primary text-right w-24 shrink-0" />
                    <button onClick={handleLogProgress} disabled={actionLoading}
                      className="flex-1 bg-primary text-primary-foreground h-10 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      Log Progress
                    </button>
                  </div>
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
                <button onClick={handleOptIn} disabled={actionLoading}
                  className="w-full bg-primary text-primary-foreground py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={14} />}
                  Join Challenge
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* ── Area Chart — river-flow styled ── */}
        {(chartData.length > 1) && (
          <div className="bg-card border border-border p-4 relative overflow-hidden">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground block mb-3 relative">
              Cumulative Progress
            </span>
            <div className="relative h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="focusGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "monospace" }} interval="preserveStartEnd" />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  {targetValue && (
                    <ReferenceLine y={targetValue} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1}
                      label={{ value: `Goal: ${targetValue}`, position: "right", fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "monospace" }} />
                  )}
                  <Area type="natural" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5}
                    fill="url(#focusGradient)" dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }} />
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
                  <div key={idx} className={`flex items-center gap-3 px-4 py-2 transition-all ${isYou ? "bg-primary/5 border-l-2 border-primary" : ""}`}>
                    <div className="w-5 flex justify-center">{getMedalIcon(idx)}</div>
                    <span className={`text-xs font-bold flex-1 truncate ${isYou ? "text-primary" : "text-foreground"}`}>
                      {name}{isYou && <span className="text-[8px] text-primary ml-1 font-mono uppercase">(you)</span>}
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
  );
};

export default MonthlyFocusWidget;
