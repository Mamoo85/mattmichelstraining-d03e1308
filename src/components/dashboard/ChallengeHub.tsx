import { memo, useState, useEffect, useCallback, useMemo } from "react";
import { Trophy, Zap, TrendingUp, Eye, EyeOff, Copy, Check, Gift, Flame, Users, Loader2, Send, ChevronRight } from "lucide-react";
import { usePoints, getLevelInfo, getNextLevel, LEVELS } from "@/hooks/usePoints";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import LevelUpCelebration from "@/components/LevelUpCelebration";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
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
}

/* ─── Sub-Components ─── */

const PointsOverTimeChart = memo(({ transactions }: { transactions: { created_at: string; points: number }[] }) => {
  const chartData = useMemo(() => {
    if (!transactions.length) return [];
    const byWeek = new Map<string, number>();
    let cumulative = 0;
    // Sort oldest first
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
    <div className="bg-card border border-border p-4">
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
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Area type="monotone" dataKey="pts" stroke="hsl(var(--primary))" fill="url(#ptGrad)" strokeWidth={2} name="Total Points" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});
PointsOverTimeChart.displayName = "PointsOverTimeChart";

const LeaderboardChart = memo(({ entries, currentUserId }: { entries: LeaderEntry[]; currentUserId?: string }) => {
  if (entries.length === 0) return (
    <div className="bg-card border border-border p-5 text-center">
      <Trophy size={24} className="mx-auto text-muted-foreground/30 mb-2" />
      <p className="text-xs text-muted-foreground">No public entries yet. Join and set your numbers to public.</p>
    </div>
  );

  const top10 = entries.slice(0, 10);
  const barData = top10.map(e => ({
    name: e.athlete_name || e.full_name || "Athlete",
    value: e.current_value,
    isYou: e.user_id === currentUserId,
  }));

  return (
    <div className="bg-card border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={12} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Challenge Leaderboard</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{entries.length} public</span>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(120, top10.length * 32)}>
        <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9, fill: "hsl(var(--foreground))" }} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }}
          />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Score" />
        </BarChart>
      </ResponsiveContainer>
      {/* Ranked list */}
      <div className="divide-y divide-border mt-3">
        {entries.map((entry, idx) => {
          const name = entry.athlete_name || entry.full_name || "Athlete";
          const isYou = entry.user_id === currentUserId;
          return (
            <div key={entry.id} className={`flex items-center gap-3 px-2 py-2 ${isYou ? "bg-primary/5" : ""}`}>
              <span className="text-[10px] font-mono font-bold text-muted-foreground w-5 text-center">
                {idx === 0 ? "🏆" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}
              </span>
              <span className={`text-xs font-bold flex-1 truncate ${isYou ? "text-primary" : "text-foreground"}`}>
                {name}{isYou && <span className="text-[9px] text-primary ml-1 font-mono">(you)</span>}
              </span>
              <span className="text-sm font-mono font-bold text-primary">{entry.current_value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
LeaderboardChart.displayName = "LeaderboardChart";

/* ─── Referral Card ─── */
const ReferralCTA = memo(() => {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("referral_codes")
      .select("code")
      .eq("user_id", user.id)
      .maybeSingle()
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
    <div className="bg-primary/5 border border-primary/20 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Gift size={14} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Refer & Earn</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">
        Send your link to a friend. They get their first month <strong className="text-primary">free</strong>, you get a <strong className="text-primary">free month</strong> added.
      </p>
      <button
        onClick={handleCopy}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
      >
        {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Referral Link</>}
      </button>
    </div>
  );
});
ReferralCTA.displayName = "ReferralCTA";

/* ─── Main Component ─── */
const ChallengeHub = () => {
  const { user } = useAuth();
  const {
    points, transactions, leaderboard, toggleVisibility, loading,
    levelUp, dismissLevelUp,
  } = usePoints();

  // Monthly challenge state
  const [challenge, setChallenge] = useState<MonthlyChallenge | null>(null);
  const [participation, setParticipation] = useState<Participation | null>(null);
  const [challengeLeaderboard, setChallengeLeaderboard] = useState<LeaderEntry[]>([]);
  const [progressInput, setProgressInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [suggestion, setSuggestion] = useState("");

  // Load active monthly challenge
  useEffect(() => {
    const now = new Date();
    supabase
      .from("monthly_challenges")
      .select("id, title, description, metric_label, month, year")
      .eq("is_active", true)
      .eq("month", now.getMonth() + 1)
      .eq("year", now.getFullYear())
      .maybeSingle()
      .then(({ data }) => { if (data) setChallenge(data as any); });
  }, []);

  // Load user participation
  useEffect(() => {
    if (!user || !challenge) return;
    supabase
      .from("challenge_participants")
      .select("id, current_value, is_public")
      .eq("user_id", user.id)
      .eq("monthly_challenge_id", challenge.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setParticipation(data as any); });
  }, [user, challenge]);

  // Load challenge leaderboard
  const loadChallengeLeaderboard = useCallback(async () => {
    if (!challenge) return;
    const { data: parts } = await supabase
      .from("challenge_participants")
      .select("id, user_id, current_value")
      .eq("monthly_challenge_id", challenge.id)
      .eq("is_public", true)
      .order("current_value", { ascending: false });
    if (!parts || parts.length === 0) { setChallengeLeaderboard([]); return; }
    const userIds = (parts as any[]).map(p => p.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, athlete_name, full_name")
      .in("user_id", userIds);
    const pMap = new Map((profiles || []).map(p => [p.user_id, p]));
    setChallengeLeaderboard((parts as any[]).map(p => ({
      ...p,
      athlete_name: pMap.get(p.user_id)?.athlete_name || null,
      full_name: pMap.get(p.user_id)?.full_name || null,
    })));
  }, [challenge]);

  useEffect(() => { loadChallengeLeaderboard(); }, [loadChallengeLeaderboard]);

  const handleJoin = async () => {
    if (!user || !challenge) return;
    setActionLoading(true);
    const { data, error } = await supabase
      .from("challenge_participants")
      .insert({ user_id: user.id, challenge_id: challenge.id, monthly_challenge_id: challenge.id, is_public: false, current_value: 0 } as any)
      .select("id, current_value, is_public")
      .single();
    if (error) {
      toast({ title: "Failed to join", description: error.message, variant: "destructive" });
    } else {
      setParticipation(data as any);
      toast({ title: "You're in!", description: "Challenge accepted. Let's go." });
    }
    setActionLoading(false);
  };

  const handleLogProgress = async () => {
    if (!user || !challenge) return;
    const val = parseInt(progressInput);
    if (!val || val <= 0) { toast({ title: "Enter a number", variant: "destructive" }); return; }
    setActionLoading(true);
    const { data: newVal } = await supabase.rpc("log_challenge_progress", {
      _user_id: user.id,
      _challenge_id: challenge.id,
      _value: val,
    });
    if (typeof newVal === "number") {
      setParticipation(prev => prev ? { ...prev, current_value: newVal } : prev);
      setProgressInput("");
      loadChallengeLeaderboard();
      toast({ title: `+${val} logged!`, description: `Total: ${newVal}` });
    }
    setActionLoading(false);
  };

  const handleVisibility = async (val: boolean) => {
    if (!user || !challenge) return;
    setParticipation(prev => prev ? { ...prev, is_public: val } : prev);
    await supabase
      .from("challenge_participants")
      .update({ is_public: val } as any)
      .eq("user_id", user.id)
      .eq("monthly_challenge_id", challenge.id);
    loadChallengeLeaderboard();
  };

  const handleSuggest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion.trim()) return;
    toast({ title: "Suggestion sent!", description: "Matt reviews every one." });
    setSuggestion("");
  };

  if (loading) return (
    <div className="flex justify-center py-12"><Loader2 size={20} className="text-primary animate-spin" /></div>
  );

  const level = points ? getLevelInfo(points.total_points) : LEVELS[0];
  const next = points ? getNextLevel(points.total_points) : LEVELS[1];
  const progressPct = next && points
    ? Math.min(100, ((points.total_points - level.min) / (next.min - level.min)) * 100)
    : 100;

  return (
    <div className="space-y-5">
      <LevelUpCelebration levelKey={levelUp} onDismiss={dismissLevelUp} />

      {/* ── Points Summary Card ── */}
      {points && (
        <div className="bg-card border border-border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">M² Points</span>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-4xl font-mono font-black text-primary">{points.total_points.toLocaleString()}</div>
              <div className={`text-xs font-bold uppercase tracking-widest ${level.color}`}>{level.label}</div>
            </div>
            {points.weekly_streak > 0 && (
              <div className="flex items-center gap-1 text-primary ml-auto">
                <TrendingUp size={12} />
                <span className="text-xs font-bold font-mono">{points.weekly_streak}wk streak</span>
              </div>
            )}
          </div>
          {next && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>{level.label}</span>
                <span>{next.label} — {next.min.toLocaleString()} pts</span>
              </div>
              <Progress value={progressPct} className="h-2" />
              <div className="text-[10px] text-muted-foreground text-right font-mono">
                {(next.min - points.total_points).toLocaleString()} pts to go
              </div>
            </div>
          )}
          <div className="flex items-center justify-between bg-muted p-2.5">
            <div className="flex items-center gap-2">
              {points.is_public ? <Eye size={12} className="text-primary" /> : <EyeOff size={12} className="text-muted-foreground" />}
              <span className="text-[10px] font-bold text-foreground">{points.is_public ? "On leaderboard" : "Hidden"}</span>
            </div>
            <Switch checked={points.is_public} onCheckedChange={toggleVisibility} />
          </div>
        </div>
      )}

      {/* ── Points Over Time ── */}
      <PointsOverTimeChart transactions={transactions} />

      {/* ── Monthly Challenge ── */}
      {challenge ? (
        <div className="bg-card border border-border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Flame size={14} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Monthly Challenge</span>
          </div>
          <h3 className="text-base font-bold text-foreground">{challenge.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{challenge.description}</p>

          {participation ? (
            <div className="space-y-3">
              <div className="bg-primary/5 border border-primary/20 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy size={14} className="text-primary" />
                  <span className="text-xs font-bold text-primary uppercase tracking-widest">You're in!</span>
                </div>
              </div>
              <div className="bg-muted p-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Your Progress</span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-mono font-bold text-primary">{participation.current_value}</span>
                  <span className="text-xs text-muted-foreground">{challenge.metric_label}</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <input
                      type="number"
                      placeholder={`+${challenge.metric_label}`}
                      value={progressInput}
                      onChange={e => setProgressInput(e.target.value)}
                      className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-8 w-20"
                    />
                    <button
                      onClick={handleLogProgress}
                      disabled={actionLoading}
                      className="bg-primary text-primary-foreground h-8 px-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 size={12} className="animate-spin" /> : "Log"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between bg-muted p-3">
                <div className="flex items-center gap-2">
                  {participation.is_public ? <Eye size={14} className="text-primary" /> : <EyeOff size={14} className="text-muted-foreground" />}
                  <span className="text-[10px] font-bold text-foreground">{participation.is_public ? "Public on leaderboard" : "Coach only"}</span>
                </div>
                <Switch checked={participation.is_public} onCheckedChange={handleVisibility} />
              </div>
            </div>
          ) : (
            <button
              onClick={handleJoin}
              disabled={actionLoading}
              className="bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={14} />}
              Join Challenge
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border p-5 text-center">
          <Flame size={24} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">No active challenge this month. Check back soon.</p>
        </div>
      )}

      {/* ── Challenge Leaderboard Chart ── */}
      <LeaderboardChart entries={challengeLeaderboard} currentUserId={user?.id} />

      {/* ── Points Leaderboard ── */}
      {leaderboard.length > 0 && (
        <div className="bg-card border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted flex items-center gap-2">
            <Zap size={12} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">M² Points Leaderboard</span>
          </div>
          <div className="divide-y divide-border">
            {leaderboard.slice(0, 15).map((entry, idx) => {
              const name = entry.athlete_name || entry.full_name || "Athlete";
              const isYou = entry.user_id === user?.id;
              return (
                <div key={entry.user_id} className={`flex items-center gap-3 px-4 py-2 ${isYou ? "bg-primary/5" : ""}`}>
                  <span className="text-[10px] font-mono font-bold text-muted-foreground w-5 text-center">
                    {idx === 0 ? "🏆" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}
                  </span>
                  <span className={`text-xs font-bold flex-1 truncate ${isYou ? "text-primary" : "text-foreground"}`}>
                    {name}{isYou && <span className="text-[9px] text-primary ml-1 font-mono">(you)</span>}
                  </span>
                  <span className="text-sm font-mono font-bold text-primary">{entry.total_points.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Refer & Earn ── */}
      <ReferralCTA />

      {/* ── Suggest a Challenge ── */}
      <div className="bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Send size={12} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Suggest a Challenge</span>
        </div>
        <form onSubmit={handleSuggest} className="flex gap-2">
          <input
            type="text"
            value={suggestion}
            onChange={e => setSuggestion(e.target.value)}
            placeholder="e.g. '100 burpees in a week'"
            className="flex-1 bg-background border border-border px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
            required
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default memo(ChallengeHub);
