import { memo, useState, useEffect, useCallback, useMemo } from "react";
import { Trophy, Zap, TrendingUp, Eye, EyeOff, Copy, Check, Gift, Flame, Users, Loader2, Send, ChevronRight } from "lucide-react";
import { usePoints, getLevelInfo, getNextLevel, LEVELS } from "@/hooks/usePoints";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import LevelUpCelebration from "@/components/gamification/LevelUpCelebration";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

/* ─── Types ─── */
interface MonthlyChallenge {
  id: string;
  title: string;
  description: string;
  metric_label: string;
  month: number;
  year: number;
}

interface Participation {
  id: string;
  current_value: number;
  is_public: boolean;
}

interface LeaderEntry {
  id: string;
  user_id: string;
  current_value: number;
  athlete_name: string | null;
  full_name: string | null;
  total_points?: number;
}

/* ─── Abstract geometric pattern SVG ─── */
const AbstractPattern = memo(({ variant = 0 }: { variant?: number }) => {
  const patterns = [
    // Concentric arcs — pantheon dome
    <svg viewBox="0 0 200 200" className="w-full h-full opacity-[0.06]" key="p0">
      {[40, 60, 80, 100].map((r, i) => (
        <circle key={i} cx="100" cy="200" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      ))}
      {[...Array(8)].map((_, i) => (
        <line key={`l${i}`} x1="100" y1="200" x2={100 + 120 * Math.cos((i * Math.PI) / 7)} y2={200 - 120 * Math.sin((i * Math.PI) / 7)} stroke="hsl(var(--primary))" strokeWidth="0.5" opacity="0.5" />
      ))}
    </svg>,
    // Grid lattice
    <svg viewBox="0 0 200 200" className="w-full h-full opacity-[0.05]" key="p1">
      {[...Array(10)].map((_, i) => (
        <g key={i}>
          <line x1={i * 20} y1="0" x2={i * 20} y2="200" stroke="hsl(var(--primary))" strokeWidth="0.5" />
          <line x1="0" y1={i * 20} x2="200" y2={i * 20} stroke="hsl(var(--primary))" strokeWidth="0.5" />
        </g>
      ))}
      <circle cx="100" cy="100" r="60" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" />
    </svg>,
    // Radial burst
    <svg viewBox="0 0 200 200" className="w-full h-full opacity-[0.06]" key="p2">
      {[...Array(12)].map((_, i) => {
        const angle = (i * Math.PI * 2) / 12;
        return <line key={i} x1="100" y1="100" x2={100 + 95 * Math.cos(angle)} y2={100 + 95 * Math.sin(angle)} stroke="hsl(var(--primary))" strokeWidth="0.8" />;
      })}
      <circle cx="100" cy="100" r="30" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="70" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" strokeDasharray="4 6" />
    </svg>,
  ];
  return patterns[variant % patterns.length];
});
AbstractPattern.displayName = "AbstractPattern";

/* ─── Abstract Card wrapper ─── */
const ArtCard = memo(({ children, pattern = 0, glow = false, className = "" }: {
  children: React.ReactNode;
  pattern?: number;
  glow?: boolean;
  className?: string;
}) => (
  <div className={`relative overflow-hidden bg-card border border-border ${glow ? "border-primary/30 shadow-[0_0_20px_hsl(var(--primary)/0.08)]" : ""} ${className}`}>
    <div className="absolute inset-0 pointer-events-none">
      <AbstractPattern variant={pattern} />
    </div>
    <div className="relative">{children}</div>
  </div>
));
ArtCard.displayName = "ArtCard";

