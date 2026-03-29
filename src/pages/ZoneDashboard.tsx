import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePoints, getLevelInfo, getNextLevel } from "@/hooks/usePoints";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  User, UserPlus, Timer, Mic, ArrowLeft, Dumbbell, Trophy,
  Sparkles, Wrench, BookOpen, Utensils, BarChart3, Target,
  Loader2, MessageCircle, Zap, ChevronRight,
} from "lucide-react";
import ZoneThemeWrapper from "@/components/zone/ZoneThemeWrapper";
import AthleteStats from "@/components/dashboard/AthleteStats";
import TodayCard from "@/components/dashboard/TodayCard";
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

function getGreeting(name: string, streak: number, sessionsThisWeek: number): string {
  const first = name.split(" ")[0];
  const hour = new Date().getHours();
  if (streak >= 14) return `${streak}-day streak, ${first}. You're built different.`;
  if (streak >= 7) return `${streak} days straight, ${first}. Keep that locked in.`;
  if (streak >= 3) return `${streak}-day streak, ${first}. Don't break the chain.`;
  if (sessionsThisWeek >= 4) return `Strong week, ${first}. Finish it out.`;
  if (hour < 12) return `Morning, ${first}. Let's get to work.`;
  if (hour < 17) return `Afternoon, ${first}. Time to grind.`;
  return `Evening session, ${first}. Finish strong.`;
}

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
  const [activeTip, setActiveTip] = useState<FeatureTip | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
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
          setWorkoutName((ap.training_programs as { title: string }).title);
          setPhase(`Block ${(ap as { block_number?: number }).block_number || 1}`);
          setCurrentDay((ap as { current_day?: number }).current_day || 1);
        }

        const { data: logs } = await supabase
          .from("progress_logs")
          .select("logged_at")
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false })
          .limit(60);
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

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { count } = await supabase
          .from("progress_logs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("logged_at", weekAgo.toISOString());
        setSessionsThisWeek(count || 0);
      } catch (e) {
        console.error("[ZoneDashboard]", e);
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

  const withTip = useCallback((tip: FeatureTip, action: () => void) => {
    if (hasSeen(tip.storageKey)) { action(); }
    else { setActiveTip(tip); setPendingAction(() => action); }
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

  const greeting = getGreeting(displayName, streak, sessionsThisWeek);

  // Quick Actions — 4 unique actions not available elsewhere
  const QUICK_ACTIONS = [
    {
      label: "Log",
      icon: <Mic size={17} />,
      color: "#e8621a",
      desc: "Voice or text",
      action: () => withTip(QUICK_ACTIVITY_TIP, () => setShowQuickLog(true)),
    },
    {
      label: "Prove It",
      icon: <Trophy size={17} />,
      color: "#eab308",
      desc: "Submit a PR",
      action: () => withTip(PROVE_IT_TIP, () => window.dispatchEvent(new Event("open-prove-it-zone"))),
    },
    {
      label: "Coach",
      icon: <MessageCircle size={17} />,
      color: "#f97316",
      desc: "Ask anything",
      action: () => setChatOpen(true),
    },
    {
      label: "Timer",
      icon: <Timer size={17} />,
      color: "#00f0ff",
      desc: "Rest timer",
      action: () => navigate("/timer"),
    },
  ];

  // Feature Hub — 2-col grid with descriptions
  const HUB_ITEMS = [
    {
      label: "Programs",
      desc: "Your training plan",
      icon: <Target size={20} />,
      color: "#f97316",
      action: () => setGeneratorView("programs"),
    },
    {
      label: "Generator",
      desc: "Build custom workouts",
      icon: <Sparkles size={20} />,
      color: "#a855f7",
      action: () => withTip(WORKOUT_GENERATOR_TIP, () => setGeneratorView("workout")),
    },
    {
      label: "Fix It",
      desc: "Pain relief & rehab",
      icon: <Wrench size={20} />,
      color: "#00f0ff",
      action: () => withTip(FIXIT_ENGINE_TIP, () => setGeneratorView("fixit")),
    },
    {
      label: "Nutrition",
      desc: "Macros & meal plans",
      icon: <Utensils size={20} />,
      color: "#22c55e",
      action: () => navigate("/nutrition-plan"),
    },
    {
      label: "Library",
      desc: "Browse all workouts",
      icon: <BookOpen size={20} />,
      color: "#ec4899",
      action: () => navigate("/dashboard"),
    },
    {
      label: "Challenges",
      desc: "Compete for points",
      icon: <Zap size={20} />,
      color: "#eab308",
      action: () => setGeneratorView("challenge"),
    },
    {
      label: "Progress",
      desc: "Track your gains",
      icon: <BarChart3 size={20} />,
      color: "#3b82f6",
      action: () => navigate("/progress"),
    },
    {
      label: "Workouts",
      desc: "Saved & recent",
      icon: <Dumbbell size={20} />,
      color: "#64748b",
      action: () => navigate("/dashboard"),
    },
  ];

  return (
    <ZoneThemeWrapper className="min-h-screen pb-24" style={{ background: "#0a0a0a", color: "#e5e5e5" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-4 py-2.5"
        style={{
          background: "rgba(10,10,10,0.94)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
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
            <p className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "#f97316" }}>THE ZONE</p>
            <p className="text-sm font-semibold leading-tight" style={{ color: "#fafafa" }}>{displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const url = `${window.location.origin}?ref=${user?.id || ""}`;
              if (navigator.share) navigator.share({ title: "Train with me on M²", url });
              else { navigator.clipboard.writeText(url); toast({ title: "Link copied!" }); }
            }}
            aria-label="Share"
            className="h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(249,115,22,0.12)" }}
          >
            <UserPlus size={14} style={{ color: "#f97316" }} />
          </button>
          <button onClick={() => navigate("/profile")} aria-label="Profile" className="transition-all active:scale-90">
            <User size={18} style={{ color: "#404040" }} />
          </button>
        </div>
      </header>

      <main className="max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-4 pt-3 pb-4 space-y-4">

        {/* Greeting */}
        <div className="px-1 pt-1">
          <p className="text-sm font-semibold" style={{ color: "#a3a3a3" }}>{greeting}</p>
        </div>

        {/* Stats */}
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

        {/* Coach banner — Pro/Elite only */}
        {isProOrElite && <CoachActivityBanner />}

        {/* Today's Workout */}
        <TodayCard
          workoutName={workoutName}
          phase={phase}
          day={currentDay}
          hasWorkout={hasActiveWorkout}
          onClick={() => window.dispatchEvent(new Event("open-workout-zone"))}
        />

        {/* Quick Actions */}
        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2.5 px-1" style={{ color: "#404040" }}>
            Quick Actions
          </p>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_ACTIONS.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="flex flex-col items-center gap-1.5 rounded-2xl py-3.5 px-2 transition-all active:scale-[0.93]"
                style={{
                  background: `${item.color}10`,
                  border: `1px solid ${item.color}28`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${item.color}1e`, color: item.color }}
                >
                  {item.icon}
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-bold leading-tight" style={{ color: "#d4d4d4" }}>
                    {item.label}
                  </div>
                  <div className="text-[9px] leading-tight mt-0.5" style={{ color: "#525252" }}>
                    {item.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Feature Hub */}
        <section>
          <div className="flex items-center justify-between mb-2.5 px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "#404040" }}>
              Your Hub
            </p>
            <span className="text-[9px]" style={{ color: "#303030" }}>Tap anything to explore</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {HUB_ITEMS.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="flex items-center gap-3 rounded-2xl p-3.5 text-left transition-all active:scale-[0.97] group"
                style={{
                  background: `${item.color}09`,
                  border: `1px solid ${item.color}1e`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${item.color}18`, color: item.color }}
                >
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold truncate" style={{ color: "#e5e5e5" }}>
                    {item.label}
                  </div>
                  <div className="text-[10px] leading-tight mt-0.5 truncate" style={{ color: "#525252" }}>
                    {item.desc}
                  </div>
                </div>
                <ChevronRight size={12} className="ml-auto flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: item.color }} />
              </button>
            ))}
          </div>
        </section>

      </main>

      {/* Overlays */}
      {generatorView && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "#0a0a0a" }}>
          <div
            className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3"
            style={{ background: "rgba(10,10,10,0.95)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <button
              onClick={() => setGeneratorView(null)}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest transition-colors"
              style={{ color: "#525252" }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          </div>
          <div className="pb-24">
            <Suspense fallback={<OverlayLoader />}>
              {generatorView === "workout" && <AiWorkoutSuggest onDone={() => setGeneratorView(null)} initialPath="workout" />}
              {generatorView === "fixit" && <AiWorkoutSuggest onDone={() => setGeneratorView(null)} initialPath="fixit" />}
              {generatorView === "programs" && <MyPrograms />}
              {generatorView === "challenge" && <ChallengeHub />}
            </Suspense>
          </div>
        </div>
      )}

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
            <FeatureLearningModal tip={activeTip} onContinue={handleTipContinue} onDismiss={handleTipDismiss} />
          </Suspense>
        )}
      </AnimatePresence>
    </ZoneThemeWrapper>
  );
};

export default ZoneDashboard;
