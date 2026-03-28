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
  Mic, MapPin, Check
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
    <div className="w-5 h-5 rounded-full animate-spin" style={{ border: "2px solid #f97316", borderTopColor: "transparent" }} />
  </div>
);

/* ── Generate Tab ───────────────────────────── */
const GenerateTabContent = memo(({ view, setView }: { view: "menu" | "workout" | "fixit"; setView: (v: "menu" | "workout" | "fixit") => void }) => {
  if (view === "workout") {
    return (
      <Suspense fallback={<TabLoader />}>
        <div className="space-y-3">
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
        <div className="space-y-3">
          <button onClick={() => setView("menu")} className="text-xs font-medium" style={{ color: "#737373" }}>
            ← Back
          </button>
          <AiWorkoutSuggest onDone={() => setView("menu")} initialPath="fixit" />
        </div>
      </Suspense>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setView("workout")}
        className="w-full rounded-2xl p-5 text-left transition-all active:scale-[0.97]"
        style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(249,115,22,0.08))", border: "1px solid rgba(168,85,247,0.2)" }}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)" }}>
            <Brain size={22} color="#fff" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black" style={{ color: "#fafafa" }}>Perfect Workout Generator</p>
            <p className="text-xs mt-0.5" style={{ color: "#a3a3a3" }}>AI builds your session with auto-configured timer</p>
          </div>
          <ChevronRight size={16} style={{ color: "#a855f7" }} />
        </div>
      </button>

      <button
        onClick={() => setView("fixit")}
        className="w-full rounded-2xl p-5 text-left transition-all active:scale-[0.97]"
        style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.1), rgba(6,182,212,0.06))", border: "1px solid rgba(0,240,255,0.2)" }}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #00f0ff, #0891b2)" }}>
            <Wrench size={22} color="#fff" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black" style={{ color: "#fafafa" }}>Fix It Engine</p>
            <p className="text-xs mt-0.5" style={{ color: "#a3a3a3" }}>Corrective protocols tailored to your body</p>
          </div>
          <ChevronRight size={16} style={{ color: "#00f0ff" }} />
        </div>
      </button>

      <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(0,240,255,0.05)", border: "1px solid rgba(0,240,255,0.1)" }}>
        <Timer size={16} style={{ color: "#00f0ff" }} />
        <p className="text-xs" style={{ color: "#737373" }}>
          <span className="font-bold" style={{ color: "#00f0ff" }}>Auto-Timer</span> — Your interval timer auto-configures to match every generated workout.
        </p>
      </div>

      <AiToolbox />
    </div>
  );
});
GenerateTabContent.displayName = "GenerateTabContent";

/* ── AI Toolbox (user-facing tools) ─────────── */
const AI_TOOLS = [
  { key: "velocity", label: "Velocity Tracker", icon: Zap, color: "#f97316", badge: "Speed AI", desc: "Track bar speed and power output" },
  { key: "scanner", label: "Workout Scanner", icon: Camera, color: "#a855f7", badge: "Camera AI", desc: "Scan a whiteboard or printed workout" },
  { key: "recovery", label: "Recovery Advisor", icon: Heart, color: "#22c55e", badge: "LLM", desc: "AI-powered recovery recommendations" },
  { key: "timer", label: "Interval Timer", icon: Timer, color: "#00f0ff", badge: "Tool", desc: "Custom work/rest interval timer" },
  { key: "form", label: "Bar Path Tracker", icon: Crosshair, color: "#f97316", badge: "Vision AI", desc: "Camera-based bar path analysis" },
];

