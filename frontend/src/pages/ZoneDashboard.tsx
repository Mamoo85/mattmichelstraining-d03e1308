import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePoints, getLevelInfo, getNextLevel } from "@/hooks/usePoints";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/browserStorage";
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
import DataHubButton from "@/components/dashboard/DataHubButton";
import logoImg from "@/assets/m2-logo-zone.png";
import type { FeatureTip } from "@/components/dashboard/FeatureLearningModal";
import {
  WORKOUT_GENERATOR_TIP,
  FIXIT_ENGINE_TIP,
  PROVE_IT_TIP,
  QUICK_ACTIVITY_TIP,
} from "@/components/dashboard/featureTips";
import { AnimatePresence } from "framer-motion";
import MonthlyAnnouncementModal from "@/components/dashboard/MonthlyAnnouncementModal";

const NotificationBell = lazy(() => import("@/components/layout/NotificationBell"));
const PwaInstallBanner = lazy(() => import("@/components/layout/PwaInstallBanner"));
const CoachChatPanel = lazy(() => import("@/components/dashboard/CoachChatPanel"));
const CustomProgramRequest = lazy(() => import("@/components/dashboard/CustomProgramRequest"));
const AiWorkoutSuggest = lazy(() => import("@/components/workout/AiWorkoutSuggest"));
const FixItLibrary = lazy(() => import("@/components/features/FixItLibrary"));
const QuickActivityLog = lazy(() => import("@/components/dashboard/QuickActivityLog"));
const FeatureLearningModal = lazy(() => import("@/components/dashboard/FeatureLearningModal"));
const MyPrograms = lazy(() => import("@/components/features/MyPrograms"));
const ChallengeHub = lazy(() => import("@/components/dashboard/ChallengeHub"));
const SelfPostureAnalysis = lazy(() => import("@/components/dashboard/SelfPostureAnalysis"));
const TechHubModal = lazy(() => import("@/components/dashboard/TechHubModal"));
const DashboardPromoBox = lazy(() => import("@/components/dashboard/DashboardPromoBox"));
const StudioCheckIn = lazy(() => import("@/components/sessions/StudioCheckIn"));

type GeneratorView = "workout" | "fixit" | "programs" | "challenge" | null;

const hasSeen = (key: string) => safeLocalStorage.getItem(key) === "1";
const markSeen = (key: string) => safeLocalStorage.setItem(key, "1");

