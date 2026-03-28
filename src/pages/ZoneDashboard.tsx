import { useState, useEffect, lazy, Suspense, memo, useCallback } from "react";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePoints, getLevelInfo, getNextLevel } from "@/hooks/usePoints";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/browserStorage";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, Sparkles, Dumbbell, Home, Flame, Zap, Trophy, Play, Wrench,
  Timer, ChevronRight, ChevronDown, MessageCircle, Brain,
  User, Activity, Clock, Target, Star, Award, Camera, Crosshair, Heart, UserPlus,
  Mic, MapPin, Check, FileText, Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ZoneThemeWrapper from "@/components/zone/ZoneThemeWrapper";
import FeatureLearningModal from "@/components/dashboard/FeatureLearningModal";
import { ZONE_LIFTS_TIP, ZONE_GENERATE_TIP, ZONE_TRAIN_TIP, ZONE_HOME_TIP } from "@/components/dashboard/featureTips";
import logoImg from "@/assets/m2-logo-zone.png";

const ProgressCharts = lazy(() => import("@/components/features/ProgressCharts"));
const WorkoutsTab = lazy(() => import("@/components/dashboard/WorkoutsTab"));
const MyPrograms = lazy(() => import("@/components/features/MyPrograms"));
const TodaysTrainingCard = lazy(() => import("@/components/programs/TodaysTrainingCard"));
const MonthlyFocusWidget = lazy(() => import("@/components/features/MonthlyFocusWidget"));
const DashboardChallengePreview = lazy(() => import("@/components/dashboard/DashboardChallengePreview"));
const CommunityActivityFeed = lazy(() => import("@/components/dashboard/CommunityActivityFeed"));
const DashboardReferralCard = lazy(() => import("@/components/dashboard/DashboardReferralCard"));
const SharedWorkoutFeed = lazy(() => import("@/components/workout/SharedWorkoutFeed"));
const UpcomingSessions = lazy(() => import("@/components/sessions/UpcomingSessions"));
const CoachChatPanel = lazy(() => import("@/components/dashboard/CoachChatPanel"));
const CustomProgramRequest = lazy(() => import("@/components/dashboard/CustomProgramRequest"));
const AiWorkoutSuggest = lazy(() => import("@/components/workout/AiWorkoutSuggest"));
const FixItLibrary = lazy(() => import("@/components/features/FixItLibrary"));
const QuickActivityLog = lazy(() => import("@/components/dashboard/QuickActivityLog"));

type TabKey = "home" | "generate" | "train" | "lifts";

const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "lifts", label: "Lifts", icon: BarChart3 },
  { key: "generate", label: "Generate", icon: Sparkles },
  { key: "train", label: "Train", icon: Dumbbell },
];

const TAB_STORAGE_KEY = "zone-dash-tab";

const TabLoader = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-6 h-6 rounded-full animate-spin" style={{ border: "2px solid #f97316", borderTopColor: "transparent" }} />
  </div>
);

/* ── AI Tools config ────────────────────────── */
const AI_TOOLS = [
  { key: "generator", label: "Generator", icon: Brain, color: "#a855f7", action: "generate" as const },
  { key: "fixit", label: "Fix It", icon: Wrench, color: "#00f0ff", action: "fixit" as const },
  { key: "velocity", label: "Velocity", icon: Zap, color: "#f97316", action: "tool" as const },
  { key: "scanner", label: "Scanner", icon: Camera, color: "#a855f7", action: "tool" as const },
  { key: "recovery", label: "Recovery", icon: Heart, color: "#22c55e", action: "tool" as const },
  { key: "timer", label: "Timer", icon: Timer, color: "#00f0ff", action: "tool" as const },
  { key: "barpath", label: "Bar Path", icon: Crosshair, color: "#f97316", action: "tool" as const },
];

