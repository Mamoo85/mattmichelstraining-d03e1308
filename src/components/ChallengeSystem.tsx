import { useState } from "react";
import { Trophy, Flame, Target, Send, ChevronDown, ChevronUp, Clock, Users, Star } from "lucide-react";
import SectionHeader from "./SectionHeader";
import { toast } from "@/hooks/use-toast";

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

const ACTIVE_CHALLENGES: Challenge[] = [
  {
    id: "push-up-30",
    title: "30-Day Push-Up Challenge",
    description: "Start at 10 push-ups on day 1. Add 2 per day. By day 30, you're hitting 68 perfect push-ups. Strict form only — if the hips sag, the rep doesn't count.",
    duration: "30 days",
    type: "strength",
    difficulty: "beginner",
    reward: "Push-Up Warrior badge + logged on your profile",
    participants: 47,
  },
  {
    id: "consistency-21",
    title: "21-Day Streak",
    description: "Log a workout every day for 21 days straight. It doesn't have to be heavy — mobility, the monthly focus plan, a 20-minute session — it counts. The habit is the goal.",
    duration: "21 days",
    type: "consistency",
    difficulty: "beginner",
    reward: "Iron Streak badge + Matt's personal shout-out",
    participants: 32,
  },
  {
    id: "dead-hang-challenge",
    title: "Dead Hang for 2 Minutes",
    description: "Build to a 2-minute dead hang. Start wherever you are. Log your time daily. Grip strength, shoulder health, spinal decompression — all in one. Matt's favorite minimum standard.",
    duration: "Ongoing",
    type: "strength",
    difficulty: "intermediate",
    reward: "Grip King badge",
    participants: 28,
  },
  {
    id: "fix-it-week",
    title: "Fix It Week",
    description: "7 days, 7 Fix It exercises. One new rehab exercise per day from the Fix It library. Do them all correctly and you've built a prehab routine that'll keep you healthy for years.",
    duration: "7 days",
    type: "community",
    difficulty: "beginner",
    reward: "Fix It Certified badge",
    participants: 19,
  },
];

const ChallengeSystem = () => {
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSuggest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion.trim()) return;
    setSubmitting(true);
    // In a real implementation, this would save to a challenge_suggestions table
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
      case "beginner": return "text-emerald-400";
      case "intermediate": return "text-amber-400";
      case "advanced": return "text-red-400";
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

      {/* ACTIVE CHALLENGES */}
      <div>
        <SectionHeader title="Member Challenges" timestamp={`${ACTIVE_CHALLENGES.length} active challenges`} />
        <div className="space-y-2">
          {ACTIVE_CHALLENGES.map((c) => {
            const isExpanded = expandedChallenge === c.id;
            return (
              <div
                key={c.id}
                className="bg-card shadow-m2 hover:bg-m2-surface-hover transition-m2 cursor-pointer"
                onClick={() => setExpandedChallenge(isExpanded ? null : c.id)}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {typeIcon(c.type)}
                      <span className="text-[11px] font-bold uppercase tracking-widest text-primary">{c.type}</span>
                      <span className={`text-[11px] font-bold uppercase ${difficultyColor(c.difficulty)}`}>{c.difficulty}</span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{c.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={11} /> {c.duration}
                      </span>
                      {c.participants && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users size={11} /> {c.participants} joined
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-muted-foreground flex-shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />}
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    <p className="text-sm text-foreground leading-relaxed">{c.description}</p>
                    <div className="bg-primary/10 border border-primary/20 p-3">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Reward</span>
                      <p className="text-sm text-foreground">{c.reward}</p>
                    </div>
                    <button className="bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2">
                      <Trophy size={14} />
                      Join Challenge
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