const AiToolbox = memo(() => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(168,85,247,0.15)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all active:scale-[0.98]"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(168,85,247,0.15)" }}>
          <Sparkles size={16} style={{ color: "#a855f7" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#a855f7" }}>Your AI Toolbox</p>
          <p className="text-xs mt-0.5" style={{ color: "#737373" }}>Smart tools to level up every session</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} style={{ color: "#a855f7" }} />
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
            <div className="px-3 pb-3 space-y-1.5" style={{ borderTop: "1px solid rgba(168,85,247,0.1)" }}>
              {AI_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.key}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all active:scale-[0.97]"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tool.color}18` }}>
                      <Icon size={14} style={{ color: tool.color }} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-bold" style={{ color: "#e5e5e5" }}>{tool.label}</p>
                      <p className="text-xs" style={{ color: "#525252" }}>{tool.desc}</p>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${tool.color}15`, color: tool.color }}>
                      {tool.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
AiToolbox.displayName = "AiToolbox";

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
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-all active:scale-[0.98]"
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
        >
          <Zap size={17} color="#fff" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#fb923c" }}>
            The Power of Progressive Overload
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#525252" }}>
            The #1 principle behind every PR
          </p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} style={{ color: "#f97316" }} />
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
            <div className="px-5 pb-5 space-y-3" style={{ borderTop: "1px solid rgba(249,115,22,0.1)" }}>
              <p className="text-[12px] leading-relaxed pt-3" style={{ color: "#a3a3a3" }}>
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
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(249,115,22,0.06)" }}
                  >
                    <span className="text-base">{item.icon}</span>
                    <div>
                      <p className="text-xs font-bold" style={{ color: "#fafafa" }}>{item.title}</p>
                      <p className="text-xs" style={{ color: "#737373" }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(249,115,22,0.08)", borderLeft: "3px solid #f97316" }}>
                <p className="text-xs italic leading-relaxed" style={{ color: "#fb923c" }}>
                  "Your body only grows when you give it a reason to. Track every lift, beat your numbers, and let the data prove you're getting stronger."
                </p>
                <p className="text-xs font-bold mt-1" style={{ color: "#737373" }}>— Coach Matt</p>
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
        className="w-full flex items-center gap-4 p-4 text-left transition-all active:scale-[0.98]"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-wider" style={{ color }}>{title}</p>
          <p className="text-xs mt-0.5" style={{ color: "#737373" }}>{subtitle}</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} style={{ color }} />
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
            <div className="px-4 pb-4" style={{ borderTop: `1px solid ${color}1a` }}>
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
    <div className="space-y-3">
      <div
        className="rounded-2xl p-5"
        style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.10), rgba(168,85,247,0.06))",
          border: "1px solid rgba(249,115,22,0.18)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
            <Dumbbell size={22} color="#fff" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black" style={{ color: "#fafafa" }}>Your Training Library</p>
            <p className="text-xs mt-0.5" style={{ color: "#a3a3a3" }}>Programs, workouts & today's session — all in one place</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent("open-workout-zone", { detail: null }))}
        className="w-full rounded-2xl py-3 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all active:scale-[0.97]"
        style={{
          background: "linear-gradient(135deg, rgba(0,240,255,0.12), rgba(6,182,212,0.08))",
          border: "1px solid rgba(0,240,255,0.25)",
          color: "#00f0ff",
        }}
      >
        <Play size={15} /> Open Workout
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
        className="w-full flex items-center gap-4 rounded-2xl p-4 transition-all active:scale-[0.98]"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(249,115,22,0.15)" }}>
            <MessageCircle size={18} style={{ color: "#f97316" }} />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "#22c55e", border: "2px solid #0a0a0a" }} />
        </div>
        <div className="text-left flex-1">
          <p className="text-sm font-semibold" style={{ color: "#fafafa" }}>Message Coach Matt</p>
          <p className="text-xs" style={{ color: "#525252" }}>Usually replies within 2 hours</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>Online</span>
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
        setCurrentProgram(t.length > 20 ? t.slice(0, 20) + "…" : t);
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

      // Check if already checked in today
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
        className="sticky top-0 z-50 flex items-center justify-between px-4 py-2.5"
        style={{ background: "rgba(10,10,10,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="h-9 w-9 rounded-lg overflow-hidden flex items-center justify-center transition-all active:scale-90"
            style={{
              background: "#000",
              boxShadow: "0 0 14px rgba(249,115,22,0.6), 0 0 28px rgba(249,115,22,0.25)",
            }}
          >
            <img
              src={logoImg}
              alt="M²"
              className="h-8 w-8 object-contain"
            />
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
              if (navigator.share) {
                navigator.share({ title: "Train with me on M²", url });
              } else {
                navigator.clipboard.writeText(url);
                toast({ title: "Link copied!" });
              }
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

      <main className="max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-4 pt-4 pb-4 space-y-4">

        {/* ── Stats Banner ────────── */}
        {/* ── Stats Banner (high-contrast) ────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(249,115,22,0.15)",
          }}
        >
          {/* Stats Grid — 3 columns, big numbers */}
          <div className="grid grid-cols-3 divide-x divide-white/[0.06] p-4">
            <div className="flex flex-col items-center gap-1 px-2">
              <Flame size={18} style={{ color: "#f97316" }} />
              <span className="text-2xl font-black" style={{ color: "#f97316" }}>{streak}</span>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#737373" }}>Streak</span>
            </div>
            <div className="flex flex-col items-center gap-1 px-2">
              <Activity size={18} style={{ color: "#a855f7" }} />
              <span className="text-2xl font-black" style={{ color: "#a855f7" }}>{sessionsThisWeek}</span>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#737373" }}>Sessions</span>
            </div>
            <div className="flex flex-col items-center gap-1 px-2">
              <Star size={18} style={{ color: "#00f0ff" }} />
              <span className="text-2xl font-black" style={{ color: "#00f0ff" }}>{ptsTotal}</span>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#737373" }}>Points</span>
            </div>
          </div>

          {/* Level progress bar */}
          <div className="px-4 pb-3 flex items-center gap-2">
            <span className="text-xs font-bold shrink-0" style={{ color: "#fb923c" }}>{levelInfo.label}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #f97316, #fb923c)" }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            {nextLevel && (
              <span className="text-xs font-bold shrink-0" style={{ color: "#525252" }}>
                {nextLevel.min - ptsTotal} to go
              </span>
            )}
          </div>

          {currentProgram !== "—" && (
            <div className="flex items-center gap-2 px-4 pb-3 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <Target size={14} style={{ color: "#00f0ff" }} />
              <span className="text-xs font-medium truncate" style={{ color: "#a3a3a3" }}>{currentProgram}</span>
            </div>
          )}

          {/* Condensed Check-In + Prove It strip */}
          <div className="flex" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => {
                if (alreadyCheckedInToday) return;
                setShowCheckInChoice(true);
              }}
              disabled={alreadyCheckedInToday}
              className="flex-1 flex items-center justify-center gap-2 py-3 transition-all active:scale-[0.98]"
              style={{
                color: alreadyCheckedInToday ? "#525252" : "#00f0ff",
                opacity: alreadyCheckedInToday ? 0.6 : 1,
              }}
            >
              {alreadyCheckedInToday ? <Check size={14} /> : <MapPin size={14} />}
              <span className="text-xs font-bold uppercase tracking-widest">
                {alreadyCheckedInToday ? "Checked In ✓" : "Check In"}
              </span>
            </button>
            <div className="w-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            <button
              onClick={() => window.dispatchEvent(new Event("open-prove-it-zone"))}
              className="flex-1 flex items-center justify-center gap-2 py-3 transition-all active:scale-[0.98]"
              style={{ color: "#f97316" }}
            >
              <Trophy size={14} />
              <span className="text-xs font-bold uppercase tracking-widest">Prove It</span>
            </button>
          </div>
        </div>

        {/* ── Persistent "What I Did Today" — right under stats ── */}
        <button
          onClick={() => setShowQuickLog(true)}
          className="w-full rounded-2xl p-3.5 flex items-center gap-3 transition-all active:scale-[0.97]"
          style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(22,163,74,0.06))", border: "1px solid rgba(34,197,94,0.2)" }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
            <Mic size={16} color="#fff" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-sm font-black" style={{ color: "#fafafa" }}>What Did You Do Today?</p>
            <p className="text-xs mt-0.5" style={{ color: "#525252" }}>Voice or text — log cardio, circuits, anything</p>
          </div>
          <ChevronRight size={16} style={{ color: "#22c55e" }} />
        </button>

        {/* ── Action Grid (2×2) — shorter cards ──── */}
        <div className="grid grid-cols-2 gap-2">
          {/* Main Lifts Log */}
          <button
            onClick={() => navigate("/progress")}
            className="rounded-2xl p-3 text-left transition-all active:scale-[0.96]"
            style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.1), rgba(234,88,12,0.06))", border: "1px solid rgba(249,115,22,0.2)" }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
              <Dumbbell size={15} color="#fff" />
            </div>
            <p className="text-xs font-black" style={{ color: "#fafafa" }}>Main Lifts Log</p>
            <p className="text-[11px] mt-0.5" style={{ color: "#525252" }}>Track lifts & progress</p>
          </button>

          {/* Challenges & Focus */}
          <button
            onClick={() => handleTab("home")}
            className="rounded-2xl p-3 text-left transition-all active:scale-[0.96]"
            style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(22,163,74,0.06))", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
              <Award size={15} color="#fff" />
            </div>
            <p className="text-xs font-black" style={{ color: "#fafafa" }}>Challenges & Focus</p>
            <p className="text-[11px] mt-0.5" style={{ color: "#525252" }}>Monthly goals</p>
          </button>

          {/* Generator */}
          <button
            onClick={() => { handleTab("generate"); setGenerateView("menu"); }}
            className="rounded-2xl overflow-hidden text-left transition-all active:scale-[0.96] relative"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(168,85,247,0.2)" }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.12) 50%, rgba(0,240,255,0.10) 50%)" }} />
            </div>
            <div className="relative p-3">
              <div className="flex gap-1.5 mb-1.5">
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: "rgba(168,85,247,0.3)" }}>
                  <Sparkles size={10} color="#a855f7" />
                </div>
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: "rgba(0,240,255,0.3)" }}>
                  <Wrench size={10} color="#00f0ff" />
                </div>
              </div>
              <p className="text-xs font-black" style={{ color: "#fafafa" }}>Generator</p>
              <p className="text-[11px] mt-0.5" style={{ color: "#525252" }}>AI builds your workout</p>
            </div>
          </button>

          {/* Workout Library */}
          <button
            onClick={() => handleTab("train")}
            className="rounded-2xl p-3 text-left transition-all active:scale-[0.96]"
            style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.08), rgba(6,182,212,0.04))", border: "1px solid rgba(0,240,255,0.2)" }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5" style={{ background: "linear-gradient(135deg, #00f0ff, #0891b2)" }}>
              <Play size={15} color="#fff" />
            </div>
            <p className="text-xs font-black" style={{ color: "#fafafa" }}>Workout Library</p>
            <p className="text-[11px] mt-0.5" style={{ color: "#525252" }}>Programs & saved</p>
          </button>
        </div>

        {/* ── Recovery & Mobility Tips ───────────── */}
        <button
          onClick={() => navigate("/ai-insights")}
          className="w-full rounded-xl p-3 flex items-center gap-3 transition-all active:scale-[0.97]"
          style={{
            background: "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(124,58,237,0.06))",
            border: "1px solid rgba(168,85,247,0.18)",
          }}
        >
          <Heart size={16} style={{ color: "#a855f7" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#a855f7" }}>Recovery & Mobility Tips</span>
          <ChevronRight size={14} className="ml-auto" style={{ color: "#a855f7" }} />
        </button>

        {/* ── Tab Strip ──────────────────────────── */}
        <div
          className="flex rounded-xl p-1"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTab(key)}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all min-w-0 overflow-hidden"
              style={
                activeTab === key
                  ? { background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", boxShadow: "0 4px 12px rgba(249,115,22,0.3)" }
                  : { color: "#525252" }
              }
            >
              <Icon size={12} className="shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {/* ── Resume Paused Workout ──────────────── */}
        {safeLocalStorage.getItem("m2-paused-workout") && (
          <button
            onClick={() => window.dispatchEvent(new Event("resume-workout-zone"))}
            className="w-full rounded-xl p-3 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest animate-pulse"
            style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)", color: "#f97316" }}
          >
            <Play size={14} /> Resume Paused Workout
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
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)" }}
            onClick={() => setShowCheckInChoice(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl p-6 space-y-4"
              style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <MapPin size={28} className="mx-auto mb-2" style={{ color: "#00f0ff" }} />
                <p className="text-sm font-black uppercase tracking-wider" style={{ color: "#fafafa" }}>Where Are You Training?</p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => handleCheckIn("matts_gym")}
                  disabled={checkingIn}
                  className="w-full rounded-xl py-4 text-xs font-black uppercase tracking-widest transition-all active:scale-[0.97]"
                  style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff" }}
                >
                  🏋️ Matt's Gym
                </button>
                <button
                  onClick={() => handleCheckIn("on_your_own")}
                  disabled={checkingIn}
                  className="w-full rounded-xl py-4 text-xs font-black uppercase tracking-widest transition-all active:scale-[0.97]"
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
