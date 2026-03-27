import { useState, useEffect, lazy, Suspense, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePoints } from "@/hooks/usePoints";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/browserStorage";
import { BarChart3, Sparkles, Dumbbell, Home, Flame, Zap, Trophy, Play, Wrench, Timer, ChevronRight, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ZoneThemeWrapper from "@/components/zone/ZoneThemeWrapper";
import logoImg from "@/assets/m2-logo-official.png";

// Lazy-load heavy tab content
const ProgressCharts = lazy(() => import("@/components/features/ProgressCharts"));
const WorkoutsTab = lazy(() => import("@/components/dashboard/WorkoutsTab"));
const FixItLibrary = lazy(() => import("@/components/features/FixItLibrary"));
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

// Modals
const WelcomeGiftModal = lazy(() => import("@/components/dashboard/WelcomeGiftModal"));
const NamePromptModal = lazy(() => import("@/components/dashboard/NamePromptModal"));
const FeatureLearningModal = lazy(() => import("@/components/dashboard/FeatureLearningModal"));
const PortalOnboarding = lazy(() => import("@/components/dashboard/PortalOnboarding"));

type TabKey = "lifts" | "generate" | "train" | "home";

const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "lifts", label: "Lifts", icon: BarChart3 },
  { key: "generate", label: "Generate", icon: Sparkles },
  { key: "train", label: "Train", icon: Dumbbell },
  { key: "home", label: "Home", icon: Home },
];

const TAB_STORAGE_KEY = "zone-dash-tab";

/* ── Stat Card ────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color }: {
  icon: typeof Flame;
  label: string;
  value: string | number;
  color: string;
}) => (
  <div className="zone-glass flex-1 min-w-0 p-3 flex flex-col items-center gap-1">
    <Icon size={16} className={color} />
    <span className="text-xl font-bold text-foreground tracking-tight">{value}</span>
    <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
  </div>
);

/* ── Quick Action Button ─────────────────────── */
const QuickAction = ({ icon: Icon, label, onClick, glowClass }: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
  glowClass: string;
}) => (
  <button
    onClick={onClick}
    className={`zone-glass flex-1 min-w-0 p-3 flex flex-col items-center gap-2 transition-all active:scale-95 ${glowClass}`}
  >
    <Icon size={20} />
    <span className="text-[9px] uppercase tracking-widest font-semibold">{label}</span>
  </button>
);

/* ── Generate Tab Content ────────────────────── */
const GenerateTab = memo(() => {
  const [view, setView] = useState<"menu" | "workout" | "fixit">("menu");

  if (view === "workout") {
    return (
      <Suspense fallback={<TabLoader />}>
        <div className="space-y-3">
          <button onClick={() => setView("menu")} className="text-xs text-muted-foreground hover:text-primary transition-colors">
            ← Back to generators
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
          <button onClick={() => setView("menu")} className="text-xs text-muted-foreground hover:text-primary transition-colors">
            ← Back to generators
          </button>
          <AiWorkoutSuggest onDone={() => setView("menu")} initialPath="fixit" />
        </div>
      </Suspense>
    );
  }

  return (
    <div className="space-y-4">
      {/* Two launcher cards */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setView("workout")}
          className="zone-glass zone-glow-orange p-5 flex flex-col items-center gap-3 transition-all active:scale-95 group"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:shadow-orange-500/40 transition-shadow">
            <Sparkles size={24} className="text-white" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">Smart Workout</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">AI-powered training</p>
          </div>
          <ChevronRight size={14} className="text-muted-foreground" />
        </button>

        <button
          onClick={() => setView("fixit")}
          className="zone-glass zone-glow-purple p-5 flex flex-col items-center gap-3 transition-all active:scale-95 group"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-shadow">
            <Wrench size={24} className="text-white" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">Fix It Protocol</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Corrective exercise</p>
          </div>
          <ChevronRight size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Timer auto-config callout */}
      <div className="zone-glass border-l-2 border-l-cyan-400 p-4 flex items-start gap-3">
        <Timer size={18} className="text-cyan-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-bold text-cyan-300">⚡ Auto-Timer</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
            When the AI builds your workout, the Interval Timer automatically configures work/rest/rounds to match. Just press play.
          </p>
        </div>
      </div>
    </div>
  );
});
GenerateTab.displayName = "GenerateTab";

/* ── Home Tab Content ────────────────────────── */
const HomeTab = memo(() => {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Coach Chat */}
      <button
        onClick={() => setChatOpen(true)}
        className="w-full zone-glass p-4 flex items-center gap-3 transition-all active:scale-[0.98]"
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shrink-0">
          <MessageCircle size={18} className="text-white" />
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Message Matt</p>
          <p className="text-[10px] text-muted-foreground">Direct coach chat</p>
        </div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </button>
      {chatOpen && (
        <Suspense fallback={null}>
          <CoachChatPanel onClose={() => setChatOpen(false)} />
        </Suspense>
      )}

      <Suspense fallback={null}><TodaysTrainingCard /></Suspense>
      <Suspense fallback={null}><MonthlyFocusWidget /></Suspense>
      <Suspense fallback={null}><DashboardChallengePreview onViewChallenge={() => {}} /></Suspense>
      <Suspense fallback={null}><CommunityActivityFeed /></Suspense>
      <Suspense fallback={null}><UpcomingSessions /></Suspense>
      <Suspense fallback={null}><CustomProgramRequest /></Suspense>
      <Suspense fallback={null}><MyPrograms /></Suspense>
      <Suspense fallback={null}><DashboardReferralCard /></Suspense>
      <Suspense fallback={null}><SharedWorkoutFeed /></Suspense>
    </div>
  );
});
HomeTab.displayName = "HomeTab";

