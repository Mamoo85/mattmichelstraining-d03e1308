import { useState, useEffect, useCallback } from "react";
import { Trophy, Flame, Target, Send, Clock, Users, Star, Eye, EyeOff, Loader2 } from "lucide-react";
import SectionHeader from "./SectionHeader";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import ChallengeLeaderboard from "./ChallengeLeaderboard";

interface Challenge {
  id: string;
  title: string;
  description: string;
  duration: string;
  type: "strength" | "consistency" | "community";
  difficulty: "beginner" | "intermediate" | "advanced";
  reward: string;
  participants?: number;
}

const MONTHLY_FOCUS = {
  month: "March 2026",
  title: "The Foundation Reset",
  description: "This month we're going back to basics. Every workout starts with the McGill Big 3, every session ends with mobility work. The athletes who master the basics are the ones who never get hurt. That's the goal.",
  exercises: [
    "McGill Curl-Up — 3×8 (hold 8 sec)",
    "Side Plank — 3×20 sec each side",
    "Bird Dog — 3×6 each side (hold 10 sec)",
    "World's Greatest Stretch — 2×5 each side",
  ],
};

const CURRENT_CHALLENGE: Challenge = {
  id: "push-up-30",
  title: "30-Day Push-Up Challenge",
  description: "Start at 10 push-ups on day 1. Add 2 per day. By day 30, you're hitting 68 perfect push-ups. Strict form only — if the hips sag, the rep doesn't count.",
  duration: "30 days",
  type: "strength",
  difficulty: "beginner",
  reward: "Push-Up Warrior badge + logged on your profile",
  participants: 47,
};

