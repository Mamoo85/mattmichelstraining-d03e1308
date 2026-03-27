import { useState, useEffect, lazy, Suspense, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/browserStorage";
import { BarChart3, Sparkles, Dumbbell, Home, Flame, Zap, Trophy, Play, Wrench, Timer, ChevronRight, MessageCircle, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ZoneThemeWrapper from "@/components/zone/ZoneThemeWrapper";
import logoImg from "@/assets/m2-logo-official.png";

// Lazy-load heavy tab content
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

type TabKey = "lifts" | "generate" | "train" | "home";

const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "lifts", label: "Lifts", icon: BarChart3 },
  { key: "generate", label: "Generate", icon: Sparkles },
  { key: "train", label: "Train", icon: Dumbbell },
  { key: "home", label: "Home", icon: Home },
];

const TAB_STORAGE_KEY = "zone-dash-tab";

const cardStyle = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.08)",
};

/* ── Stat Card ────────────────────────────────── */
const StatCard = ({ label, value, unit }: { label: string; value: string | number; unit?: string }) => (
  <div className="rounded-2xl p-4 text-center" style={cardStyle}>
    <p className="text-2xl font-black" style={{ color: "#fafafa" }}>{value}</p>
    <p className="text-[10px] font-medium uppercase tracking-wider mt-1" style={{ color: "#737373" }}>{label}</p>
    {unit && <p className="text-[10px]" style={{ color: "#525252" }}>{unit}</p>}
  </div>
);

/* ── Tab Loader ──────────────────────────────── */
const TabLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-6 h-6 rounded-full animate-spin" style={{ border: "2px solid #f97316", borderTopColor: "transparent" }} />
  </div>
);

