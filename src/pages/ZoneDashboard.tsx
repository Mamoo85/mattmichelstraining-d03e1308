import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";
import { toast } from "@/hooks/use-toast";
import { useAuth, TIERS } from "@/hooks/useAuth";
import { usePoints, getLevelInfo, getNextLevel } from "@/hooks/usePoints";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { User, UserPlus, Timer, Mic, ArrowLeft, Dumbbell, Trophy, Sparkles, Wrench, BookOpen, Utensils, BarChart3, Target, Loader2 } from "lucide-react";
import ZoneThemeWrapper from "@/components/zone/ZoneThemeWrapper";
import ZoneCommandCenter from "@/components/dashboard/ZoneCommandCenter";
import AthleteStats from "@/components/dashboard/AthleteStats";
import TodayCard from "@/components/dashboard/TodayCard";
import SmartStartButton from "@/components/dashboard/SmartStartButton";
import CoachActivityBanner from "@/components/dashboard/CoachActivityBanner";
import logoImg from "@/assets/m2-logo-zone.png";
import { safeLocalStorage } from "@/lib/browserStorage";
import type { FeatureTip } from "@/components/dashboard/FeatureLearningModal";
import {
  WORKOUT_GENERATOR_TIP,
  FIXIT_ENGINE_TIP,
  PROVE_IT_TIP,
  QUICK_ACTIVITY_TIP,
} from "@/components/dashboard/featureTips";

import { AnimatePresence } from "framer-motion";

const CoachChatPanel = lazy(() => import("@/components/dashboard/CoachChatPanel"));
const QuickActivityLog = lazy(() => import("@/components/dashboard/QuickActivityLog"));
const FeatureLearningModal = lazy(() => import("@/components/dashboard/FeatureLearningModal"));
const AiWorkoutSuggest = lazy(() => import("@/components/workout/AiWorkoutSuggest"));
const MyPrograms = lazy(() => import("@/components/features/MyPrograms"));
const ChallengeHub = lazy(() => import("@/components/dashboard/ChallengeHub"));

type GeneratorView = "workout" | "fixit" | "programs" | "challenge" | null;

const hasSeen = (key: string) => safeLocalStorage.getItem(key) === "1";
const markSeen = (key: string) => safeLocalStorage.setItem(key, "1");

const OverlayLoader = () => (
  <div className="flex justify-center py-20">
    <Loader2 size={24} className="animate-spin" style={{ color: "#f97316" }} />
  </div>
);

