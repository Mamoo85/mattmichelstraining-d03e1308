import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dumbbell, Trophy, Flame, Clock3, ChevronRight,
  MessageCircle, Play,
} from "lucide-react";

interface LastWorkout {
  exercise_name: string;
  logged_at: string;
  weight: number;
  reps: number;
}

interface CoachMessage {
  message: string;
  created_at: string;
}

interface AthleteProfileCardProps {
  displayName: string;
  streak: number;
  totalPoints: number;
  levelLabel: string;
  hasActiveWorkout: boolean;
  workoutName: string;
  phase: string;
  currentDay: number;
  onStartWorkout: () => void;
}

export default function AthleteProfileCard({
  displayName,
  streak,
  totalPoints,
  levelLabel,
  hasActiveWorkout,
  workoutName,
  phase,
  currentDay,
  onStartWorkout,
}: AthleteProfileCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lastWorkout, setLastWorkout] = useState<LastWorkout | null>(null);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [totalPRs, setTotalPRs] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [lastLogRes, allLogsRes, activityLogsRes, prCountRes, msgsRes] = await Promise.all([
          supabase
            .from("progress_logs")
            .select("exercise_name, logged_at, weight, reps")
            .eq("user_id", user.id)
            .order("logged_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("progress_logs")
            .select("logged_at")
            .eq("user_id", user.id),
          supabase
            .from("activity_logs")
            .select("logged_at")
            .eq("user_id", user.id),
          supabase
            .from("pr_submissions")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "approved"),
          supabase
            .from("coach_direct_messages")
            .select("message, created_at")
            .eq("user_id", user.id)
            .eq("sender_role", "admin")
            .order("created_at", { ascending: false })
            .limit(2),
        ]);

        if (lastLogRes.data) setLastWorkout(lastLogRes.data);

        // Count unique days from both progress_logs AND activity_logs
        const progressDays = (allLogsRes.data || []).map((l: any) => l.logged_at?.slice(0, 10));
        const activityDays = (activityLogsRes.data || []).map((l: any) => l.logged_at?.slice(0, 10));
        const uniqueDays = new Set([...progressDays, ...activityDays].filter(Boolean));
        setTotalWorkouts(uniqueDays.size);

        setTotalPRs(prCountRes.count || 0);
        if (msgsRes.data) setCoachMessages(msgsRes.data);
      } catch (e) {
        console.error("[AthleteProfileCard]", e);
      }
    };
    load();
  }, [user]);

  const initials = displayName
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="w-full">
      <div
        className="w-full rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #161610 0%, #1a1a12 100%)",
          border: "1px solid rgba(232,98,26,0.2)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        }}
      >
        {/* Orange accent */}
        <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg, #e8621a, #f97316, rgba(249,115,22,0.3))" }} />

        <div className="p-3 space-y-2.5">
          {/* Profile header */}
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-3 w-full text-left group"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-oswald font-black text-xs flex-shrink-0"
              style={{ background: "rgba(232,98,26,0.2)", color: "#e8621a", boxShadow: "0 0 12px rgba(232,98,26,0.3)" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{displayName}</p>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#e8621a" }}>
                {levelLabel}
              </p>
            </div>
            <ChevronRight size={14} className="flex-shrink-0 opacity-40 group-hover:opacity-70 transition-opacity" style={{ color: "#e8621a" }} />
          </button>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { icon: <Dumbbell size={12} />, value: totalWorkouts, label: "Workouts" },
              { icon: <Trophy size={12} />, value: totalPRs, label: "PRs" },
              { icon: <Flame size={12} />, value: streak, label: "Streak" },
              { icon: <Clock3 size={12} />, value: totalPoints.toLocaleString(), label: "Points" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="text-center py-1.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div className="flex justify-center mb-0.5" style={{ color: "#e8621a" }}>{stat.icon}</div>
                <div className="font-oswald text-base font-black leading-none text-white">{stat.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "#525252" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Active workout banner */}
          {hasActiveWorkout && (
            <button
              onClick={onStartWorkout}
              className="w-full flex items-center gap-2.5 rounded-xl p-2.5 transition-all active:scale-[0.98]"
              style={{ background: "rgba(232,98,26,0.1)", border: "1px solid rgba(232,98,26,0.2)" }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(232,98,26,0.25)", boxShadow: "0 0 10px rgba(232,98,26,0.3)" }}
              >
                <Play size={10} className="fill-[#e8621a] text-[#e8621a]" style={{ marginLeft: 1 }} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-black uppercase text-white truncate max-w-[160px]">{workoutName}</p>
                <p className="text-[10px]" style={{ color: "#525252" }}>{phase} · Day {currentDay}</p>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "#e8621a" }}>
                Start
              </span>
            </button>
          )}

          {/* Last workout */}
          {lastWorkout && (
            <div className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#404040" }}>
                Last Session
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white truncate">{lastWorkout.exercise_name}</p>
                <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: "#525252" }}>
                  {formatDate(lastWorkout.logged_at)}
                </span>
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: "#525252" }}>
                {lastWorkout.weight}lbs × {lastWorkout.reps} reps
              </p>
            </div>
          )}

          {/* Coach messages */}
          {coachMessages.length > 0 && (
            <div className="rounded-xl p-2.5" style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.1)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5" style={{ color: "#f97316" }}>
                <MessageCircle size={10} /> From Coach Matt
              </p>
              {coachMessages.map((msg, i) => (
                <div key={i} className={i > 0 ? "mt-1.5 pt-1.5 border-t border-white/5" : ""}>
                  <p className="text-xs text-white/80 leading-relaxed line-clamp-2">{msg.message}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#404040" }}>{formatDate(msg.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
