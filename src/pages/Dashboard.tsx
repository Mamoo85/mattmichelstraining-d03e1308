import AppNavbar from "@/components/AppNavbar";
import { useAuth, TIERS } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Crown, Timer, User, Trophy, Medal, Award, Plus, Eye, EyeOff, Send, Flame, Dumbbell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import IntervalTimer from "@/components/workout/IntervalTimer";
import MyPrograms from "@/components/MyPrograms";
import ProgressCharts from "@/components/ProgressCharts";
import UpcomingSessions from "@/components/UpcomingSessions";
import StudioCheckIn from "@/components/StudioCheckIn";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import WorkoutBuilder from "@/components/workout/WorkoutBuilder";
import CommunityWorkoutBank from "@/components/workout/CommunityWorkoutBank";
import ReferralDashboard from "@/components/ReferralDashboard";
import PointsWidget from "@/components/PointsWidget";
import PointsLeaderboard from "@/components/PointsLeaderboard";

const TABS = [
  { key: "home", label: "Home" },
  { key: "progress", label: "Progress" },
  { key: "programs", label: "My Programs" },
  { key: "workouts", label: "Workouts" },
  { key: "points", label: "Points" },
  { key: "referrals", label: "Refer" },
];

interface MonthlyFocusData {
  title: string;
  topic: string;
  reasoning: string;
  exercises: string[];
  matt_quote: string;
}

interface MonthlyChallenge {
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

const WorkoutsTab = () => {
  const [showBuilder, setShowBuilder] = useState(false);

  return showBuilder ? (
    <WorkoutBuilder
      onSaved={() => setShowBuilder(false)}
      onClose={() => setShowBuilder(false)}
    />
  ) : (
    <CommunityWorkoutBank onCreateNew={() => setShowBuilder(true)} />
  );
};

const Dashboard = () => {
  const { user, subscribed, subscriptionTier, isLegend } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string | null; athlete_name: string | null } | null>(null);
  const [activeTab, setActiveTab] = useState("home");
  const [portalLoading, setPortalLoading] = useState(false);
  const [showTimer, setShowTimer] = useState(false);

  // Monthly Focus
  const [focus, setFocus] = useState<MonthlyFocusData | null>(null);

  // Challenge
  const [challenge, setChallenge] = useState<MonthlyChallenge | null>(null);
  const [optedIn, setOptedIn] = useState(false);
  const [publicVisible, setPublicVisible] = useState(false);
  const [currentValue, setCurrentValue] = useState(0);
  const [progressInput, setProgressInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [entries, setEntries] = useState<{ value: number; logged_at: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, athlete_name").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  // Load monthly focus
  useEffect(() => {
    const now = new Date();
    supabase
      .from("monthly_focus")
      .select("title, topic, reasoning, exercises, matt_quote")
      .eq("month", now.getMonth() + 1)
      .eq("year", now.getFullYear())
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => { if (data) setFocus(data as any); });
  }, []);

  // Load monthly challenge
  useEffect(() => {
    const now = new Date();
    supabase
      .from("monthly_challenges")
      .select("id, title, description, metric_label")
      .eq("month", now.getMonth() + 1)
      .eq("year", now.getFullYear())
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => { if (data) setChallenge(data as any); });
  }, []);

  // Load participation + leaderboard when challenge is loaded
  useEffect(() => {
    if (!challenge || !user) return;
    // My participation
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
    // Get participant id first
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
      .order("logged_at", { ascending: false });
    if (data) setEntries(data as any[]);
  };

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
    const newVal = currentValue + val;
    // Update participant total
    await supabase
      .from("challenge_participants")
      .update({ current_value: newVal, updated_at: new Date().toISOString() } as any)
      .eq("user_id", user.id)
      .eq("challenge_id", challenge.id);
    // Get participant id for entry
    const { data: part } = await supabase
      .from("challenge_participants")
      .select("id")
      .eq("user_id", user.id)
      .eq("challenge_id", challenge.id)
      .maybeSingle();
    if (part) {
      await supabase.from("challenge_entries").insert({
        participant_id: (part as any).id,
        user_id: user.id,
        value: val,
      } as any);
    }
    setCurrentValue(newVal);
    setProgressInput("");
    toast({ title: `+${val} logged!`, description: `Total: ${newVal}` });
    loadLeaderboard();
    loadEntries();
    setActionLoading(false);
  };

