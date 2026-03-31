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
        // Last workout
        const { data: lastLog } = await supabase
          .from("progress_logs")
          .select("exercise_name, logged_at, weight, reps")
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastLog) setLastWorkout(lastLog);

        // Total workouts (unique days)
        const { data: allLogs } = await supabase
          .from("progress_logs")
          .select("logged_at")
          .eq("user_id", user.id);
        if (allLogs) {
          const uniqueDays = new Set(allLogs.map(l => l.logged_at.slice(0, 10)));
          setTotalWorkouts(uniqueDays.size);
        }

        // PR count
        const { count: prCount } = await supabase
          .from("pr_submissions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "approved");
        setTotalPRs(prCount || 0);

        // Coach messages (latest 2)
        const { data: msgs } = await supabase
          .from("coach_direct_messages")
          .select("message, created_at")
          .eq("user_id", user.id)
          .eq("sender_role", "admin")
          .order("created_at", { ascending: false })
          .limit(2);
        if (msgs) setCoachMessages(msgs);
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
    <div className="w-full px-4 mb-2">
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

        <div className="p-4 space-y-3">
          {/* Profile header */}
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-3 w-full text-left group"
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center font-oswald font-black text-sm flex-shrink-0"
              style={{ background: "rgba(232,98,26,0.2)", color: "#e8621a", boxShadow: "0 0 12px rgba(232,98,26,0.3)" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{displayName}</p>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#e8621a" }}>
                {levelLabel}
              </p>
            </div>
            <ChevronRight size={16} className="flex-shrink-0 opacity-40 group-hover:opacity-70 transition-opacity" style={{ color: "#e8621a" }} />
          </button>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: <Dumbbell size={13} />, value: totalWorkouts, label: "Workouts" },
              { icon: <Trophy size={13} />, value: totalPRs, label: "PRs" },
              { icon: <Flame size={13} />, value: streak, label: "Streak" },
              { icon: <Clock3 size={13} />, value: totalPoints.toLocaleString(), label: "Points" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="text-center py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div className="flex justify-center mb-1" style={{ color: "#e8621a" }}>{stat.icon}</div>
                <div className="font-oswald text-lg font-black leading-none text-white">{stat.value}</div>
                <div className="text-xs font-bold uppercase tracking-widest mt-0.5" style={{ color: "#525252" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Active workout banner */}
          {hasActiveWorkout && (
            <button
              onClick={onStartWorkout}
              className="w-full flex items-center gap-3 rounded-xl p-3 transition-all active:scale-[0.98]"
              style={{ background: "rgba(232,98,26,0.1)", border: "1px solid rgba(232,98,26,0.2)" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(232,98,26,0.25)", boxShadow: "0 0 10px rgba(232,98,26,0.3)" }}
              >
                <Play size={12} className="fill-[#e8621a] text-[#e8621a]" style={{ marginLeft: 1 }} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-black uppercase text-white truncate">{workoutName}</p>
                <p className="text-xs" style={{ color: "#525252" }}>{phase} · Day {currentDay}</p>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "#e8621a" }}>
                Start
              </span>
            </button>
          )}

          {/* Last workout */}
          {lastWorkout && (
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#404040" }}>
                Last Session
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white truncate">{lastWorkout.exercise_name}</p>
                <span className="text-xs flex-shrink-0 ml-2" style={{ color: "#525252" }}>
                  {formatDate(lastWorkout.logged_at)}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "#525252" }}>
                {lastWorkout.weight}lbs × {lastWorkout.reps} reps
              </p>
            </div>
          )}

          {/* Coach messages */}
          {coachMessages.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.1)" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "#f97316" }}>
                <MessageCircle size={11} /> From Coach Matt
              </p>
              {coachMessages.map((msg, i) => (
                <div key={i} className={i > 0 ? "mt-2 pt-2 border-t border-white/5" : ""}>
                  <p className="text-xs text-white/80 leading-relaxed line-clamp-2">{msg.message}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#404040" }}>{formatDate(msg.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