const OverlayLoader = () => (
  <div className="flex justify-center py-20">
    <Loader2 size={24} className="animate-spin" style={{ color: "#22d3ee" }} />
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
          <button onClick={() => setView("menu")} className="text-xs font-medium" style={{ color: "#737373" }}>← Back</button>
          <AiWorkoutSuggest onDone={() => setView("menu")} />
        </div>
      </Suspense>
    );
  }
  if (view === "fixit") {
    return (
      <Suspense fallback={<TabLoader />}>
        <div className="space-y-3">
          <button onClick={() => setView("menu")} className="text-xs font-medium" style={{ color: "#737373" }}>← Back</button>
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

/* ── AI Toolbox ─────────────────────────────── */
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
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all active:scale-[0.98]">
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
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-1.5" style={{ borderTop: "1px solid rgba(168,85,247,0.1)" }}>
              {AI_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button key={tool.key} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all active:scale-[0.97]" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tool.color}18` }}>
                      <Icon size={14} style={{ color: tool.color }} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-bold" style={{ color: "#e5e5e5" }}>{tool.label}</p>
                      <p className="text-xs" style={{ color: "#525252" }}>{tool.desc}</p>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${tool.color}15`, color: tool.color }}>{tool.badge}</span>
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
    <div className="w-full rounded-2xl text-left overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.06), rgba(251,146,60,0.03))", border: "1px solid rgba(249,115,22,0.15)" }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-5 py-4 text-left transition-all active:scale-[0.98]">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
          <Zap size={17} color="#fff" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#fb923c" }}>The Power of Progressive Overload</p>
          <p className="text-xs mt-0.5" style={{ color: "#525252" }}>The #1 principle behind every PR</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} style={{ color: "#f97316" }} />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-3" style={{ borderTop: "1px solid rgba(249,115,22,0.1)" }}>
              <p className="text-xs leading-relaxed pt-3" style={{ color: "#a3a3a3" }}>
                Progressive overload is the gradual increase of stress placed on your body during training. It's the single most important principle for building strength, muscle, and athletic performance.
              </p>
              <div className="space-y-2">
                {[
                  { icon: "📈", title: "Add Weight", desc: "Even 2.5 lbs more than last session counts" },
                  { icon: "🔁", title: "Add Reps", desc: "Same weight, one more rep — that's growth" },
                  { icon: "📦", title: "Add Sets", desc: "More volume = more stimulus over time" },
                  { icon: "⏱️", title: "Slow the Tempo", desc: "More time under tension, more adaptation" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(249,115,22,0.06)" }}>
                    <span className="text-base">{item.icon}</span>
                    <div>
                      <p className="text-xs font-bold" style={{ color: "#fafafa" }}>{item.title}</p>
                      <p className="text-xs" style={{ color: "#737373" }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(249,115,22,0.08)", borderLeft: "3px solid #f97316" }}>
                <p className="text-xs italic leading-relaxed" style={{ color: "#fb923c" }}>"Your body only grows when you give it a reason to. Track every lift, beat your numbers, and let the data prove you're getting stronger."</p>
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

/* ── Train Tab ──────────────────────────────── */
const TrainSection = ({ title, subtitle, icon: Icon, color, children }: {
  title: string; subtitle: string; icon: typeof Dumbbell; color: string; children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${color}33` }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-4 p-4 text-left transition-all active:scale-[0.98]">
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
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="overflow-hidden">
            <div className="px-4 pb-4" style={{ borderTop: `1px solid ${color}1a` }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TrainTabContent = memo(() => (
  <Suspense fallback={<TabLoader />}>
    <div className="space-y-3">
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.10), rgba(168,85,247,0.06))", border: "1px solid rgba(249,115,22,0.18)" }}>
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
      <button onClick={() => window.dispatchEvent(new CustomEvent("open-workout-zone", { detail: null }))} className="w-full rounded-2xl py-3 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all active:scale-[0.97]" style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.12), rgba(6,182,212,0.08))", border: "1px solid rgba(0,240,255,0.25)", color: "#00f0ff" }}>
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
      <button onClick={() => setChatOpen(true)} className="w-full flex items-center gap-4 rounded-2xl p-4 transition-all active:scale-[0.98]" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
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
  const isProOrElite = subscriptionTier === "pro" || subscriptionTier === "elite";
  const { points, transactions } = usePoints();
  const navigate = useNavigate();
  useBrowserNotifications();

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
  const [chatOpen, setChatOpen] = useState(false);

  const [streak, setStreak] = useState(0);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [generatorView, setGeneratorView] = useState<GeneratorView>(null);
  const [activeTip, setActiveTip] = useState<FeatureTip | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [recentActivity, setRecentActivity] = useState<{ type: string; summary: string; date: string } | null>(null);
  const [postureOpen, setPostureOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);

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
    const { error } = await supabase.from("studio_checkins").insert({ user_id: user.id } as any);
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
      label: "Log Activity",
      icon: <Mic size={18} />,
      color: "#22c55e",
      action: () => withTip(QUICK_ACTIVITY_TIP, () => setShowQuickLog(true)),
    },
    {
      label: "Prove It",
      icon: <Trophy size={18} />,
      color: "#eab308",
      action: () => withTip(PROVE_IT_TIP, () => window.dispatchEvent(new Event("open-prove-it-zone"))),
    },
    {
      label: "Coach",
      icon: <MessageCircle size={18} />,
      color: "#22d3ee",
      action: () => setChatOpen(true),
    },
    {
      label: "Timer",
      icon: <Timer size={18} />,
      color: "#00f0ff",
      action: () => navigate("/timer"),
    },
  ];

  const HUB_ITEMS = [
    {
      label: "Programs",
      icon: <Target size={22} />,
      color: "#22d3ee",
      action: () => openOverlay("programs"),
    },
    {
      label: "Generator",
      icon: <Sparkles size={22} />,
      color: "#a855f7",
      action: () => withTip(WORKOUT_GENERATOR_TIP, () => openOverlay("workout")),
    },
    {
      label: "Fix It",
      icon: <Wrench size={22} />,
      color: "#00f0ff",
      action: () => withTip(FIXIT_ENGINE_TIP, () => openOverlay("fixit")),
    },
    {
      label: "Nutrition",
      icon: <Utensils size={22} />,
      color: "#22c55e",
      action: () => navigate("/nutrition-plan"),
    },
    {
      label: "Challenges",
      icon: <Zap size={22} />,
      color: "#eab308",
      action: () => openOverlay("challenge"),
    },
    {
      label: "Progress",
      icon: <BarChart3 size={22} />,
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
      <MonthlyAnnouncementModal />
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
            <img src={logoImg} alt="M2" className="h-8 w-8 object-contain" />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#22d3ee" }}>THE ZONE</p>
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
          onStreakClick={() => setShowCheckIn(true)}
          onSessionsClick={() => navigate("/progress")}
          onPointsClick={() => setGeneratorView("challenge")}
        />

        {/* Recent Points Activity */}
        {transactions.length > 0 && (
          <div
            className="rounded-2xl p-3 space-y-2"
            style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}
          >
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#a855f7" }}>Recent Points</p>
            {transactions.slice(0, 4).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <span className="text-[11px] truncate flex-1" style={{ color: "#a3a3a3" }}>
                  {tx.description}
                </span>
                <span className="text-[11px] font-bold ml-2 shrink-0" style={{ color: "#22c55e" }}>
                  +{tx.points}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Data Hub — animated stat flipper */}
        <DataHubButton />

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

        {/* Quick Actions — 4-col grid like mockup */}
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] mb-2 px-1" style={{ color: "#404040" }}>
            Quick Actions
          </p>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_ACTIONS.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="flex flex-col items-center gap-1.5 rounded-xl py-3 px-1 transition-all active:scale-[0.93]"
                style={{
                  background: `${item.color}10`,
                  border: `1.5px solid ${item.color}40`,
                  boxShadow: `0 0 14px ${item.color}25, inset 0 0 10px ${item.color}08`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${item.color}20`, color: item.color }}
                >
                  {item.icon}
                </div>
                <span className="text-[10px] font-bold leading-tight text-center" style={{ color: "#d4d4d4" }}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Hub — 3-col grid like mockup */}
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] mb-2 px-1" style={{ color: "#404040" }}>
            Hub
          </p>
          <div className="grid grid-cols-3 gap-2">
            {HUB_ITEMS.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="flex flex-col items-center gap-1.5 rounded-xl py-3.5 px-1 transition-all active:scale-[0.95] group"
                style={{
                  background: `${item.color}10`,
                  border: `1.5px solid ${item.color}35`,
                  boxShadow: `0 0 14px ${item.color}20, inset 0 0 8px ${item.color}06`,
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: `${item.color}20`, color: item.color }}
                >
                  {item.icon}
                </div>
                <span className="text-[11px] font-bold leading-tight text-center" style={{ color: "#e5e5e5" }}>
                  {item.label}
                </span>
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

          {/* Dynamic Promo Box */}
          <Suspense fallback={null}>
            <DashboardPromoBox />
          </Suspense>

          {/* Install App prompt */}
          {!window.matchMedia("(display-mode: standalone)").matches && (
            <button
              onClick={() => navigate("/install")}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mt-2 transition-all active:scale-[0.98]"
              style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.15)" }}
            >
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>
                📲 Install the M2 App
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

      {/* Quick Activity Log Modal */}
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
      {/* Check-In Modal */}
      {showCheckIn && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <div
            className="w-full max-w-lg rounded-t-3xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4 animate-in slide-in-from-bottom-8"
            style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-widest" style={{ color: "#22c55e" }}>Check In</p>
              <button onClick={() => setShowCheckIn(false)} className="text-xs font-bold uppercase" style={{ color: "#525252" }}>Close</button>
            </div>
            <Suspense fallback={null}>
              <StudioCheckIn />
            </Suspense>
          </div>
        </div>
      )}
      <Suspense fallback={null}>
        <SelfPostureAnalysis open={postureOpen} onClose={() => setPostureOpen(false)} />
        <TechHubModal open={techOpen} onClose={() => setTechOpen(false)} />
        {user && <PwaInstallBanner autoTrigger />}
      </Suspense>
    </ZoneThemeWrapper>
  );
};

export default ZoneDashboard;