/* ── Tab Loader ──────────────────────────────── */
const TabLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

/* ── Main Page ───────────────────────────────── */
const ZoneDashboard = () => {
  const { user, subscriptionTier } = useAuth();
  const tierLabel = subscriptionTier ? subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1) : "Member";
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    return (safeLocalStorage.getItem(TAB_STORAGE_KEY) as TabKey) || "lifts";
  });

  // Quick stats
  const [streak, setStreak] = useState(0);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [currentProgram, setCurrentProgram] = useState("—");
  const [displayName, setDisplayName] = useState("Athlete");

  useEffect(() => {
    if (!user) return;
    // Fetch streak from progress_logs
    const fetchStats = async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { count } = await supabase
        .from("progress_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("logged_at", weekAgo.toISOString());
      setSessionsThisWeek(count || 0);

      // Current active program
      const { data: ap } = await supabase
        .from("user_active_programs")
        .select("program_id, training_programs!inner(title)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (ap?.training_programs && typeof ap.training_programs === "object" && "title" in ap.training_programs) {
        const title = (ap.training_programs as any).title as string;
        setCurrentProgram(title.length > 16 ? title.slice(0, 16) + "…" : title);
      }

      // Streak — count consecutive days with logs
      const { data: logs } = await supabase
        .from("progress_logs")
        .select("logged_at")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(60);

      if (logs && logs.length > 0) {
        let s = 1;
        const days = [...new Set(logs.map(l => l.logged_at.slice(0, 10)))].sort().reverse();
        for (let i = 1; i < days.length; i++) {
          const prev = new Date(days[i - 1]);
          const curr = new Date(days[i]);
          prev.setDate(prev.getDate() - 1);
          if (prev.toISOString().slice(0, 10) === curr.toISOString().slice(0, 10)) {
            s++;
          } else break;
        }
        setStreak(s);
      }
    };
    fetchStats();
  }, [user]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    safeLocalStorage.setItem(TAB_STORAGE_KEY, tab);
  };

  

  return (
    <ZoneThemeWrapper className="min-h-screen pb-24">
      {/* ── Zone Header ─────────────────────────── */}
      <header className="sticky top-0 z-50 zone-glass border-b border-white/[0.06] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="M²" className="h-9 w-9 rounded-lg object-contain" />
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground truncate">{displayName}</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{tierLabel || "Member"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.dispatchEvent(new Event("open-prove-it-zone"))}
              className="zone-glass px-3 py-1.5 text-[9px] uppercase tracking-widest font-bold text-orange-400 hover:text-orange-300 transition-colors"
            >
              Submit PR
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* ── Quick Stats ──────────────────────────── */}
        <div className="flex gap-2">
          <StatCard icon={Flame} label="Streak" value={`${streak}d`} color="text-green-400" />
          <StatCard icon={Zap} label="This Week" value={sessionsThisWeek} color="text-orange-400" />
          <StatCard icon={Trophy} label="Program" value={currentProgram} color="text-cyan-400" />
        </div>

        {/* ── Action Buttons ──────────────────────── */}
        <div className="flex gap-2">
          <QuickAction
            icon={Play}
            label="Workout Portal"
            onClick={() => window.dispatchEvent(new CustomEvent("open-workout-zone"))}
            glowClass="zone-glow-orange text-orange-400"
          />
          <QuickAction
            icon={Sparkles}
            label="AI Generator"
            onClick={() => handleTabChange("generate")}
            glowClass="zone-glow-purple text-purple-400"
          />
          <QuickAction
            icon={Wrench}
            label="Fix It Engine"
            onClick={() => handleTabChange("generate")}
            glowClass="zone-glow-cyan text-cyan-400"
          />
        </div>

        {/* ── Tab Pills ───────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all shrink-0 ${
                activeTab === key
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25"
                  : "zone-glass text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Resume Paused Workout ──────────────── */}
        {safeLocalStorage.getItem("m2-paused-workout") && (
          <button
            onClick={() => window.dispatchEvent(new Event("resume-workout-zone"))}
            className="w-full zone-glass zone-glow-orange p-3 flex items-center justify-center gap-2 text-orange-400 font-bold text-xs uppercase tracking-widest animate-pulse"
          >
            <Play size={14} /> Resume Paused Workout
          </button>
        )}

        {/* ── Tab Content ─────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "lifts" && (
              <Suspense fallback={<TabLoader />}>
                {/* Hero Log-a-Lift card */}
                <div className="zone-glass zone-glow-sweep p-4 mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-foreground">Log a Lift</p>
                    <p className="text-[10px] text-muted-foreground">Track your progress. Own every rep.</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 via-cyan-500 to-purple-500 flex items-center justify-center">
                    <BarChart3 size={20} className="text-white" />
                  </div>
                </div>
                <ProgressCharts />
              </Suspense>
            )}

            {activeTab === "generate" && <GenerateTab />}

            {activeTab === "train" && (
              <Suspense fallback={<TabLoader />}>
                <div className="space-y-4">
                  <TodaysTrainingCard />
                  <WorkoutsTab />
                  <MyPrograms />
                </div>
              </Suspense>
            )}

            {activeTab === "home" && <HomeTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </ZoneThemeWrapper>
  );
};

export default ZoneDashboard;