const ZoneDashboard = () => {
  const { user, subscriptionTier } = useAuth();
  const isProOrElite = subscriptionTier === "pro" || subscriptionTier === "elite";
  const { points } = usePoints();
  const navigate = useNavigate();
  useBrowserNotifications();

  const [displayName, setDisplayName] = useState("Athlete");
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);
  const [workoutName, setWorkoutName] = useState("Upper Body Power");
  const [phase, setPhase] = useState("Phase 1");
  const [currentDay, setCurrentDay] = useState(1);
  const [streak, setStreak] = useState(0);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [generatorView, setGeneratorView] = useState<GeneratorView>(null);

  // Feature tip state
  const [activeTip, setActiveTip] = useState<FeatureTip | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data: prof, error: profError } = await supabase
          .from("profiles")
          .select("athlete_name, full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (profError) console.warn("[ZoneDashboard] Failed to load profile:", profError.message);
        if (prof?.athlete_name || prof?.full_name)
          setDisplayName(prof.athlete_name || prof.full_name || "Athlete");

        const { data: ap, error: apError } = await supabase
          .from("user_active_programs")
          .select("current_week, current_day, block_number, training_programs!inner(title)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (apError) console.warn("[ZoneDashboard] Failed to load active program:", apError.message);

        if (ap?.training_programs && typeof ap.training_programs === "object" && "title" in ap.training_programs) {
          setHasActiveWorkout(true);
          setWorkoutName((ap.training_programs as { title: string }).title);
          setPhase(`Block ${(ap as { block_number?: number }).block_number || 1}`);
          setCurrentDay((ap as { current_day?: number }).current_day || 1);
        }

        // Streak calculation
        const { data: logs, error: logsError } = await supabase
          .from("progress_logs")
          .select("logged_at")
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false })
          .limit(60);
        if (logsError) console.warn("[ZoneDashboard] Failed to load logs:", logsError.message);
        if (logs && logs.length > 0) {
          const days = [...new Set(logs.map((l: { logged_at: string }) => l.logged_at.slice(0, 10)))].sort().reverse();
          let s = 1;
          for (let i = 1; i < days.length; i++) {
            const prev = new Date(days[i - 1]);
            prev.setDate(prev.getDate() - 1);
            if (prev.toISOString().slice(0, 10) === days[i]) s++;
            else break;
          }
          setStreak(s);
        }

        // Sessions this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { count, error: countError } = await supabase
          .from("progress_logs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("logged_at", weekAgo.toISOString());
        if (countError) console.warn("[ZoneDashboard] Failed to load session count:", countError.message);
        setSessionsThisWeek(count || 0);
      } catch (e) {
        console.error("[ZoneDashboard] Unexpected error loading dashboard data:", e);
      }
    };
    load();
  }, [user]);

  const totalPoints = points?.total_points ?? 0;
  const levelInfo = getLevelInfo(totalPoints);
  const nextLevel = getNextLevel(totalPoints);
  const progressPct = nextLevel
    ? Math.min(100, ((totalPoints - levelInfo.min) / (nextLevel.min - levelInfo.min)) * 100)
    : 100;

  /** Show feature tip first time, then run action */
  const withTip = useCallback((tip: FeatureTip, action: () => void) => {
    if (hasSeen(tip.storageKey)) {
      action();
    } else {
      setActiveTip(tip);
      setPendingAction(() => action);
    }
  }, []);

  const handleTipContinue = useCallback(() => {
    if (activeTip) markSeen(activeTip.storageKey);
    setActiveTip(null);
    pendingAction?.();
    setPendingAction(null);
  }, [activeTip, pendingAction]);

  const handleTipDismiss = useCallback(() => {
    if (activeTip) markSeen(activeTip.storageKey);
    setActiveTip(null);
    setPendingAction(null);
  }, [activeTip]);

  // Hub items — all major app features
  const HUB_ITEMS = [
    {
      label: "Programs",
      icon: <Target size={18} style={{ color: "#f97316" }} />,
      color: "#f97316",
      action: () => setGeneratorView("programs"),
    },
    {
      label: "Workouts",
      icon: <Dumbbell size={18} style={{ color: "#00f0ff" }} />,
      color: "#00f0ff",
      action: () => navigate("/dashboard"),
    },
    {
      label: "Fix It",
      icon: <Wrench size={18} style={{ color: "#00f0ff" }} />,
      color: "#00f0ff",
      action: () => withTip(FIXIT_ENGINE_TIP, () => setGeneratorView("fixit")),
    },
    {
      label: "Generator",
      icon: <Sparkles size={18} style={{ color: "#a855f7" }} />,
      color: "#a855f7",
      action: () => withTip(WORKOUT_GENERATOR_TIP, () => setGeneratorView("workout")),
    },
    {
      label: "Nutrition",
      icon: <Utensils size={18} style={{ color: "#22c55e" }} />,
      color: "#22c55e",
      action: () => navigate("/nutrition-plan"),
    },
    {
      label: "Challenge",
      icon: <Trophy size={18} style={{ color: "#eab308" }} />,
      color: "#eab308",
      action: () => setGeneratorView("challenge"),
    },
    {
      label: "Progress",
      icon: <BarChart3 size={18} style={{ color: "#3b82f6" }} />,
      color: "#3b82f6",
      action: () => navigate("/progress"),
    },
    {
      label: "Prove It",
      icon: <Trophy size={18} style={{ color: "#f97316" }} />,
      color: "#f97316",
      action: () => withTip(PROVE_IT_TIP, () => window.dispatchEvent(new Event("open-prove-it-zone"))),
    },
    {
      label: "Library",
      icon: <BookOpen size={18} style={{ color: "#ec4899" }} />,
      color: "#ec4899",
      action: () => navigate("/dashboard"),
    },
  ];

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
            aria-label="Share referral link"
            className="h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(249,115,22,0.15)" }}
          >
            <UserPlus size={14} style={{ color: "#f97316" }} />
          </button>
          <button onClick={() => navigate("/profile")} aria-label="Profile" className="transition-all active:scale-90">
            <User size={18} style={{ color: "#525252" }} />
          </button>
          <button
            onClick={() => navigate("/timer")}
            aria-label="Timer"
            className="h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(0,240,255,0.12)", boxShadow: "0 0 8px rgba(0,240,255,0.25)" }}
          >
            <Timer size={15} style={{ color: "#00f0ff" }} />
          </button>
        </div>
      </header>

      <main className="max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-4 pt-4 pb-4 space-y-5">
        {/* 1. Athlete Stats — all boxes clickable */}
        <AthleteStats
          streak={streak}
          sessionsThisWeek={sessionsThisWeek}
          totalPoints={totalPoints}
          levelLabel={levelInfo.label}
          nextLevelLabel={nextLevel?.label ?? null}
          ptsToNext={nextLevel ? nextLevel.min - totalPoints : null}
          progressPct={progressPct}
          onStreakClick={() => navigate("/progress")}
          onSessionsClick={() => navigate("/progress")}
          onPointsClick={() => setGeneratorView("challenge")}
        />

        {/* 2. Coach activity — Pro/Elite only */}
        {isProOrElite && <CoachActivityBanner />}

        {/* 3. Today's Workout Card — clickable to open Workout Zone */}
        <TodayCard
          workoutName={workoutName}
          phase={phase}
          day={currentDay}
          hasWorkout={hasActiveWorkout}
          onClick={() => window.dispatchEvent(new Event("open-workout-zone"))}
        />

        {/* 4. Command Center */}
        <ZoneCommandCenter
          onChat={() => setChatOpen(true)}
          onProveIt={() => withTip(PROVE_IT_TIP, () => window.dispatchEvent(new Event("open-prove-it-zone")))}
          onGenerate={() => withTip(WORKOUT_GENERATOR_TIP, () => setGeneratorView("workout"))}
          onFixIt={() => withTip(FIXIT_ENGINE_TIP, () => setGeneratorView("fixit"))}
        />

        {/* 5. Feature Hub — all app features in one place */}
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] mb-3 px-1" style={{ color: "#737373" }}>
            Your Hub
          </p>
          <div className="grid grid-cols-3 gap-2">
            {HUB_ITEMS.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="flex flex-col items-center gap-2 rounded-2xl p-3.5 transition-all active:scale-[0.94]"
                style={{
                  background: `${item.color}0d`,
                  border: `1px solid ${item.color}22`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${item.color}1a` }}
                >
                  {item.icon}
                </div>
                <span className="text-[11px] font-bold" style={{ color: "#d4d4d4" }}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 6. Smart Start Button */}
        <SmartStartButton hasWorkout={hasActiveWorkout} />
      </main>

      {/* ── Quick Log FAB ── */}
      <button
        onClick={() => withTip(QUICK_ACTIVITY_TIP, () => setShowQuickLog(true))}
        className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-90"
        style={{
          background: "#e8621a",
          boxShadow: "0 4px_20px rgba(232,98,26,0.5)",
        }}
        aria-label="Log workout"
      >
        <Mic size={22} className="text-white" />
      </button>

      {/* ── Full-screen generator / feature overlay ── */}
      {generatorView && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "#0a0a0a" }}>
          <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3" style={{ background: "rgba(10,10,10,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => setGeneratorView(null)}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest transition-colors"
              style={{ color: "#737373" }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          </div>
          <div className="pb-24">
            <Suspense fallback={<OverlayLoader />}>
              {generatorView === "workout" && (
                <AiWorkoutSuggest onDone={() => setGeneratorView(null)} initialPath="workout" />
              )}
              {generatorView === "fixit" && (
                <AiWorkoutSuggest onDone={() => setGeneratorView(null)} initialPath="fixit" />
              )}
              {generatorView === "programs" && <MyPrograms />}
              {generatorView === "challenge" && <ChallengeHub />}
            </Suspense>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
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
      <AnimatePresence>
        {activeTip && (
          <Suspense fallback={null}>
            <FeatureLearningModal
              tip={activeTip}
              onContinue={handleTipContinue}
              onDismiss={handleTipDismiss}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </ZoneThemeWrapper>
  );
};

export default ZoneDashboard;