/* ── Generate Tab ───────────────────────────── */
const GenerateTabContent = memo(({ view, setView }: { view: "menu" | "workout" | "fixit"; setView: (v: "menu" | "workout" | "fixit") => void }) => {
  if (view === "workout") {
    return (
      <Suspense fallback={<TabLoader />}>
        <div className="space-y-4">
          <button onClick={() => setView("menu")} className="text-xs font-medium" style={{ color: "#737373" }}>
            ← Back
          </button>
          <AiWorkoutSuggest onDone={() => setView("menu")} />
        </div>
      </Suspense>
    );
  }
  if (view === "fixit") {
    return (
      <Suspense fallback={<TabLoader />}>
        <div className="space-y-4">
          <button onClick={() => setView("menu")} className="text-xs font-medium" style={{ color: "#737373" }}>
            ← Back
          </button>
          <AiWorkoutSuggest onDone={() => setView("menu")} initialPath="fixit" />
        </div>
      </Suspense>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setView("workout")}
        className="w-full rounded-2xl p-5 text-left transition-all active:scale-[0.97]"
        style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(249,115,22,0.08))", border: "1px solid rgba(168,85,247,0.2)" }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)" }}>
            <Brain size={24} color="#fff" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-black" style={{ color: "#fafafa" }}>Perfect Workout Generator</p>
            <p className="text-sm mt-1" style={{ color: "#a3a3a3" }}>AI builds your session with auto-configured timer</p>
          </div>
          <ChevronRight size={18} style={{ color: "#a855f7" }} />
        </div>
      </button>

      <button
        onClick={() => setView("fixit")}
        className="w-full rounded-2xl p-5 text-left transition-all active:scale-[0.97]"
        style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.1), rgba(6,182,212,0.06))", border: "1px solid rgba(0,240,255,0.2)" }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #00f0ff, #0891b2)" }}>
            <Wrench size={24} color="#fff" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-black" style={{ color: "#fafafa" }}>Fix It Engine</p>
            <p className="text-sm mt-1" style={{ color: "#a3a3a3" }}>Corrective protocols tailored to your body</p>
          </div>
          <ChevronRight size={18} style={{ color: "#00f0ff" }} />
        </div>
      </button>

      <div className="rounded-xl px-5 py-4 flex items-center gap-3" style={{ background: "rgba(0,240,255,0.05)", border: "1px solid rgba(0,240,255,0.1)" }}>
        <Timer size={18} style={{ color: "#00f0ff" }} />
        <p className="text-sm" style={{ color: "#737373" }}>
          <span className="font-bold" style={{ color: "#00f0ff" }}>Auto-Timer</span> — Your interval timer auto-configures to match every generated workout.
        </p>
      </div>
    </div>
  );
});
GenerateTabContent.displayName = "GenerateTabContent";

