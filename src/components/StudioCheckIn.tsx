import { useState, useEffect, useMemo } from "react";
import { MapPin, Share2, Flame, CalendarCheck, Trophy, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface CheckIn {
  id: string;
  checked_in_at: string;
}

interface Milestone {
  label: string;
  detail: string;
  emoji: string;
  achieved: boolean;
}

const StudioCheckIn = () => {
  const { user } = useAuth();
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("studio_checkins")
      .select("id, checked_in_at")
      .eq("user_id", user.id)
      .order("checked_in_at", { ascending: false })
      .then(({ data }) => {
        setCheckins((data as CheckIn[]) || []);
        setLoading(false);
      });
  }, [user]);

  const alreadyCheckedInToday = useMemo(() => {
    const today = new Date().toDateString();
    return checkins.some((c) => new Date(c.checked_in_at).toDateString() === today);
  }, [checkins]);

  const milestones = useMemo(() => {
    if (checkins.length === 0) return [];
    const dates = checkins.map((c) => new Date(c.checked_in_at));
    const daySet = new Set(dates.map((d) => d.toDateString()));
    const totalSessions = daySet.size;

    // Weekly consistency: check consecutive weeks with at least 1 session
    const getWeekKey = (d: Date) => {
      const year = d.getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
      return `${year}-W${weekNum}`;
    };
    const weekSet = new Set(dates.map(getWeekKey));
    const sortedWeeks = [...weekSet].sort();

    // Count consecutive weeks from most recent
    let consecutiveWeeks = 0;
    const currentWeek = getWeekKey(new Date());
    // Find the most recent week in sorted weeks
    for (let i = sortedWeeks.length - 1; i >= 0; i--) {
      const [y, w] = sortedWeeks[i].split("-W").map(Number);
      if (i === sortedWeeks.length - 1) {
        // Most recent week must be current or last week
        const cw = parseInt(currentWeek.split("-W")[1]);
        const cy = parseInt(currentWeek.split("-W")[0]);
        if (cy === y && (cw === w || cw - w === 1)) {
          consecutiveWeeks = 1;
        } else break;
      } else {
        const [py, pw] = sortedWeeks[i + 1].split("-W").map(Number);
        if (y === py && pw - w === 1) {
          consecutiveWeeks++;
        } else if (y === py - 1 && w >= 50 && pw <= 2) {
          // Year boundary
          consecutiveWeeks++;
        } else break;
      }
    }

    // Count weeks with 2+ sessions
    const weekSessionCount: Record<string, number> = {};
    dates.forEach((d) => {
      const wk = getWeekKey(d);
      const dayStr = d.toDateString();
      // Only count unique days per week
      const key = `${wk}-${dayStr}`;
      if (!weekSessionCount[key]) {
        weekSessionCount[wk] = (weekSessionCount[wk] || 0) + 1;
        weekSessionCount[key] = 1;
      }
    });
    // Actually recount properly
    const weekDayCounts: Record<string, Set<string>> = {};
    dates.forEach((d) => {
      const wk = getWeekKey(d);
      if (!weekDayCounts[wk]) weekDayCounts[wk] = new Set();
      weekDayCounts[wk].add(d.toDateString());
    });
    let consecutiveDoubleWeeks = 0;
    for (let i = sortedWeeks.length - 1; i >= 0; i--) {
      if ((weekDayCounts[sortedWeeks[i]]?.size || 0) >= 2) {
        consecutiveDoubleWeeks++;
      } else break;
    }

    // Same day-of-week streaks (e.g., every Monday)
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let bestDayStreak = { day: "", weeks: 0 };
    for (let dow = 0; dow < 7; dow++) {
      const datesOnDay = [...daySet]
        .map((s) => new Date(s))
        .filter((d) => d.getDay() === dow)
        .sort((a, b) => b.getTime() - a.getTime());

      let streak = 0;
      for (let i = 0; i < datesOnDay.length; i++) {
        if (i === 0) {
          // Must be within last 2 weeks
          const daysSince = (Date.now() - datesOnDay[i].getTime()) / 86400000;
          if (daysSince <= 14) streak = 1;
          else break;
        } else {
          const gap = (datesOnDay[i - 1].getTime() - datesOnDay[i].getTime()) / 86400000;
          if (gap >= 5 && gap <= 9) streak++;
          else break;
        }
      }
      if (streak > bestDayStreak.weeks) {
        bestDayStreak = { day: dayNames[dow], weeks: streak };
      }
    }

    // Monthly consistency
    const monthSet = new Set(dates.map((d) => `${d.getFullYear()}-${d.getMonth()}`));
    const sortedMonths = [...monthSet].sort();
    let consecutiveMonths = 0;
    for (let i = sortedMonths.length - 1; i >= 0; i--) {
      if (i === sortedMonths.length - 1) {
        const now = new Date();
        const cm = `${now.getFullYear()}-${now.getMonth()}`;
        const lm = `${now.getFullYear()}-${now.getMonth() - 1}`;
        if (sortedMonths[i] === cm || sortedMonths[i] === lm) {
          consecutiveMonths = 1;
        } else break;
      } else {
        const [y1, m1] = sortedMonths[i].split("-").map(Number);
        const [y2, m2] = sortedMonths[i + 1].split("-").map(Number);
        if ((y1 === y2 && m2 - m1 === 1) || (y2 === y1 + 1 && m1 === 11 && m2 === 0)) {
          consecutiveMonths++;
        } else break;
      }
    }

    const results: Milestone[] = [];

    // Total milestones
    if (totalSessions >= 5) results.push({ label: `${totalSessions} Total Sessions`, detail: "Keep showing up!", emoji: "💪", achieved: true });
    if (totalSessions >= 25) results.push({ label: "25 Sessions Club", detail: "You're building a real habit", emoji: "🏅", achieved: true });
    if (totalSessions >= 50) results.push({ label: "50 Sessions!", detail: "Half-century of hard work", emoji: "🔥", achieved: true });
    if (totalSessions >= 100) results.push({ label: "💯 Sessions", detail: "100 sessions. Legendary.", emoji: "🏆", achieved: true });

    // Weekly streak
    if (consecutiveWeeks >= 4) results.push({ label: `${consecutiveWeeks}-Week Streak`, detail: `Trained at least once a week for ${consecutiveWeeks} straight weeks`, emoji: "📅", achieved: true });
    if (consecutiveWeeks >= 2 && consecutiveWeeks < 4) results.push({ label: `${consecutiveWeeks}-Week Streak`, detail: "Building momentum!", emoji: "📅", achieved: true });

    // Double sessions per week
    if (consecutiveDoubleWeeks >= 4) results.push({ label: `2x/Week for ${consecutiveDoubleWeeks} Weeks`, detail: "Doubling down consistently", emoji: "⚡", achieved: true });

    // Same-day streak
    if (bestDayStreak.weeks >= 4) results.push({ label: `Every ${bestDayStreak.day} for ${bestDayStreak.weeks} Weeks`, detail: `${bestDayStreak.day}s are YOUR day`, emoji: "🗓️", achieved: true });

    // Monthly
    if (consecutiveMonths >= 2) results.push({ label: `${consecutiveMonths} Months Consistent`, detail: "Month after month — this is a lifestyle", emoji: "🌟", achieved: true });

    // Next milestone to chase
    if (totalSessions < 5) results.push({ label: "5 Sessions", detail: `${5 - totalSessions} more to go!`, emoji: "🎯", achieved: false });
    else if (totalSessions < 25) results.push({ label: "25 Sessions", detail: `${25 - totalSessions} more to go!`, emoji: "🎯", achieved: false });
    else if (totalSessions < 50) results.push({ label: "50 Sessions", detail: `${50 - totalSessions} more to go!`, emoji: "🎯", achieved: false });

    if (consecutiveWeeks < 4) results.push({ label: "4-Week Streak", detail: `${4 - consecutiveWeeks} more weeks to go`, emoji: "🎯", achieved: false });

    return results;
  }, [checkins]);

  const handleCheckIn = async () => {
    if (!user || alreadyCheckedInToday) return;
    setChecking(true);
    const { data, error } = await supabase
      .from("studio_checkins")
      .insert({ user_id: user.id } as any)
      .select("id, checked_in_at")
      .single();
    if (error) {
      toast({ title: "Check-in failed", description: error.message, variant: "destructive" });
    } else if (data) {
      setCheckins((prev) => [data as CheckIn, ...prev]);
      setJustCheckedIn(true);
      setShowMilestones(true);
      toast({ title: "🏋️ Checked in!", description: "Great work showing up today." });
      setTimeout(() => setJustCheckedIn(false), 3000);
    }
    setChecking(false);
  };

  const handleShare = async () => {
    const totalDays = new Set(checkins.map((c) => new Date(c.checked_in_at).toDateString())).size;
    const achievedMilestones = milestones.filter((m) => m.achieved);
    const topMilestone = achievedMilestones[0];

    let text = `🏋️ Just checked in at M² Training! ${totalDays} total sessions.`;
    if (topMilestone) {
      text = `${topMilestone.emoji} ${topMilestone.label} at M² Training! ${topMilestone.detail} #M2Training #NeverMissADay`;
    } else {
      text += " #M2Training";
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: "M² Training Check-In", text });
      } catch {
        // User cancelled — that's fine
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: "Share text copied to clipboard." });
    }
  };

  if (loading) return null;

  const totalDays = new Set(checkins.map((c) => new Date(c.checked_in_at).toDateString())).size;
  const achievedMilestones = milestones.filter((m) => m.achieved);
  const nextMilestones = milestones.filter((m) => !m.achieved);

  return (
    <div className="space-y-3">
      {/* Check-in bar */}
      <div className="bg-card border border-border p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCheckIn}
            disabled={checking || alreadyCheckedInToday}
            className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-60 ${
              alreadyCheckedInToday
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {checking ? (
              <Loader2 size={14} className="animate-spin" />
            ) : alreadyCheckedInToday ? (
              <Check size={14} />
            ) : (
              <MapPin size={14} />
            )}
            {alreadyCheckedInToday ? "Checked In Today" : "Check In at Studio"}
          </button>

          <div className="flex items-center gap-3 ml-auto text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarCheck size={12} />
              <span className="font-mono font-bold text-foreground">{totalDays}</span>
              <span>sessions</span>
            </div>
            {achievedMilestones.length > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Flame size={12} className="text-primary" />
                <span className="font-mono font-bold text-foreground">{achievedMilestones.length}</span>
                <span>milestones</span>
              </div>
            )}
          </div>

          {totalDays > 0 && (
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-all"
            >
              <Share2 size={12} />
              Share
            </button>
          )}
        </div>
      </div>

      {/* Milestones panel (collapsible) */}
      {showMilestones && milestones.length > 0 && (
        <div className="bg-card border border-border overflow-hidden">
          <button
            onClick={() => setShowMilestones(false)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-muted hover:bg-muted/80 transition-all"
          >
            <div className="flex items-center gap-2">
              <Trophy size={12} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Milestones & Streaks
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">tap to close</span>
          </button>

          <div className="p-4 space-y-2">
            {/* Achieved */}
            {achievedMilestones.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-primary/5 border border-primary/10 p-3"
              >
                <span className="text-lg">{m.emoji}</span>
                <div className="flex-1">
                  <span className="text-sm font-bold text-foreground block">{m.label}</span>
                  <span className="text-[11px] text-muted-foreground">{m.detail}</span>
                </div>
                <button
                  onClick={async () => {
                    const text = `${m.emoji} ${m.label} at M² Training! ${m.detail} #M2Training`;
                    if (navigator.share) {
                      try { await navigator.share({ title: "M² Training", text }); } catch {}
                    } else {
                      await navigator.clipboard.writeText(text);
                      toast({ title: "Copied!", description: "Milestone copied to clipboard." });
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground transition-all"
                >
                  <Share2 size={14} />
                </button>
              </div>
            ))}

            {/* Next goals */}
            {nextMilestones.length > 0 && (
              <>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block pt-2">
                  Next Goals
                </span>
                {nextMilestones.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 bg-muted p-3 opacity-70">
                    <span className="text-lg">{m.emoji}</span>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-foreground block">{m.label}</span>
                      <span className="text-[11px] text-muted-foreground">{m.detail}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Toggle milestones if hidden and there are some */}
      {!showMilestones && milestones.length > 0 && totalDays > 0 && (
        <button
          onClick={() => setShowMilestones(true)}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
        >
          <Trophy size={12} className="text-primary" />
          View Milestones & Streaks
        </button>
      )}
    </div>
  );
};

export default StudioCheckIn;
