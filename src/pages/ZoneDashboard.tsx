import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePoints, getLevelInfo, getNextLevel } from "@/hooks/usePoints";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  User, Timer, Mic, ArrowLeft,
  Trophy, Sparkles, Wrench, Utensils, BarChart3, Target,
  Loader2, MessageCircle, Zap, Camera, Brain,
} from "lucide-react";
import ZoneThemeWrapper from "@/components/zone/ZoneThemeWrapper";
import AthleteStats from "@/components/dashboard/AthleteStats";
import AthleteProfileCard from "@/components/dashboard/AthleteProfileCard";
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

const NotificationBell = lazy(() => import("@/components/layout/NotificationBell"));
const CoachChatPanel = lazy(() => import("@/components/dashboard/CoachChatPanel"));
const QuickActivityLog = lazy(() => import("@/components/dashboard/QuickActivityLog"));
const FeatureLearningModal = lazy(() => import("@/components/dashboard/FeatureLearningModal"));
const AiWorkoutSuggest = lazy(() => import("@/components/workout/AiWorkoutSuggest"));
const MyPrograms = lazy(() => import("@/components/features/MyPrograms"));
const ChallengeHub = lazy(() => import("@/components/dashboard/ChallengeHub"));
const SelfPostureAnalysis = lazy(() => import("@/components/dashboard/SelfPostureAnalysis"));
const TechHubModal = lazy(() => import("@/components/dashboard/TechHubModal"));
const DashboardPromoBox = lazy(() => import("@/components/dashboard/DashboardPromoBox"));

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
  const [recentActivity, setRecentActivity] = useState<{ type: string; summary: string; date: string } | null>(null);
  const [postureOpen, setPostureOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);

  // Browser back button support for overlays
  const openOverlay = useCallback((view: GeneratorView) => {
    setGeneratorView(view);
    if (view) window.history.pushState({ overlay: view }, "", `#${view}`);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setGeneratorView(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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

        // Fetch streak from both progress_logs and activity_logs
        const [logsRes, actLogsRes] = await Promise.all([
          supabase
            .from("progress_logs")
            .select("logged_at")
            .eq("user_id", user.id)
            .order("logged_at", { ascending: false })
            .limit(60),
          supabase
            .from("activity_logs")
            .select("logged_at")
            .eq("user_id", user.id)
            .order("logged_at", { ascending: false })
            .limit(60),
        ]);

        const allDates = [
          ...(logsRes.data || []).map((l: any) => l.logged_at?.slice(0, 10)),
          ...(actLogsRes.data || []).map((l: any) => l.logged_at?.slice(0, 10)),
        ].filter(Boolean);
        const days = [...new Set(allDates)].sort().reverse();

        if (days.length > 0) {
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
        const weekIso = weekAgo.toISOString();
        const [weekLogsRes, weekActRes] = await Promise.all([
          supabase.from("progress_logs").select("logged_at").eq("user_id", user.id).gte("logged_at", weekIso),
          supabase.from("activity_logs").select("logged_at").eq("user_id", user.id).gte("logged_at", weekIso),
        ]);
        const weekDays = new Set([
          ...(weekLogsRes.data || []).map((l: any) => l.logged_at?.slice(0, 10)),
          ...(weekActRes.data || []).map((l: any) => l.logged_at?.slice(0, 10)),
        ].filter(Boolean));
        setSessionsThisWeek(weekDays.size);

        // Recent activity (most recent from activity_logs)
        const { data: recentAct } = await supabase
          .from("activity_logs")
          .select("activity_type, ai_summary, logged_at")
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recentAct) {
          setRecentActivity({
            type: recentAct.activity_type || "workout",
            summary: recentAct.ai_summary || "",
            date: recentAct.logged_at || "",
          });
        }
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

  const HUB_ITEMS = [
    {
      label: "Programs",
      desc: "Your training plan",
      icon: <Target size={20} />,
      color: "#f97316",
      action: () => openOverlay("programs"),
    },
    {
      label: "Generator",
      desc: "Build custom workouts",
      icon: <Sparkles size={20} />,
      color: "#a855f7",
      action: () => withTip(WORKOUT_GENERATOR_TIP, () => openOverlay("workout")),
    },
    {
      label: "Fix It",
      desc: "Pain relief & rehab",
      icon: <Wrench size={20} />,
      color: "#00f0ff",
      action: () => withTip(FIXIT_ENGINE_TIP, () => openOverlay("fixit")),
    },
    {
      label: "Nutrition",
      desc: "Macros & meal plans",
      icon: <Utensils size={20} />,
      color: "#22c55e",
      action: () => navigate("/nutrition-plan"),
    },
    {
      label: "Challenges",
      desc: "Compete for points",
      icon: <Zap size={20} />,
      color: "#eab308",
      action: () => openOverlay("challenge"),
    },
    {
      label: "Progress",
      desc: "Track your gains",
      icon: <BarChart3 size={20} />,
      color: "#3b82f6",
      action: () => navigate("/progress"),
    },
  ];

  const formatRecentDate = (iso: string) => {
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
            <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#f97316" }}>THE ZONE</p>
            <p className="text-sm font-semibold leading-tight" style={{ color: "#fafafa" }}>{displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <NotificationBell />
          </Suspense>
          <button onClick={() => navigate("/profile")} aria-label="Profile" className="transition-all active:scale-90">
            <User size={18} style={{ color: "#404040" }} />
          </button>
        </div>
      </header>

      <main className="max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-3 pt-3 pb-4 space-y-3">

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

        {/* Athlete Profile Card */}
        <AthleteProfileCard
          displayName={displayName}
          streak={streak}
          totalPoints={totalPoints}
          levelLabel={levelInfo.label}
          hasActiveWorkout={hasActiveWorkout}
          workoutName={workoutName}
          phase={phase}
          currentDay={currentDay}
          onStartWorkout={() => window.dispatchEvent(new Event("open-workout-zone"))}
        />

        {/* Recent Activity */}
        {recentActivity && (
          <button
            onClick={() => navigate("/profile")}
            className="w-full rounded-xl p-3 text-left transition-all active:scale-[0.98]"
            style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#22c55e" }}>Last Activity</span>
              <span className="text-[10px]" style={{ color: "#525252" }}>{formatRecentDate(recentActivity.date)}</span>
            </div>
            <p className="text-xs text-white/80 line-clamp-2">{recentActivity.summary || recentActivity.type}</p>
          </button>
        )}

        {/* Quick Actions — 2x2 grid */}
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] mb-2 px-1" style={{ color: "#404040" }}>
            Quick Actions
          </p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="flex items-center gap-3 rounded-2xl py-3 px-3 transition-all active:scale-[0.93]"
                style={{
                  background: `${item.color}14`,
                  border: `1.5px solid ${item.color}40`,
                  boxShadow: `0 0 12px ${item.color}20, inset 0 0 8px ${item.color}08`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${item.color}24`, color: item.color }}
                >
                  {item.icon}
                </div>
                <div className="text-left min-w-0">
                  <div className="text-xs font-bold leading-tight" style={{ color: "#d4d4d4" }}>
                    {item.label}
                  </div>
                  <div className="text-[10px] leading-tight mt-0.5" style={{ color: "#525252" }}>
                    {item.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Feature Hub */}
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "#404040" }}>
              Your Hub
            </p>
            <span className="text-xs" style={{ color: "#303030" }}>Tap to explore</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {HUB_ITEMS.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="flex items-center gap-2.5 rounded-2xl p-3 text-left transition-all active:scale-[0.97] group"
                style={{
                  background: `${item.color}09`,
                  border: `1px solid ${item.color}1e`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${item.color}18`, color: item.color }}
                >
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold" style={{ color: "#e5e5e5" }}>
                    {item.label}
                  </div>
                  <div className="text-[10px] leading-tight mt-0.5" style={{ color: "#525252" }}>
                    {item.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Posture Analysis & Technology buttons */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={() => setPostureOpen(true)}
              className="flex items-center gap-2.5 rounded-2xl p-3 text-left transition-all active:scale-[0.97] group"
              style={{
                background: "rgba(236,72,153,0.09)",
                border: "1px solid rgba(236,72,153,0.25)",
                boxShadow: "0 0 12px rgba(236,72,153,0.12), inset 0 0 12px rgba(236,72,153,0.04)",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(236,72,153,0.18)", color: "#ec4899" }}
              >
                <Camera size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold" style={{ color: "#e5e5e5" }}>Posture Analysis</div>
                <div className="text-[10px] leading-tight mt-0.5" style={{ color: "#525252" }}>AI body scan</div>
              </div>
            </button>
            <button
              onClick={() => setTechOpen(true)}
              className="flex items-center gap-2.5 rounded-2xl p-3 text-left transition-all active:scale-[0.97] group"
              style={{
                background: "rgba(99,102,241,0.09)",
                border: "1px solid rgba(99,102,241,0.25)",
                boxShadow: "0 0 12px rgba(99,102,241,0.12), inset 0 0 12px rgba(99,102,241,0.04)",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(99,102,241,0.18)", color: "#6366f1" }}
              >
                <Brain size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold" style={{ color: "#e5e5e5" }}>Technology</div>
                <div className="text-[10px] leading-tight mt-0.5" style={{ color: "#525252" }}>AI tools & more</div>
              </div>
            </button>
          </div>

          {/* Install App prompt */}
          {!window.matchMedia("(display-mode: standalone)").matches && (
            <button
              onClick={() => navigate("/install")}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mt-2 transition-all active:scale-[0.98]"
              style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.15)" }}
            >
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#f97316" }}>
                📲 Install the M² App
              </span>
            </button>
          )}
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
              onClick={() => { setGeneratorView(null); window.history.back(); }}
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
      <Suspense fallback={null}>
        <SelfPostureAnalysis open={postureOpen} onClose={() => setPostureOpen(false)} />
        <TechHubModal open={techOpen} onClose={() => setTechOpen(false)} />
      </Suspense>
    </ZoneThemeWrapper>
  );
};

export default ZoneDashboard;
