import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Flame, Dumbbell, Activity, TrendingUp, Zap } from "lucide-react";

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
      const [actRes, progRes, checkinRes] = await Promise.all([
        supabase.from("activity_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("progress_logs").select("id, weight, exercise_name", { count: "exact" }).eq("user_id", user.id).order("weight", { ascending: false }).limit(1),
        supabase.from("studio_checkins" as any).select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      const totalActivities = actRes.count ?? 0;
      const totalCheckins = checkinRes.count ?? 0;
      const topLift = progRes.data?.[0];
      const totalLifts = progRes.count ?? 0;

      const s: StatSlide[] = [
        { icon: <Activity size={16} />, label: "Total Activities", value: `${totalActivities}`, color: "#22c55e" },
        { icon: <Dumbbell size={16} />, label: "Lifts Logged", value: `${totalLifts}`, color: "#3b82f6" },
      ];
      if (topLift) {
        s.push({ icon: <TrendingUp size={16} />, label: `Top: ${topLift.exercise_name}`, value: `${topLift.weight} lbs`, color: "#f97316" });
      }
      if (totalCheckins > 0) {
        s.push({ icon: <Flame size={16} />, label: "Check-Ins", value: `${totalCheckins}`, color: "#eab308" });
      }
      s.push({ icon: <Zap size={16} />, label: "Your Data Center", value: "Tap to explore →", color: "#a855f7" });
      setSlides(s);
    };
    load();
  }, [user]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const current = slides[activeSlide];

  return (
    <button
      onClick={() => navigate("/profile#data")}
      className="w-full rounded-2xl p-4 text-left transition-all active:scale-[0.97] relative overflow-hidden group"
      style={{
        background: `linear-gradient(135deg, ${current.color}12, ${current.color}06, rgba(10,10,10,0.95))`,
        border: `1.5px solid ${current.color}40`,
        boxShadow: `0 0 20px ${current.color}20, inset 0 0 20px ${current.color}08`,
      }}
    >
      {/* Animated pulse ring */}
      <div
        className="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-20"
        style={{
          background: `radial-gradient(circle, ${current.color}40, transparent 70%)`,
          animation: "pulse 2s ease-in-out infinite",
        }}
      />

      <div className="relative flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500"
          style={{ background: `${current.color}20`, color: current.color }}
        >
          {current.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest transition-colors duration-500" style={{ color: current.color }}>
            {current.label}
          </p>
          <p className="text-lg font-black leading-tight transition-all duration-500" style={{ color: "#fafafa" }}>
            {current.value}
          </p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {slides.map((_, i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full transition-all duration-300"
              style={{
                background: i === activeSlide ? current.color : "rgba(255,255,255,0.15)",
                boxShadow: i === activeSlide ? `0 0 6px ${current.color}` : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Bar graph decoration */}
      <div className="absolute bottom-1 right-12 flex items-end gap-[2px] opacity-10">
        {[3, 5, 4, 7, 6, 8, 5, 9].map((h, i) => (
          <div
            key={i}
            className="w-1 rounded-sm"
            style={{ height: h * 2, background: current.color }}
          />
        ))}
      </div>
    </button>
  );
};

export default DataHubButton;
