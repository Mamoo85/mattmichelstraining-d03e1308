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
            <button className="bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2">
              <Trophy size={14} />
              Join Challenge
            </button>
          </div>
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