/* ─── Points Over Time Chart ─── */
const PointsOverTimeChart = memo(({ transactions }: { transactions: { created_at: string; points: number }[] }) => {
  const chartData = useMemo(() => {
    if (!transactions.length) return [];
    const byWeek = new Map<string, number>();
    let cumulative = 0;
    const sorted = [...transactions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (const t of sorted) {
      const d = new Date(t.created_at);
      const weekLabel = `${d.toLocaleString("default", { month: "short" })} ${Math.ceil(d.getDate() / 7)}`;
      cumulative += t.points;
      byWeek.set(weekLabel, cumulative);
    }
    return Array.from(byWeek.entries()).map(([week, pts]) => ({ week, pts }));
  }, [transactions]);

  if (chartData.length < 2) return null;

  return (
    <ArtCard pattern={1} className="p-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-3">Points Over Time</span>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="ptGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="week" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={40} />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
          <Area type="monotone" dataKey="pts" stroke="hsl(var(--primary))" fill="url(#ptGrad)" strokeWidth={2} name="Total Points" />
        </AreaChart>
      </ResponsiveContainer>
    </ArtCard>
  );
});
PointsOverTimeChart.displayName = "PointsOverTimeChart";

/* ─── Referral Card ─── */
const ReferralCTA = memo(() => {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("referral_codes").select("code").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setCode((data as any).code); });
  }, [user]);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(`${window.location.origin}/?ref=${code}`);
    setCopied(true);
    toast({ title: "Referral link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (!code) return null;

  return (
    <ArtCard pattern={2} glow className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Gift size={14} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Refer & Earn</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">
        Send your link to a friend. They get their first month <strong className="text-primary">free</strong>, you get a <strong className="text-primary">free month</strong> added.
      </p>
      <button onClick={handleCopy} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all">
        {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Referral Link</>}
      </button>
    </ArtCard>
  );
});
ReferralCTA.displayName = "ReferralCTA";

