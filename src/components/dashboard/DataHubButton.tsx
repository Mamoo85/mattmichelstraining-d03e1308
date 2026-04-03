import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Flame, Dumbbell, Activity, TrendingUp, Zap, Target, Trophy, Calendar, Brain } from "lucide-react";

interface StatSlide {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

const DataHubButton = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [slides, setSlides] = useState<StatSlide[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [actRes, progRes, checkinRes, recoveryRes] = await Promise.all([
        supabase.from("activity_logs").select("id, duration_minutes, intensity", { count: "exact" }).eq("user_id", user.id),
        supabase.from("progress_logs").select("id, weight, reps, exercise_name, logged_at", { count: "exact" }).eq("user_id", user.id).order("logged_at", { ascending: false }),
        supabase.from("studio_checkins" as any).select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("recovery_logs" as any).select("id, sleep_hours, energy_level", { count: "exact" }).eq("user_id", user.id),
      ]);

      const totalActivities = actRes.count ?? 0;
      const totalCheckins = checkinRes.count ?? 0;
      const progressData = progRes.data || [];
      const totalLifts = progRes.count ?? 0;
      const recoveryData = (recoveryRes.data || []) as any[];

      // Calculate total volume
      let totalVolume = 0;
      progressData.forEach((l: any) => { totalVolume += (l.weight || 0) * (l.reps || 0); });
      const volumeLabel = totalVolume >= 1000000 ? `${(totalVolume / 1000000).toFixed(1)}M` : totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(0)}K` : `${totalVolume}`;

      // Top lift
      const topLift = progressData.length > 0 ? progressData.reduce((a: any, b: any) => (a.weight > b.weight ? a : b)) : null;

      // Unique exercises
      const uniqueExercises = new Set(progressData.map((l: any) => l.exercise_name)).size;

      // Total duration
      const activities = actRes.data || [];
      const totalMinutes = activities.reduce((sum: number, a: any) => sum + (a.duration_minutes || 0), 0);
      const totalHours = Math.round(totalMinutes / 60);

      // Streak calculation
      const logDates = new Set(progressData.map((l: any) => new Date(l.logged_at).toISOString().slice(0, 10)));
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        if (logDates.has(d.toISOString().slice(0, 10))) streak++;
        else if (i > 0) break;
      }

      // Avg energy
      const avgEnergy = recoveryData.length > 0 ? (recoveryData.reduce((s, r) => s + (r.energy_level || 0), 0) / recoveryData.length).toFixed(1) : null;

      const s: StatSlide[] = [];

      s.push({ icon: <Activity size={16} />, label: "Total Activities", value: `${totalActivities}`, color: "#22c55e" });
      s.push({ icon: <Dumbbell size={16} />, label: "Lifts Logged", value: `${totalLifts}`, color: "#3b82f6" });

      if (totalVolume > 0) {
        s.push({ icon: <TrendingUp size={16} />, label: "Total Volume", value: `${volumeLabel} lbs`, color: "#f97316" });
      }
      if (topLift) {
        s.push({ icon: <Trophy size={16} />, label: `Top: ${topLift.exercise_name}`, value: `${topLift.weight} lbs`, color: "#eab308" });
      }
      if (uniqueExercises > 0) {
        s.push({ icon: <Target size={16} />, label: "Unique Exercises", value: `${uniqueExercises}`, color: "#ec4899" });
      }
      if (totalHours > 0) {
        s.push({ icon: <Calendar size={16} />, label: "Hours Trained", value: `${totalHours}h`, color: "#06b6d4" });
      }
      if (streak > 0) {
        s.push({ icon: <Flame size={16} />, label: "Current Streak", value: `${streak} day${streak !== 1 ? "s" : ""}`, color: "#f43f5e" });
      }
      if (totalCheckins > 0) {
        s.push({ icon: <Flame size={16} />, label: "Studio Check-Ins", value: `${totalCheckins}`, color: "#a855f7" });
      }
      if (avgEnergy) {
        s.push({ icon: <Zap size={16} />, label: "Avg Energy", value: `${avgEnergy}/5`, color: "#14b8a6" });
      }
      s.push({ icon: <Brain size={16} />, label: "Your Data Center", value: "Tap to explore →", color: "#f97316" });

      setSlides(s);
    };
    load();
  }, [user]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const current = slides[activeSlide];

  return (
    <button
      onClick={() => navigate("/profile#data")}
      className="w-full rounded-2xl p-4 text-left transition-all active:scale-[0.97] relative overflow-hidden group"
      style={{
        background: `linear-gradient(135deg, ${current.color}18, ${current.color}08, rgba(10,10,10,0.95))`,
        border: `1.5px solid ${current.color}50`,
        boxShadow: `0 0 24px ${current.color}25, inset 0 0 24px ${current.color}10`,
      }}
    >
      {/* Animated pulse ring */}
      <div
        className="absolute -right-4 -top-4 w-28 h-28 rounded-full opacity-25"
        style={{
          background: `radial-gradient(circle, ${current.color}50, transparent 70%)`,
          animation: "pulse 2s ease-in-out infinite",
        }}
      />
      {/* Bottom glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${current.color}, transparent)` }}
      />

      <div className="relative flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500"
          style={{ background: `${current.color}25`, color: current.color, boxShadow: `0 0 12px ${current.color}30` }}
        >
          {current.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest transition-colors duration-500" style={{ color: current.color }}>
            {current.label}
          </p>
          <p className="text-xl font-black leading-tight transition-all duration-500" style={{ color: "#fafafa" }}>
            {current.value}
          </p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {slides.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{
                background: i === activeSlide ? current.color : "rgba(255,255,255,0.12)",
                boxShadow: i === activeSlide ? `0 0 8px ${current.color}` : "none",
                transform: i === activeSlide ? "scale(1.3)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Bar graph decoration */}
      <div className="absolute bottom-2 right-14 flex items-end gap-[2px] opacity-15">
        {[3, 5, 4, 7, 6, 8, 5, 9, 7, 6].map((h, i) => (
          <div
            key={i}
            className="w-1 rounded-sm"
            style={{ height: h * 2.5, background: current.color }}
          />
        ))}
      </div>
    </button>
  );
};

export default DataHubButton;