  const handleVisibilityToggle = async (val: boolean) => {
    if (!user || !challenge) return;
    setPublicVisible(val);
    await supabase.from("challenge_participants").update({ is_public: val } as any).eq("user_id", user.id).eq("challenge_id", challenge.id);
    loadLeaderboard();
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e) { console.error("Portal error:", e); }
    finally { setPortalLoading(false); }
  };

  const athleteDisplay = profile?.athlete_name || profile?.full_name || "Athlete";

  const getMedalIcon = (rank: number) => {
    if (rank === 0) return <Trophy size={14} className="text-primary" />;
    if (rank === 1) return <Medal size={14} className="text-muted-foreground" />;
    if (rank === 2) return <Award size={14} className="text-primary/70" />;
    return <span className="text-[10px] font-mono font-bold text-muted-foreground w-3.5 text-center">{rank + 1}</span>;
  };

  const renderHome = () => (
    <div className="space-y-6">
      {/* Upcoming Sessions */}
      <UpcomingSessions />

      {/* Points Widget */}
      <PointsWidget onViewLeaderboard={() => setActiveTab("points")} />

      {/* Monthly Focus Section */}
      {focus ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Flame size={14} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Monthly Focus</span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
            </span>
          </div>
          <div className="bg-primary/5 border border-primary/20 p-5 space-y-4">
            <h3 className="text-lg font-black uppercase tracking-tight text-foreground">{focus.title}</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{focus.topic}</p>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{focus.reasoning}</div>
            {focus.exercises.length > 0 && (
              <div className="bg-card border border-border p-4 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">This Month's Drills</span>
                {focus.exercises.map((ex, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-primary font-bold text-sm w-5">{i + 1}.</span>
                    <span className="text-sm text-foreground font-mono">{ex}</span>
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
      ) : (
        <div className="bg-primary/5 border border-primary/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Flame size={14} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Monthly Focus</span>
          </div>
          <h3 className="text-base font-bold text-foreground mb-2">Skills in the Gym</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every month I shift what we focus on to make sure we're building BALANCED athletes. It could be our bracing technique every workout for a month, or we focus the next month on rolling out our calves or psoas — oh my favorite, the psoas. Then we shift to balance: on our toes, our heels, inside, outside, backwards. You name it, I've thought of it. The skill of understanding how to listen to your body — I can teach that by shifting what we focus on.
          </p>
          <p className="text-xs text-muted-foreground mt-3 italic">
            "The athletes who master the boring stuff are the ones who never get hurt." — Matt
          </p>
        </div>
      )}

      {/* Monthly Challenge + Leaderboard */}
      {challenge ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Monthly Challenge</span>
          </div>
          <div className="bg-card border border-border p-5 space-y-4">
            <h3 className="text-lg font-black uppercase tracking-tight text-foreground">{challenge.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{challenge.description}</p>

            {optedIn ? (
              <div className="space-y-3">
                {/* Progress + Log */}
                <div className="bg-muted p-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Your Progress</span>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-mono font-bold text-primary">{currentValue}</span>
                    <span className="text-xs text-muted-foreground">{challenge.metric_label}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <input
                        type="number"
                        placeholder={`+${challenge.metric_label}`}
                        value={progressInput}
                        onChange={(e) => setProgressInput(e.target.value)}
                        className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-8 w-20"
                      />
                      <button
                        onClick={handleLogProgress}
                        disabled={actionLoading}
                        className="bg-primary text-primary-foreground h-8 px-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1"
                      >
                        {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        Log
                      </button>
                    </div>
                  </div>
                </div>

                {/* Visibility */}
                <div className="flex items-center justify-between bg-muted p-3">
                  <div className="flex items-center gap-2">
                    {publicVisible ? <Eye size={14} className="text-primary" /> : <EyeOff size={14} className="text-muted-foreground" />}
                    <span className="text-xs font-bold text-foreground">
                      {publicVisible ? "On leaderboard" : "Coach only"}
                    </span>
                  </div>
                  <Switch checked={publicVisible} onCheckedChange={handleVisibilityToggle} />
                </div>

                {/* My Entries */}
                {entries.length > 0 && (
                  <div className="bg-muted p-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Your Entries</span>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {entries.map((e, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="font-mono text-primary font-bold">+{e.value}</span>
                          <span className="text-muted-foreground font-mono">
                            {new Date(e.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleOptIn}
                disabled={actionLoading}
                className="bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={14} />}
                Join Challenge
              </button>
            )}
          </div>

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="mt-4 bg-card border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted flex items-center gap-2">
                <Trophy size={12} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Leaderboard</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{leaderboard.length} public</span>
              </div>
              <div className="divide-y divide-border">
                {leaderboard.map((entry, idx) => {
                  const name = entry.athlete_name || entry.full_name || "Athlete";
                  const isYou = entry.user_id === user?.id;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 px-4 py-2.5 transition-all ${isYou ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                    >
                      <div className="w-5 flex justify-center">{getMedalIcon(idx)}</div>
                      <span className={`text-sm font-bold flex-1 ${isYou ? "text-primary" : "text-foreground"}`}>
                        {name}
                        {isYou && <span className="text-[9px] text-primary ml-1.5 font-mono uppercase">(you)</span>}
                      </span>
                      <span className="text-lg font-mono font-bold text-primary">{entry.current_value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border p-5 text-center">
          <Trophy size={24} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No active challenge this month. Check back soon!</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Welcome back, {athleteDisplay}</h2>
              {isLegend ? (
                <Badge className="flex items-center gap-1 text-[10px] uppercase tracking-widest bg-primary text-primary-foreground">
                  <Crown size={10} />
                  M² Legend
                </Badge>
              ) : subscriptionTier ? (
                <Badge className="flex items-center gap-1 text-[10px] uppercase tracking-widest">
                  <Crown size={10} />
                  {TIERS[subscriptionTier].name}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Free</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Your training portal · Real training, real results</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/profile"
              className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-all"
            >
              <User size={12} />
              Profile
            </Link>
            {subscribed && (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
              >
                {portalLoading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                Manage Plan
              </button>
            )}
          </div>
        </div>

        {/* Studio Check-In */}
        <StudioCheckIn />

        {/* Tab switcher */}
        <div className="flex gap-1 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "home" && renderHome()}
        {activeTab === "progress" && <ProgressCharts />}
        {activeTab === "programs" && <MyPrograms />}
        {activeTab === "workouts" && <WorkoutsTab />}
        {activeTab === "points" && <PointsLeaderboard />}
        {activeTab === "referrals" && <ReferralDashboard />}
      </div>

      {/* Floating timer button */}
      {!showTimer && (
        <button
          onClick={() => setShowTimer(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:opacity-90 transition-all rounded-full"
          aria-label="Open interval timer"
        >
          <Timer size={24} />
        </button>
      )}
      {showTimer && <IntervalTimer onClose={() => setShowTimer(false)} />}
    </div>
  );
};

export default Dashboard;
