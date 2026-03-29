import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePoints, getLevelInfo } from "@/hooks/usePoints";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { User, UserPlus, Timer } from "lucide-react";
import ZoneThemeWrapper from "@/components/zone/ZoneThemeWrapper";
import ZoneCommandCenter from "@/components/dashboard/ZoneCommandCenter";
import AthleteStats from "@/components/dashboard/AthleteStats";
import TodayCard from "@/components/dashboard/TodayCard";
import SmartStartButton from "@/components/dashboard/SmartStartButton";
import logoImg from "@/assets/m2-logo-zone.png";

const CoachChatPanel = lazy(() => import("@/components/dashboard/CoachChatPanel"));
const QuickActivityLog = lazy(() => import("@/components/dashboard/QuickActivityLog"));

import { AnimatePresence } from "framer-motion";

const ZoneDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  useBrowserNotifications();

  const [displayName, setDisplayName] = useState("Athlete");
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);
  const [workoutName, setWorkoutName] = useState("Upper Body Power");
  const [phase, setPhase] = useState("Phase 1");
  const [currentDay, setCurrentDay] = useState(1);
  const [chatOpen, setChatOpen] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("athlete_name, full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.athlete_name || prof?.full_name)
        setDisplayName(prof.athlete_name || prof.full_name || "Athlete");

      const { data: ap } = await supabase
        .from("user_active_programs")
        .select("current_week, current_day, block_number, training_programs!inner(title)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (ap?.training_programs && typeof ap.training_programs === "object" && "title" in ap.training_programs) {
        setHasActiveWorkout(true);
        setWorkoutName((ap.training_programs as any).title as string);
        setPhase(`Block ${(ap as any).block_number || 1}`);
        setCurrentDay((ap as any).current_day || 1);
      }
    };
    load();
  }, [user]);

  return (
    <ZoneThemeWrapper className="min-h-screen pb-24" style={{ background: "#0a0a0a", color: "#e5e5e5" }}>
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-4 py-2.5"
        style={{
          background: "rgba(10,10,10,0.92)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="h-9 w-9 rounded-lg overflow-hidden flex items-center justify-center transition-all active:scale-90"
            style={{ background: "#000", boxShadow: "0 0 14px rgba(249,115,22,0.6)" }}
          >
            <img src={logoImg} alt="M²" className="h-8 w-8 object-contain" />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#f97316" }}>THE ZONE</p>
            <p className="text-sm font-semibold" style={{ color: "#fafafa" }}>{displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const url = `${window.location.origin}?ref=${user?.id || ""}`;
              if (navigator.share) navigator.share({ title: "Train with me on M²", url });
              else { navigator.clipboard.writeText(url); toast({ title: "Link copied!" }); }
            }}
            className="h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(249,115,22,0.15)" }}
          >
            <UserPlus size={14} style={{ color: "#f97316" }} />
          </button>
          <button onClick={() => navigate("/profile")} className="transition-all active:scale-90">
            <User size={18} style={{ color: "#525252" }} />
          </button>
          <button
            onClick={() => navigate("/timer")}
            className="h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(0,240,255,0.12)", boxShadow: "0 0 8px rgba(0,240,255,0.25)" }}
          >
            <Timer size={15} style={{ color: "#00f0ff" }} />
          </button>
        </div>
      </header>

      <main className="max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-4 pt-4 pb-4 space-y-5">
        {/* 1. Athlete Stats */}
        <AthleteStats />

        {/* 2. Today's Workout Card */}
        <TodayCard workoutName={workoutName} phase={phase} day={currentDay} />

        {/* 3. Command Center */}
        <ZoneCommandCenter
          onChat={() => setChatOpen(true)}
          onProveIt={() => window.dispatchEvent(new Event("open-prove-it-zone"))}
        />

        {/* 4. Smart Start Button */}
        <SmartStartButton hasWorkout={hasActiveWorkout} />
      </main>

      {/* Modals */}
      <AnimatePresence>
        {chatOpen && (
          <Suspense fallback={null}>
            <CoachChatPanel onClose={() => setChatOpen(false)} />
          </Suspense>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showQuickLog && (
          <Suspense fallback={null}>
            <QuickActivityLog onClose={() => setShowQuickLog(false)} />
          </Suspense>
        )}
      </AnimatePresence>
    </ZoneThemeWrapper>
  );
};

export default ZoneDashboard;