const ChallengeSystem = () => {
  const { user, subscribed } = useAuth();
  const [suggestion, setSuggestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [optedIn, setOptedIn] = useState(false);
  const [publicVisible, setPublicVisible] = useState(false);
  const [currentValue, setCurrentValue] = useState(0);
  const [progressInput, setProgressInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [leaderboardKey, setLeaderboardKey] = useState(0);

  const fetchParticipation = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("challenge_participants" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("challenge_id", CURRENT_CHALLENGE.id)
      .maybeSingle();
    if (data) {
      setOptedIn(true);
      setPublicVisible((data as any).is_public);
      setCurrentValue((data as any).current_value);
    } else {
      setOptedIn(false);
      setPublicVisible(false);
      setCurrentValue(0);
    }
  }, [user]);

  useEffect(() => {
    fetchParticipation();
  }, [fetchParticipation]);

  const handleOptIn = async () => {
    if (!subscribed) {
      toast({ title: "Members only", description: "Subscribe to join challenges.", variant: "destructive" });
      return;
    }
    if (!user) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("challenge_participants" as any)
      .insert({ user_id: user.id, challenge_id: CURRENT_CHALLENGE.id, is_public: false, current_value: 0 } as any);
    if (error) {
      toast({ title: "Failed to join", description: error.message, variant: "destructive" });
    } else {
      setOptedIn(true);
      toast({ title: "You're in!", description: "Challenge accepted. Let's go." });
    }
    setActionLoading(false);
  };

  const handleOptOut = async () => {
    if (!user) return;
    setActionLoading(true);
    await supabase
      .from("challenge_participants" as any)
      .delete()
      .eq("user_id", user.id)
      .eq("challenge_id", CURRENT_CHALLENGE.id);
    setOptedIn(false);
    setPublicVisible(false);
    setCurrentValue(0);
    setLeaderboardKey((k) => k + 1);
    toast({ title: "Opted out", description: "You can rejoin anytime." });
    setActionLoading(false);
  };

  const handleVisibilityToggle = async (val: boolean) => {
    if (!user) return;
    setPublicVisible(val);
    await supabase
      .from("challenge_participants" as any)
      .update({ is_public: val } as any)
      .eq("user_id", user.id)
      .eq("challenge_id", CURRENT_CHALLENGE.id);
    setLeaderboardKey((k) => k + 1);
  };

  const handleLogProgress = async () => {
    if (!user) return;
    const val = parseInt(progressInput);
    if (!val || val <= 0) {
      toast({ title: "Enter a number", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    const newVal = currentValue + val;
    const { error } = await supabase
      .from("challenge_participants" as any)
      .update({ current_value: newVal, updated_at: new Date().toISOString() } as any)
      .eq("user_id", user.id)
      .eq("challenge_id", CURRENT_CHALLENGE.id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      setCurrentValue(newVal);
      setProgressInput("");
      setLeaderboardKey((k) => k + 1);
      toast({ title: `+${val} logged!`, description: `Total: ${newVal}` });
    }
    setActionLoading(false);
  };

  const handleSuggest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion.trim()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    toast({ title: "Suggestion sent!", description: "Matt reviews every suggestion personally." });
    setSuggestion("");
    setSubmitting(false);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "strength": return <Flame size={14} className="text-primary" />;
      case "consistency": return <Target size={14} className="text-primary" />;
      case "community": return <Users size={14} className="text-primary" />;
      default: return <Star size={14} className="text-primary" />;
    }
  };

  const difficultyColor = (d: string) => {
    switch (d) {
      case "beginner": return "text-muted-foreground";
      case "intermediate": return "text-foreground";
      case "advanced": return "text-primary";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* MONTHLY FOCUS PLAN */}
      <div>
        <SectionHeader title="Monthly Focus Plan" timestamp={`${MONTHLY_FOCUS.month} · Free for all members`} />
        <div className="bg-primary/10 border border-primary/20 p-5">
          <h3 className="text-base font-bold text-foreground mb-2">{MONTHLY_FOCUS.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{MONTHLY_FOCUS.description}</p>
          <div className="space-y-2">
            {MONTHLY_FOCUS.exercises.map((ex, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-primary font-bold text-sm">{i + 1}.</span>
                <span className="text-sm text-foreground font-mono">{ex}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 italic">
            "Master the basics. The athletes who do the boring stuff perfectly are the ones who never get hurt." — Matt
          </p>
        </div>
      </div>

      {/* CURRENT CHALLENGE */}
      <div>
        <SectionHeader title="Member Challenge" timestamp="One challenge at a time — all in." />
        <div className="bg-card shadow-m2">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {typeIcon(CURRENT_CHALLENGE.type)}
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">{CURRENT_CHALLENGE.type}</span>
              <span className={`text-[11px] font-bold uppercase ${difficultyColor(CURRENT_CHALLENGE.difficulty)}`}>{CURRENT_CHALLENGE.difficulty}</span>
            </div>
            <h3 className="text-base font-bold text-foreground mb-2">{CURRENT_CHALLENGE.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{CURRENT_CHALLENGE.description}</p>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock size={11} /> {CURRENT_CHALLENGE.duration}
              </span>
              {CURRENT_CHALLENGE.participants && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users size={11} /> {CURRENT_CHALLENGE.participants} joined
                </span>
              )}
            </div>
            <div className="bg-primary/10 border border-primary/20 p-3 mb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Reward</span>
              <p className="text-sm text-foreground">{CURRENT_CHALLENGE.reward}</p>
            </div>

            {/* Opt-in / Opt-out */}
            {optedIn ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-3">
                  <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-primary" />
                    <span className="text-xs font-bold text-primary uppercase tracking-widest">You're in!</span>
                  </div>
                  <button
                    onClick={handleOptOut}
                    disabled={actionLoading}
                    className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive transition-all disabled:opacity-50"
                  >
                    Opt Out
                  </button>
                </div>

                {/* Current progress + log */}
                <div className="bg-muted p-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Your Progress</span>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-mono font-bold text-primary" style={{ textShadow: "0 0 10px hsl(var(--primary) / 0.3)" }}>
                      {currentValue}
                    </span>
                    <span className="text-xs text-muted-foreground">total push-ups</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <input
                        type="number"
                        placeholder="+reps"
                        value={progressInput}
                        onChange={(e) => setProgressInput(e.target.value)}
                        className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-8 w-20"
                      />
                      <button
                        onClick={handleLogProgress}
                        disabled={actionLoading}
                        className="bg-primary text-primary-foreground h-8 px-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 size={12} className="animate-spin" /> : "Log"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Visibility toggle */}
                <div className="flex items-center justify-between bg-muted p-3">
                  <div className="flex items-center gap-2">
                    {publicVisible ? <Eye size={14} className="text-primary" /> : <EyeOff size={14} className="text-muted-foreground" />}
                    <div>
                      <span className="text-xs font-bold text-foreground block">
                        {publicVisible ? "Numbers visible to everyone" : "Numbers visible to coach only"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {publicVisible ? "You appear on the leaderboard" : "Only Matt can see your challenge numbers"}
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={publicVisible}
                    onCheckedChange={handleVisibilityToggle}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={handleOptIn}
                disabled={actionLoading}
                className="bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={14} />}
                Join Challenge
              </button>
            )}

            {!subscribed && !optedIn && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Challenges are available to M² members only.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* LEADERBOARD */}
      <div>
        <SectionHeader title="Challenge Leaderboard" timestamp="Public participants only" />
        <ChallengeLeaderboard key={leaderboardKey} challengeId={CURRENT_CHALLENGE.id} currentUserId={user?.id} />
      </div>

      {/* CHALLENGE SUGGESTION */}
      <div>
        <SectionHeader title="Suggest a Challenge" timestamp="Matt reads every suggestion" />
        <div className="bg-card shadow-m2 p-5">
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Have an idea for a challenge? Something your team needs? A goal you want the community to chase? 
            Drop it here — Matt reviews every one and picks the best for next month.
          </p>
          <form onSubmit={handleSuggest} className="flex gap-2">
            <input
              type="text"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="e.g. '100 burpees in a week' or 'Perfect squat form for 30 days'"
              className="flex-1 bg-background border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground px-5 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50"
            >
              <Send size={14} />
              {submitting ? "..." : "Send"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChallengeSystem;
