import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Flame, TrendingUp } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, ReferenceLine } from "recharts";
import { supabase } from "@/integrations/supabase/client";

// Fake cumulative data for the blurred teaser chart
const FAKE_DATA = [
  { d: "Mar 1", v: 0 }, { d: "Mar 4", v: 12 }, { d: "Mar 7", v: 28 },
  { d: "Mar 10", v: 45 }, { d: "Mar 13", v: 68 }, { d: "Mar 16", v: 82 },
  { d: "Mar 19", v: 110 }, { d: "Mar 22", v: 135 }, { d: "Mar 25", v: 158 },
  { d: "Mar 28", v: 172 },
];

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

      {/* Blurred chart teaser */}
      <div className="relative h-36 mx-5 mb-2">
        <div className="absolute inset-0 blur-[6px] opacity-60 select-none pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={FAKE_DATA} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="teaserGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(18, 82%, 50%)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(18, 82%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <ReferenceLine y={180} stroke="hsl(0,0%,35%)" strokeDasharray="4 4" strokeWidth={1} />
              <Area
                type="monotone"
                dataKey="v"
                stroke="hsl(18, 82%, 50%)"
                strokeWidth={2}
                fill="url(#teaserGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Stats overlay */}
        <div className="absolute inset-0 flex items-end justify-between px-1 pb-1 blur-[4px] opacity-40 select-none pointer-events-none">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-mono font-black text-primary">172</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">reps</span>
          </div>
          <div className="flex items-center gap-1 text-primary">
            <TrendingUp size={12} />
            <span className="text-[9px] font-bold uppercase tracking-widest">+22 today</span>
          </div>
        </div>

        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/30 backdrop-blur-[2px]">
          <Lock size={20} className="text-primary mb-2" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Members Only
          </span>
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