/* ── Generate Tab Content ────────────────────── */
const GenerateTab = memo(() => {
  const [view, setView] = useState<"menu" | "workout" | "fixit">("menu");

  if (view === "workout") {
    return (
      <Suspense fallback={<TabLoader />}>
        <div className="space-y-3">
          <button onClick={() => setView("menu")} className="text-xs font-medium transition-colors" style={{ color: "#737373" }}>
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
          <button onClick={() => setView("menu")} className="text-xs font-medium transition-colors" style={{ color: "#737373" }}>
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
          className="rounded-2xl p-5 text-left transition-all active:scale-[0.96]"
          style={{ ...cardStyle, borderColor: "rgba(168,85,247,0.15)" }}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)" }}>
            <Brain size={24} style={{ color: "#fff" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "#fafafa" }}>Smart Workout</p>
          <p className="text-[10px] mt-0.5" style={{ color: "#737373" }}>AI-powered training</p>
        </button>

        <button
          onClick={() => setView("fixit")}
          className="rounded-2xl p-5 text-left transition-all active:scale-[0.96]"
          style={{ ...cardStyle, borderColor: "rgba(0,240,255,0.15)" }}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg, #00f0ff, #0891b2)" }}>
            <Wrench size={24} style={{ color: "#fff" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "#fafafa" }}>Fix It Protocol</p>
          <p className="text-[10px] mt-0.5" style={{ color: "#737373" }}>Corrective exercise</p>
        </button>
      </div>

      {/* Timer auto-config callout */}
      <div className="rounded-2xl p-4 flex items-start gap-3" style={{ ...cardStyle, borderLeft: "2px solid #00f0ff" }}>
        <Timer size={18} style={{ color: "#00f0ff", marginTop: 2, flexShrink: 0 }} />
        <div>
          <p className="text-xs font-bold" style={{ color: "#00f0ff" }}>⚡ Auto-Timer</p>
          <p className="text-[11px] leading-relaxed mt-1" style={{ color: "#737373" }}>
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
        className="w-full flex items-center gap-4 rounded-2xl p-5 transition-all active:scale-[0.98]"
        style={cardStyle}
      >
        <div className="relative">
          <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "rgba(249,115,22,0.15)" }}>
            <MessageCircle size={20} style={{ color: "#f97316" }} />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full animate-pulse" style={{ background: "#22c55e", border: "2px solid #0a0a0a" }} />
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#fafafa" }}>Message Coach Matt</p>
          <p className="text-xs" style={{ color: "#737373" }}>Usually replies within 2 hours</p>
        </div>
        <div className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
          Available
        </div>
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

/* ── Main Page ───────────────────────────────── */
const ZoneDashboard = () => {
  const { user, subscriptionTier } = useAuth();
  const tierLabel = subscriptionTier ? subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1) : "Member";
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    return (safeLocalStorage.getItem(TAB_STORAGE_KEY) as TabKey) || "lifts";
  });

  const [streak, setStreak] = useState(0);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [currentProgram, setCurrentProgram] = useState("—");
  const [displayName, setDisplayName] = useState("Athlete");

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const { data: prof } = await supabase.from("profiles").select("athlete_name, full_name").eq("id", user.id).maybeSingle();
      if (prof?.athlete_name || prof?.full_name) setDisplayName(prof.athlete_name || prof.full_name || "Athlete");

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count } = await supabase
        .from("progress_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("logged_at", weekAgo.toISOString());
      setSessionsThisWeek(count || 0);

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
          if (prev.toISOString().slice(0, 10) === curr.toISOString().slice(0, 10)) s++;
          else break;
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

  const actions = [
    { label: "Workout Portal", icon: Dumbbell, accent: "#00f0ff", onClick: () => window.dispatchEvent(new CustomEvent("open-workout-zone")) },
    { label: "AI Generator", icon: Brain, accent: "#a855f7", onClick: () => handleTabChange("generate") },
    { label: "Fix It Engine", icon: Wrench, accent: "#00f0ff", onClick: () => handleTabChange("generate") },
    { label: "Submit PR", icon: Trophy, accent: "#f97316", onClick: () => window.dispatchEvent(new Event("open-prove-it-zone")) },
  ];

  return (
    <ZoneThemeWrapper className="min-h-screen pb-24" style={{ background: "#0a0a0a", color: "#e5e5e5" }}>
      {/* ── Zone Header ─────────────────────────── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-5 py-4"
        style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="M²" className="h-8 w-8 rounded-lg object-contain" />
          <div>
            <p className="text-xs font-medium" style={{ color: "#737373" }}>THE ZONE</p>
            <p className="text-sm font-semibold" style={{ color: "#fafafa" }}>{displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
          <span className="text-xs" style={{ color: "#737373" }}>{tierLabel}</span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pb-4 pt-6 space-y-5">
        {/* ── Quick Stats ──────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Streak" value={`${streak}d`} unit="days" />
          <StatCard label="This Week" value={sessionsThisWeek} unit="sessions" />
          <StatCard label="Program" value={currentProgram} />
        </div>

        {/* ── Action Grid 2x2 ─────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="rounded-2xl p-5 text-left transition-all active:scale-[0.96]"
              style={{ ...cardStyle, borderColor: `${a.accent}22` }}
            >
              <a.icon size={24} style={{ color: a.accent }} className="mb-3" />
              <p className="text-sm font-semibold" style={{ color: "#fafafa" }}>{a.label}</p>
            </button>
          ))}
        </div>

        {/* ── Tab Pills ───────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all shrink-0"
              style={
                activeTab === key
                  ? { background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", boxShadow: "0 0 20px rgba(249,115,22,0.25)" }
                  : { ...cardStyle, color: "#737373" }
              }
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
            className="w-full rounded-2xl p-3.5 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest animate-pulse"
            style={{ ...cardStyle, borderColor: "rgba(249,115,22,0.3)", color: "#f97316" }}
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
                <div
                  className="relative rounded-2xl p-[1px] overflow-hidden mb-4"
                  style={{ background: "linear-gradient(135deg, #f97316, #00f0ff, #a855f7)" }}
                >
                  <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: "#0a0a0a" }}>
                    <div>
                      <p className="text-lg font-black" style={{ color: "#fafafa" }}>Log a Lift</p>
                      <p className="text-[10px]" style={{ color: "#737373" }}>Track your progress. Own every rep.</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f97316, #00f0ff)" }}>
                      <BarChart3 size={20} style={{ color: "#fff" }} />
                    </div>
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
      </main>
    </ZoneThemeWrapper>
  );
};

export default ZoneDashboard;