/* ─── Leaderboard Entry Card ─── */
const LeaderCard = memo(({ entry, rank, isYou, type }: { entry: LeaderEntry; rank: number; isYou: boolean; type: "challenge" | "points" }) => {
  const name = entry.athlete_name || entry.full_name || "Athlete";
  const value = type === "points" ? (entry.total_points ?? 0) : entry.current_value;
  const medal = rank === 0 ? "🏆" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : null;

  return (
    <ArtCard pattern={rank % 3} glow={isYou} className={`p-4 ${isYou ? "border-primary/40" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center text-lg">
          {medal || <span className="text-xs font-mono font-bold text-muted-foreground">{rank + 1}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-bold truncate block ${isYou ? "text-primary" : "text-foreground"}`}>
            {name}{isYou && <span className="text-[8px] text-primary ml-1 font-mono uppercase"> (you)</span>}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xl font-mono font-black text-primary">{value.toLocaleString()}</span>
          <span className="text-[8px] text-muted-foreground block uppercase tracking-widest">
            {type === "points" ? "pts" : "score"}
          </span>
        </div>
      </div>
      {/* Progress bar visual */}
      <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/50 rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, rank === 0 ? 100 : (value / Math.max(1, value + 10)) * 100)}%` }}
        />
      </div>
    </ArtCard>
  );
});
LeaderCard.displayName = "LeaderCard";

/* ═══════════ Main Component ═══════════ */
const ChallengeHub = () => {
  const { user } = useAuth();
  const { points, transactions, leaderboard, toggleVisibility, loading, levelUp, dismissLevelUp } = usePoints();

  const [challenge, setChallenge] = useState<MonthlyChallenge | null>(null);
  const [participation, setParticipation] = useState<Participation | null>(null);
  const [challengeLeaderboard, setChallengeLeaderboard] = useState<LeaderEntry[]>([]);
  const [progressInput, setProgressInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [suggestion, setSuggestion] = useState("");

  useEffect(() => {
    const now = new Date();
    supabase.from("monthly_challenges").select("id, title, description, metric_label, month, year")
      .eq("is_active", true).eq("month", now.getMonth() + 1).eq("year", now.getFullYear())
      .maybeSingle().then(({ data }) => { if (data) setChallenge(data as any); });
  }, []);

  useEffect(() => {
    if (!user || !challenge) return;
    supabase.from("challenge_participants").select("id, current_value, is_public")
      .eq("user_id", user.id).eq("monthly_challenge_id", challenge.id)
      .maybeSingle().then(({ data }) => { if (data) setParticipation(data as any); });
  }, [user, challenge]);

  const loadChallengeLeaderboard = useCallback(async () => {
    if (!challenge) return;
    const { data: parts } = await supabase.from("challenge_participants").select("id, user_id, current_value")
      .eq("monthly_challenge_id", challenge.id).eq("is_public", true).order("current_value", { ascending: false });
    if (!parts || parts.length === 0) { setChallengeLeaderboard([]); return; }
    const userIds = (parts as any[]).map(p => p.user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, athlete_name, full_name").in("user_id", userIds);
    const pMap = new Map((profiles || []).map(p => [p.user_id, p]));
    setChallengeLeaderboard((parts as any[]).map(p => ({
      ...p, athlete_name: pMap.get(p.user_id)?.athlete_name || null, full_name: pMap.get(p.user_id)?.full_name || null,
    })));
  }, [challenge]);

  useEffect(() => { loadChallengeLeaderboard(); }, [loadChallengeLeaderboard]);

  const handleJoin = async () => {
    if (!user || !challenge) return;
    setActionLoading(true);
    const { data, error } = await supabase.from("challenge_participants")
      .insert({ user_id: user.id, challenge_id: challenge.id, monthly_challenge_id: challenge.id, is_public: false, current_value: 0 } as any)
      .select("id, current_value, is_public").single();
    if (error) { toast({ title: "Failed to join", description: error.message, variant: "destructive" }); }
    else { setParticipation(data as any); toast({ title: "You're in!", description: "Challenge accepted. Let's go." }); }
    setActionLoading(false);
  };

  const handleLogProgress = async () => {
    if (!user || !challenge) return;
    const val = parseInt(progressInput);
    if (!val || val <= 0) { toast({ title: "Enter a number", variant: "destructive" }); return; }
    setActionLoading(true);
    const { data: newVal } = await supabase.rpc("log_challenge_progress", { _user_id: user.id, _challenge_id: challenge.id, _value: val });
    if (typeof newVal === "number") {
      setParticipation(prev => prev ? { ...prev, current_value: newVal } : prev);
      setProgressInput(""); loadChallengeLeaderboard();
      toast({ title: `+${val} logged!`, description: `Total: ${newVal}` });
    }
    setActionLoading(false);
  };

  const handleVisibility = async (val: boolean) => {
    if (!user || !challenge) return;
    setParticipation(prev => prev ? { ...prev, is_public: val } : prev);
    await supabase.from("challenge_participants").update({ is_public: val } as any).eq("user_id", user.id).eq("monthly_challenge_id", challenge.id);
    loadChallengeLeaderboard();
  };

  const handleSuggest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion.trim()) return;
    toast({ title: "Suggestion sent!", description: "Matt reviews every one." });
    setSuggestion("");
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={20} className="text-primary animate-spin" /></div>;

  const level = points ? getLevelInfo(points.total_points) : LEVELS[0];
  const next = points ? getNextLevel(points.total_points) : LEVELS[1];
  const progressPct = next && points ? Math.min(100, ((points.total_points - level.min) / (next.min - level.min)) * 100) : 100;

  return (
    <div className="space-y-4">
      <LevelUpCelebration levelKey={levelUp} onDismiss={dismissLevelUp} />

      {/* ── Hero Points Card — Pantheon dome aesthetic ── */}
      {points && (
        <ArtCard pattern={0} glow className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap size={16} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">M² Points</span>
              </div>
              <div className="text-5xl font-mono font-black text-primary tracking-tight leading-none">
                {points.total_points.toLocaleString()}
              </div>
              <div className={`text-sm font-bold uppercase tracking-widest mt-1 ${level.color}`}>
                {level.label}
              </div>
            </div>
            <div className="text-right space-y-1">
              {points.weekly_streak > 0 && (
                <div className="flex items-center gap-1 text-primary justify-end">
                  <TrendingUp size={12} />
                  <span className="text-xs font-bold font-mono">{points.weekly_streak}wk</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {points.is_public ? <Eye size={10} className="text-primary" /> : <EyeOff size={10} className="text-muted-foreground" />}
                <Switch checked={points.is_public} onCheckedChange={toggleVisibility} />
              </div>
            </div>
          </div>
          {next && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                <span>{level.label}</span>
                <span>{next.label} — {next.min.toLocaleString()} pts</span>
              </div>
              <Progress value={progressPct} className="h-2" />
              <div className="text-[9px] text-muted-foreground text-right font-mono">
                {(next.min - points.total_points).toLocaleString()} to go
              </div>
            </div>
          )}
        </ArtCard>
      )}

      {/* ── Points Over Time ── */}
      <PointsOverTimeChart transactions={transactions} />

      {/* ── Monthly Challenge — Abstract Card ── */}
      {challenge ? (
        <ArtCard pattern={2} glow={!!participation} className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Monthly Challenge</span>
          </div>
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground">{challenge.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{challenge.description}</p>

          {participation ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-mono font-black text-primary">{participation.current_value}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-widest">{challenge.metric_label}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder={`+${challenge.metric_label}`}
                  value={progressInput}
                  onChange={e => setProgressInput(e.target.value)}
                  className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-9 w-20"
                />
                <button onClick={handleLogProgress} disabled={actionLoading}
                  className="flex-1 bg-primary text-primary-foreground h-9 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {actionLoading ? <Loader2 size={12} className="animate-spin" /> : "Log"}
                </button>
              </div>
              <div className="flex items-center justify-between bg-muted/50 p-2.5">
                <div className="flex items-center gap-2">
                  {participation.is_public ? <Eye size={12} className="text-primary" /> : <EyeOff size={12} className="text-muted-foreground" />}
                  <span className="text-[10px] font-bold text-foreground">{participation.is_public ? "On leaderboard" : "Hidden"}</span>
                </div>
                <Switch checked={participation.is_public} onCheckedChange={handleVisibility} />
              </div>
            </div>
          ) : (
            <button onClick={handleJoin} disabled={actionLoading}
              className="w-full bg-primary text-primary-foreground py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50">
              {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={14} />}
              Join Challenge
            </button>
          )}
        </ArtCard>
      ) : (
        <ArtCard pattern={1} className="p-5 text-center">
          <Flame size={24} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">No active challenge this month. Check back soon.</p>
        </ArtCard>
      )}

      {/* ── Challenge Leaderboard — Abstract Grid Cards ── */}
      {challengeLeaderboard.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Trophy size={12} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Challenge Leaderboard</span>
            <span className="text-[9px] text-muted-foreground ml-auto font-mono">{challengeLeaderboard.length} public</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {challengeLeaderboard.slice(0, 10).map((entry, idx) => (
              <LeaderCard key={entry.id} entry={entry} rank={idx} isYou={entry.user_id === user?.id} type="challenge" />
            ))}
          </div>
        </div>
      )}

      {/* ── Points Leaderboard — Abstract Grid Cards ── */}
      {leaderboard.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Zap size={12} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">M² Points Leaderboard</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {leaderboard.slice(0, 10).map((entry: any, idx: number) => (
              <LeaderCard key={entry.user_id} entry={entry} rank={idx} isYou={entry.user_id === user?.id} type="points" />
            ))}
          </div>
        </div>
      )}

      {/* ── Refer & Earn ── */}
      <ReferralCTA />

      {/* ── Suggest a Challenge ── */}
      <ArtCard pattern={0} className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Send size={12} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Suggest a Challenge</span>
        </div>
        <form onSubmit={handleSuggest} className="flex gap-2">
          <input
            type="text" value={suggestion} onChange={e => setSuggestion(e.target.value)}
            placeholder="e.g. '100 burpees in a week'"
            className="flex-1 bg-background border border-border px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" required
          />
          <button type="submit" className="bg-primary text-primary-foreground px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90">Send</button>
        </form>
      </ArtCard>
    </div>
  );
};

export default memo(ChallengeHub);
