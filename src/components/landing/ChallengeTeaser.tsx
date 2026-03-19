import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ChallengeTeaser = () => {
  const [focusTitle, setFocusTitle] = useState<string | null>(null);
  const [challengeTitle, setChallengeTitle] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    supabase
      .from("monthly_focus")
      .select("title, topic")
      .eq("month", month)
      .eq("year", year)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setFocusTitle(`This Month's Focus: ${(data as any).title}`);
      });

    supabase
      .from("monthly_challenges")
      .select("title")
      .eq("month", month)
      .eq("year", year)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setChallengeTitle((data as any).title);
      });
  }, []);

  const TOP_3 = [
    { rank: 1, name: "Jake M.", value: 215, avatar: "🥇" },
    { rank: 2, name: "Riley S.", value: 188, avatar: "🥈" },
    { rank: 3, name: "Aiden T.", value: 172, avatar: "🥉" },
  ];

  return (
    <div className="relative bg-card border-2 border-border overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <Flame size={18} className="text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-primary">
            Community Challenge
          </span>
        </div>
        <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">
          {challengeTitle || focusTitle || "Monthly Training Challenge"}
        </h3>
        {focusTitle && challengeTitle && (
          <p className="text-xs text-muted-foreground">{focusTitle}</p>
        )}
      </div>

      {/* Public top-3 leaderboard */}
      <div className="px-5 pb-2 space-y-1.5">
        {TOP_3.map((entry) => (
          <div
            key={entry.rank}
            className={`flex items-center gap-3 px-3 py-2.5 ${
              entry.rank === 1
                ? "bg-primary/10 border border-primary/30"
                : "bg-muted/30 border border-transparent"
            }`}
          >
            <span className="text-base">{entry.avatar}</span>
            <span className="text-xs font-bold text-foreground flex-1">
              {entry.name}
            </span>
            <span className="text-sm font-black font-mono text-primary">
              {entry.value}
            </span>
          </div>
        ))}
      </div>

      {/* Blurred remaining spots */}
      <div className="relative mx-5 mb-2">
        <div className="space-y-1 blur-[4px] opacity-40 select-none pointer-events-none">
          {[4, 5, 6].map((r) => (
            <div key={r} className="flex items-center gap-3 bg-muted/30 px-3 py-2">
              <span className="text-[10px] font-mono text-muted-foreground w-4">{r}</span>
              <span className="text-xs text-muted-foreground flex-1">████████</span>
              <span className="text-xs font-mono text-muted-foreground">███</span>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Join to see full leaderboard
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-5 pt-2">
        <Link
          to="/auth?redirect=/trial-welcome?path=basic"
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors"
        >
          Join the Challenge — Start Free Trial
        </Link>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          14-day free trial · No commitment · Cancel anytime
        </p>
      </div>
    </div>
  );
};

export default ChallengeTeaser;