/* ── Progressive Overload Card ──────────────── */
const OverloadCard = memo(() => {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="w-full rounded-2xl text-left overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(249,115,22,0.06), rgba(251,146,60,0.03))",
        border: "1px solid rgba(249,115,22,0.15)",
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all active:scale-[0.98]"
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
        >
          <Zap size={18} color="#fff" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black uppercase tracking-wider" style={{ color: "#fb923c" }}>
            The Power of Progressive Overload
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#525252" }}>
            The #1 principle behind every PR
          </p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={18} style={{ color: "#f97316" }} />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid rgba(249,115,22,0.1)" }}>
              <p className="text-sm leading-relaxed pt-3" style={{ color: "#a3a3a3" }}>
                Progressive overload is the gradual increase of stress placed on your body during training.
                It's the single most important principle for building strength, muscle, and athletic performance.
              </p>

              <div className="space-y-2">
                {[
                  { icon: "📈", title: "Add Weight", desc: "Even 2.5 lbs more than last session counts" },
                  { icon: "🔁", title: "Add Reps", desc: "Same weight, one more rep — that's growth" },
                  { icon: "📦", title: "Add Sets", desc: "More volume = more stimulus over time" },
                  { icon: "⏱️", title: "Slow the Tempo", desc: "More time under tension, more adaptation" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{ background: "rgba(249,115,22,0.06)" }}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "#fafafa" }}>{item.title}</p>
                      <p className="text-xs" style={{ color: "#737373" }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl px-5 py-4" style={{ background: "rgba(249,115,22,0.08)", borderLeft: "3px solid #f97316" }}>
                <p className="text-sm italic leading-relaxed" style={{ color: "#fb923c" }}>
                  "Your body only grows when you give it a reason to. Track every lift, beat your numbers, and let the data prove you're getting stronger."
                </p>
                <p className="text-xs font-bold mt-1.5" style={{ color: "#737373" }}>— Coach Matt</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
OverloadCard.displayName = "OverloadCard";

/* ── Train Tab (collapsible sections) ───────── */
const TrainSection = ({ title, subtitle, icon: Icon, color, children }: {
  title: string; subtitle: string; icon: typeof Dumbbell; color: string; children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${color}33` }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 p-5 text-left transition-all active:scale-[0.98]"
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>
          <Icon size={20} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black uppercase tracking-wider" style={{ color }}>{title}</p>
          <p className="text-xs mt-0.5" style={{ color: "#737373" }}>{subtitle}</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={18} style={{ color }} />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5" style={{ borderTop: `1px solid ${color}1a` }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TrainTabContent = memo(() => (
  <Suspense fallback={<TabLoader />}>
    <div className="space-y-4">
      <div
        className="rounded-2xl p-6"
        style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.10), rgba(168,85,247,0.06))",
          border: "1px solid rgba(249,115,22,0.18)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
            <Dumbbell size={24} color="#fff" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-black" style={{ color: "#fafafa" }}>Your Training Library</p>
            <p className="text-sm mt-1" style={{ color: "#a3a3a3" }}>Programs, workouts & today's session — all in one place</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent("open-workout-zone", { detail: null }))}
        className="w-full rounded-2xl py-4 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest transition-all active:scale-[0.97]"
        style={{
          background: "linear-gradient(135deg, rgba(0,240,255,0.12), rgba(6,182,212,0.08))",
          border: "1px solid rgba(0,240,255,0.25)",
          color: "#00f0ff",
        }}
      >
        <Play size={16} /> Open Workout
      </button>

      <TrainSection title="Today's Training" subtitle="Pick up where you left off" icon={Play} color="#f97316">
        <TodaysTrainingCard />
      </TrainSection>

      <TrainSection title="Workout Library" subtitle="Browse coach-built & community workouts" icon={Flame} color="#a855f7">
        <WorkoutsTab />
      </TrainSection>

      <TrainSection title="My Programs" subtitle="Active & available training programs" icon={Target} color="#00f0ff">
        <MyPrograms />
      </TrainSection>
    </div>
  </Suspense>
));
TrainTabContent.displayName = "TrainTabContent";

/* ── Home Tab ───────────────────────────────── */
const HomeTab = memo(() => {
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <div className="space-y-4">
      <button
        onClick={() => setChatOpen(true)}
        className="w-full flex items-center gap-4 rounded-2xl p-5 transition-all active:scale-[0.98]"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="relative">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(249,115,22,0.15)" }}>
            <MessageCircle size={20} style={{ color: "#f97316" }} />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full animate-pulse" style={{ background: "#22c55e", border: "2px solid #0a0a0a" }} />
        </div>
        <div className="text-left flex-1">
          <p className="text-base font-semibold" style={{ color: "#fafafa" }}>Message Coach Matt</p>
          <p className="text-sm mt-0.5" style={{ color: "#525252" }}>Usually replies within 2 hours</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>Online</span>
      </button>
      {chatOpen && <Suspense fallback={null}><CoachChatPanel onClose={() => setChatOpen(false)} /></Suspense>}
      <Suspense fallback={null}><MonthlyFocusWidget /></Suspense>
      <Suspense fallback={null}><DashboardChallengePreview onViewChallenge={() => {}} /></Suspense>
      <Suspense fallback={null}><CommunityActivityFeed /></Suspense>
      <Suspense fallback={null}><UpcomingSessions /></Suspense>
      <Suspense fallback={null}><CustomProgramRequest /></Suspense>
      <Suspense fallback={null}><DashboardReferralCard /></Suspense>
      <Suspense fallback={null}><SharedWorkoutFeed /></Suspense>
    </div>
  );
});
HomeTab.displayName = "HomeTab";

/* ── Secondary Action Item ──────────────────── */
const SecondaryAction = ({ icon: Icon, color, title, subtitle, onClick }: {
  icon: typeof Dumbbell; color: string; title: string; subtitle: string; onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-4 rounded-2xl p-5 transition-all active:scale-[0.97]"
    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
  >
    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
      <Icon size={20} style={{ color }} />
    </div>
    <div className="text-left flex-1 min-w-0">
      <p className="text-sm font-bold" style={{ color: "#fafafa" }}>{title}</p>
      <p className="text-xs mt-0.5" style={{ color: "#525252" }}>{subtitle}</p>
    </div>
    <ChevronRight size={16} style={{ color: "#525252" }} />
  </button>
);

/* ═══════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════ */
const ZoneDashboard = () => {
  const { user, subscriptionTier } = useAuth();
  const { points } = usePoints();
  const navigate = useNavigate();
  useBrowserNotifications();
  const tierLabel = subscriptionTier ? subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1) : "Member";

  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [showTabTip, setShowTabTip] = useState(() => {
    const initialTab = (safeLocalStorage.getItem(TAB_STORAGE_KEY) as TabKey) || "home";
    return !safeLocalStorage.getItem(`m2-tip-zone-${initialTab}-v1`);
  });
  const [generateView, setGenerateView] = useState<"menu" | "workout" | "fixit">("menu");
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showCheckInChoice, setShowCheckInChoice] = useState(false);
  const [alreadyCheckedInToday, setAlreadyCheckedInToday] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const [streak, setStreak] = useState(0);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [currentProgram, setCurrentProgram] = useState("—");
  const [displayName, setDisplayName] = useState("Athlete");
  const [topPR, setTopPR] = useState<{ name: string; weight: number } | null>(null);
  const [totalLifts, setTotalLifts] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: prof } = await supabase.from("profiles").select("athlete_name, full_name").eq("id", user.id).maybeSingle();
      if (prof?.athlete_name || prof?.full_name) setDisplayName(prof.athlete_name || prof.full_name || "Athlete");

      const { data: prData } = await supabase
        .from("progress_logs")
        .select("exercise_name, weight")
        .eq("user_id", user.id)
        .not("weight", "is", null)
        .order("weight", { ascending: false })
        .limit(1);
      if (prData && prData.length > 0 && prData[0].weight) {
        setTopPR({ name: prData[0].exercise_name, weight: prData[0].weight });
      }

      const { count: liftCount } = await supabase
        .from("progress_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      setTotalLifts(liftCount || 0);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count } = await supabase.from("progress_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("logged_at", weekAgo.toISOString());
      setSessionsThisWeek(count || 0);

      const { data: ap } = await supabase
        .from("user_active_programs")
        .select("program_id, training_programs!inner(title)")
        .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
      if (ap?.training_programs && typeof ap.training_programs === "object" && "title" in ap.training_programs) {
        const t = (ap.training_programs as any).title as string;
        setCurrentProgram(t.length > 24 ? t.slice(0, 24) + "…" : t);
      }

      const { data: logs } = await supabase.from("progress_logs").select("logged_at").eq("user_id", user.id).order("logged_at", { ascending: false }).limit(60);
      if (logs && logs.length > 0) {
        let s = 1;
        const days = [...new Set(logs.map(l => l.logged_at.slice(0, 10)))].sort().reverse();
        for (let i = 1; i < days.length; i++) {
          const prev = new Date(days[i - 1]);
          const curr = new Date(days[i]);
          prev.setDate(prev.getDate() - 1);
          if (prev.toISOString().slice(0, 10) === curr.toISOString().slice(0, 10)) s++;
          else break;
        }
        setStreak(s);
      }

      const today = new Date().toISOString().slice(0, 10);
      const { count: checkinCount } = await supabase
        .from("studio_checkins")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("checked_in_at", today + "T00:00:00")
        .lte("checked_in_at", today + "T23:59:59");
      setAlreadyCheckedInToday((checkinCount || 0) > 0);
    };
    load();
  }, [user]);

  const handleCheckIn = async (location: "matts_gym" | "on_your_own") => {
    if (!user || alreadyCheckedInToday) return;
    setCheckingIn(true);
    const { error } = await supabase
      .from("studio_checkins")
      .insert({ user_id: user.id } as any);
    if (error) {
      toast({ title: "Check-in failed", description: error.message, variant: "destructive" });
    } else {
      setAlreadyCheckedInToday(true);
      toast({ title: location === "matts_gym" ? "🏋️ Checked in at Matt's Gym!" : "💪 Checked in — On Your Own!", description: "+50 M² Points" });
    }
    setCheckingIn(false);
    setShowCheckInChoice(false);
  };

  const handleTab = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    safeLocalStorage.setItem(TAB_STORAGE_KEY, tab);
    if (tab === "generate") setGenerateView("menu");
    const tipKey = `m2-tip-zone-${tab}-v1`;
    if (!safeLocalStorage.getItem(tipKey)) setShowTabTip(true);
  }, []);

  const handleAiTool = useCallback((tool: typeof AI_TOOLS[0]) => {
    if (tool.action === "generate") {
      handleTab("generate");
      setGenerateView("workout");
    } else if (tool.action === "fixit") {
      handleTab("generate");
      setGenerateView("fixit");
    } else if (tool.key === "timer") {
      navigate("/timer");
    }
    // Other tools can be wired up as they're built
  }, [handleTab, navigate]);

  const currentTip = activeTab === "lifts" ? ZONE_LIFTS_TIP : activeTab === "generate" ? ZONE_GENERATE_TIP : activeTab === "train" ? ZONE_TRAIN_TIP : ZONE_HOME_TIP;
  const dismissTip = useCallback(() => {
    safeLocalStorage.setItem(currentTip.storageKey, "1");
    setShowTabTip(false);
  }, [currentTip]);

  const levelInfo = getLevelInfo(points?.total_points || 0);
  const nextLevel = getNextLevel(points?.total_points || 0);
  const ptsTotal = points?.total_points || 0;
  const progressPct = nextLevel ? Math.min(100, ((ptsTotal - levelInfo.min) / (nextLevel.min - levelInfo.min)) * 100) : 100;

  return (
    <ZoneThemeWrapper className="min-h-screen pb-24" style={{ background: "#0a0a0a", color: "#e5e5e5" }}>

      {/* ── Header ───────────────────────────────── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-5 py-3"
        style={{ background: "rgba(10,10,10,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="h-10 w-10 rounded-lg overflow-hidden flex items-center justify-center transition-all active:scale-90"
            style={{
              background: "#000",
              boxShadow: "0 0 14px rgba(249,115,22,0.6), 0 0 28px rgba(249,115,22,0.25)",
            }}
          >
            <img src={logoImg} alt="M²" className="h-9 w-9 object-contain" />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#f97316" }}>THE ZONE</p>
            <p className="text-sm font-semibold" style={{ color: "#fafafa" }}>{displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              const url = `${window.location.origin}?ref=${user?.id || ""}`;
              if (navigator.share) {
                navigator.share({ title: "Train with me on M²", url });
              } else {
                navigator.clipboard.writeText(url);
                toast({ title: "Link copied!" });
              }
            }}
            className="h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(249,115,22,0.15)" }}
          >
            <UserPlus size={16} style={{ color: "#f97316" }} />
          </button>
          <button onClick={() => navigate("/profile")} className="transition-all active:scale-90">
            <User size={20} style={{ color: "#525252" }} />
          </button>
          <button
            onClick={() => navigate("/timer")}
            className="h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(0,240,255,0.12)", boxShadow: "0 0 8px rgba(0,240,255,0.25)" }}
          >
            <Timer size={16} style={{ color: "#00f0ff" }} />
          </button>
        </div>
      </header>

      <main className="max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 pt-6 pb-4 space-y-6">

        {/* ══ STATS ROW ══════════════════════════ */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(249,115,22,0.12)" }}>
            <Flame size={20} className="mx-auto mb-1" style={{ color: "#f97316" }} />
            <p className="text-3xl font-black" style={{ color: "#fafafa" }}>{streak}</p>
            <p className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: "#737373" }}>Streak</p>
          </div>
          <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(168,85,247,0.12)" }}>
            <Activity size={20} className="mx-auto mb-1" style={{ color: "#a855f7" }} />
            <p className="text-3xl font-black" style={{ color: "#fafafa" }}>{sessionsThisWeek}</p>
            <p className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: "#737373" }}>Sessions</p>
          </div>
          <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0,240,255,0.12)" }}>
            <Star size={20} className="mx-auto mb-1" style={{ color: "#f97316" }} />
            <p className="text-3xl font-black" style={{ color: "#fafafa" }}>{ptsTotal}</p>
            <p className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: "#737373" }}>Points</p>
          </div>
        </div>

        {/* Level progress bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold" style={{ color: "#fb923c" }}>{levelInfo.label}</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #f97316, #fb923c)" }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          {nextLevel && <span className="text-xs font-bold" style={{ color: "#525252" }}>{nextLevel.label}</span>}
        </div>

        {/* ══ HERO CARD ══════════════════════════ */}
        <div className="rounded-2xl p-[1px]" style={{ background: "linear-gradient(135deg, #f97316, #a855f7, #00f0ff)" }}>
          <div className="rounded-2xl p-6" style={{ background: "rgba(10,10,10,0.95)", backdropFilter: "blur(20px)" }}>
            {currentProgram !== "—" && (
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#a855f7" }}>
                {currentProgram}
              </p>
            )}
            <h2 className="text-2xl font-black leading-tight" style={{ color: "#fafafa" }}>
              Start Today's Workout
            </h2>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "#737373" }}>
              {topPR
                ? `Top PR: ${topPR.name} — ${topPR.weight}lb · ${totalLifts} total lifts logged`
                : "Jump into your next session and keep the streak alive."}
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-workout-zone", { detail: null }))}
              className="w-full mt-5 rounded-xl py-4 text-base font-black uppercase tracking-wider transition-all active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(249,115,22,0.4)",
              }}
            >
              Start Training →
            </button>
          </div>
        </div>

        {/* ══ AI TOOLBOX CAROUSEL ════════════════ */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#a855f7" }}>AI Toolbox</p>
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
            {AI_TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.key}
                  onClick={() => handleAiTool(tool)}
                  className="flex-shrink-0 snap-center flex flex-col items-center gap-2 transition-all active:scale-95"
                  style={{ minWidth: "72px" }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: `${tool.color}15`, border: `1px solid ${tool.color}30` }}
                  >
                    <Icon size={24} style={{ color: tool.color }} />
                  </div>
                  <span className="text-xs font-bold" style={{ color: "#a3a3a3" }}>{tool.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ QUICK LOG ══════════════════════════ */}
        <button
          onClick={() => setShowQuickLog(true)}
          className="w-full rounded-2xl p-5 flex items-center gap-4 transition-all active:scale-[0.97]"
          style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(22,163,74,0.06))", border: "1px solid rgba(34,197,94,0.2)" }}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
            <Mic size={22} color="#fff" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-base font-black" style={{ color: "#fafafa" }}>What Did You Do Today?</p>
            <p className="text-sm mt-0.5" style={{ color: "#525252" }}>Voice or text — log cardio, circuits, anything</p>
          </div>
          <ChevronRight size={18} style={{ color: "#22c55e" }} />
        </button>

        {/* ══ CHECK-IN + PROVE IT ════════════════ */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              if (alreadyCheckedInToday) return;
              setShowCheckInChoice(true);
            }}
            disabled={alreadyCheckedInToday}
            className="rounded-2xl py-4 flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
            style={{
              background: alreadyCheckedInToday ? "rgba(255,255,255,0.02)" : "rgba(0,240,255,0.08)",
              border: `1px solid ${alreadyCheckedInToday ? "rgba(255,255,255,0.06)" : "rgba(0,240,255,0.2)"}`,
              color: alreadyCheckedInToday ? "#525252" : "#00f0ff",
              opacity: alreadyCheckedInToday ? 0.6 : 1,
            }}
          >
            {alreadyCheckedInToday ? <Check size={16} /> : <MapPin size={16} />}
            <span className="text-sm font-bold uppercase tracking-wider">
              {alreadyCheckedInToday ? "Checked In ✓" : "Check-In"}
            </span>
          </button>
          <button
            onClick={() => window.dispatchEvent(new Event("open-prove-it-zone"))}
            className="rounded-2xl py-4 flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
            style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", color: "#f97316" }}
          >
            <Trophy size={16} />
            <span className="text-sm font-bold uppercase tracking-wider">Prove It</span>
          </button>
        </div>

        {/* ══ SECONDARY ACTIONS ══════════════════ */}
        <div className="space-y-3">
          <SecondaryAction
            icon={Dumbbell} color="#f97316"
            title="Main Lifts Log" subtitle="Track compound lifts & progress"
            onClick={() => navigate("/progress")}
          />
          <SecondaryAction
            icon={Layers} color="#a855f7"
            title="My Programs" subtitle="Active & available training programs"
            onClick={() => handleTab("train")}
          />
          <SecondaryAction
            icon={FileText} color="#00f0ff"
            title="Custom Program Request" subtitle="Get a personalized plan from Coach Matt"
            onClick={() => handleTab("home")}
          />
          <SecondaryAction
            icon={Heart} color="#22c55e"
            title="Recovery & Mobility" subtitle="AI-powered recovery recommendations"
            onClick={() => navigate("/ai-insights")}
          />
          <SecondaryAction
            icon={MessageCircle} color="#f97316"
            title="Message Coach Matt" subtitle="Usually replies within 2 hours"
            onClick={() => handleTab("home")}
          />
        </div>

        {/* ── Tab Strip ──────────────────────────── */}
        <div
          className="flex rounded-xl p-1"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTab(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all min-w-0 overflow-hidden"
              style={
                activeTab === key
                  ? { background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", boxShadow: "0 4px 12px rgba(249,115,22,0.3)" }
                  : { color: "#525252" }
              }
            >
              <Icon size={14} className="shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {/* ── Resume Paused Workout ──────────────── */}
        {safeLocalStorage.getItem("m2-paused-workout") && (
          <button
            onClick={() => window.dispatchEvent(new Event("resume-workout-zone"))}
            className="w-full rounded-xl p-4 flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-widest animate-pulse"
            style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)", color: "#f97316" }}
          >
            <Play size={16} /> Resume Paused Workout
          </button>
        )}

        {/* ── Tab Content ────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "lifts" && (
              <Suspense fallback={<TabLoader />}>
                <div className="space-y-4">
                  <ProgressCharts />
                  <OverloadCard />
                </div>
              </Suspense>
            )}
            {activeTab === "generate" && <GenerateTabContent view={generateView} setView={setGenerateView} />}
            {activeTab === "train" && <TrainTabContent />}
            {activeTab === "home" && <HomeTab />}
          </motion.div>
        </AnimatePresence>

        {/* Learning modal */}
        {showTabTip && (
          <FeatureLearningModal tip={currentTip} onContinue={dismissTip} onDismiss={dismissTip} />
        )}
      </main>

      {/* Quick Activity Log Modal */}
      <AnimatePresence>
        {showQuickLog && (
          <Suspense fallback={null}>
            <QuickActivityLog onClose={() => setShowQuickLog(false)} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Check-In Choice Modal */}
      <AnimatePresence>
        {showCheckInChoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.85)" }}
            onClick={() => setShowCheckInChoice(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl p-6 space-y-5"
              style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <MapPin size={32} className="mx-auto mb-3" style={{ color: "#00f0ff" }} />
                <p className="text-base font-black uppercase tracking-wider" style={{ color: "#fafafa" }}>Where Are You Training?</p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => handleCheckIn("matts_gym")}
                  disabled={checkingIn}
                  className="w-full rounded-xl py-4 text-sm font-black uppercase tracking-widest transition-all active:scale-[0.97]"
                  style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff" }}
                >
                  🏋️ Matt's Gym
                </button>
                <button
                  onClick={() => handleCheckIn("on_your_own")}
                  disabled={checkingIn}
                  className="w-full rounded-xl py-4 text-sm font-black uppercase tracking-widest transition-all active:scale-[0.97]"
                  style={{ background: "rgba(0,240,255,0.1)", border: "1px solid rgba(0,240,255,0.3)", color: "#00f0ff" }}
                >
                  💪 On Your Own
                </button>
              </div>
              <button
                onClick={() => setShowCheckInChoice(false)}
                className="w-full text-center text-xs font-bold uppercase tracking-widest py-2"
                style={{ color: "#525252" }}
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ZoneThemeWrapper>
  );
};

export default ZoneDashboard;
