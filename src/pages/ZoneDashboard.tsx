import { useState, useEffect, lazy, Suspense, memo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePoints, getLevelInfo } from "@/hooks/usePoints";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/browserStorage";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, Sparkles, Dumbbell, Home, Flame, Zap, Trophy, Play, Wrench,
  Timer, ChevronRight, ChevronDown, ChevronUp, MessageCircle, Brain,
  User, Share2, Activity, Eye, Scan, Send
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ZoneThemeWrapper from "@/components/zone/ZoneThemeWrapper";
import logoImg from "@/assets/m2-logo-official.jpg";

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

/* ── Pill Button ─────────────────────────────── */
const PillBtn = ({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) => (
  <button
    onClick={onClick}
    className="px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all active:scale-95"
    style={{
      background: color ? `${color}15` : "rgba(255,255,255,0.06)",
      border: `1px solid ${color ? `${color}30` : "rgba(255,255,255,0.1)"}`,
      color: color || "#a3a3a3",
    }}
  >
    {label}
  </button>
);

/* ── Hub Card ────────────────────────────────── */
const HubCard = ({
  icon: Icon, color, children
}: {
  icon: typeof Flame; color: string; children: React.ReactNode;
}) => (
  <div
    className="rounded-2xl px-4 py-3 flex items-center gap-3"
    style={{ ...cardStyle, borderLeft: `3px solid ${color}` }}
  >
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: `${color}18` }}
    >
      <Icon size={18} style={{ color }} />
    </div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

/* ── Tab Loader ──────────────────────────────── */
const TabLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-6 h-6 rounded-full animate-spin" style={{ border: "2px solid #f97316", borderTopColor: "transparent" }} />
  </div>
);

/* ── Collapsible Widget ──────────────────────── */
const CollapsibleWidget = ({
  title, icon: Icon, color, isOpen, onToggle, children
}: {
  title: string; icon: typeof Flame; color: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) => (
  <div className="rounded-2xl overflow-hidden" style={cardStyle}>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 transition-colors"
    >
      <div className="flex items-center gap-2.5">
        <Icon size={16} style={{ color }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#d4d4d4" }}>{title}</span>
      </div>
      {isOpen
        ? <ChevronUp size={16} style={{ color: "#525252" }} />
        : <ChevronDown size={16} style={{ color: "#525252" }} />
      }
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="px-4 pb-4">
            <Suspense fallback={null}>{children}</Suspense>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

/* ── Generate Tab Content (with lifted state) ─ */
const GenerateTabContent = memo(({ view, setView }: { view: "menu" | "workout" | "fixit"; setView: (v: "menu" | "workout" | "fixit") => void }) => {
  if (view === "workout") {
    return (
      <Suspense fallback={<TabLoader />}>
        <div className="space-y-3">
          {/* Hero card */}
          <div className="relative rounded-2xl p-[1px] overflow-hidden" style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed, #f97316)" }}>
            <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: "#0a0a0a" }}>
              <div>
                <p className="text-lg font-black" style={{ color: "#fafafa" }}>Perfect Workout Generator</p>
                <p className="text-[10px]" style={{ color: "#737373" }}>AI builds your session + auto-configures your timer</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)" }}>
                <Brain size={20} style={{ color: "#fff" }} />
              </div>
            </div>
          </div>
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
          {/* Hero card */}
          <div className="relative rounded-2xl p-[1px] overflow-hidden" style={{ background: "linear-gradient(135deg, #00f0ff, #0891b2, #06b6d4)" }}>
            <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: "#0a0a0a" }}>
              <div>
                <p className="text-lg font-black" style={{ color: "#fafafa" }}>Fix It Engine</p>
                <p className="text-[10px]" style={{ color: "#737373" }}>Corrective protocols tailored to you</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00f0ff, #0891b2)" }}>
                <Wrench size={20} style={{ color: "#fff" }} />
              </div>
            </div>
          </div>
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
GenerateTabContent.displayName = "GenerateTabContent";

/* ── Home Tab Content ────────────────────────── */
const HomeTab = memo(() => {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="space-y-4">
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
   ── Main Page ──────────────────────────────────
   ═══════════════════════════════════════════════ */
const ZoneDashboard = () => {
  const { user, subscriptionTier } = useAuth();
  const { points, leaderboard } = usePoints();
  const navigate = useNavigate();
  const tierLabel = subscriptionTier ? subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1) : "Member";

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    return (safeLocalStorage.getItem(TAB_STORAGE_KEY) as TabKey) || "lifts";
  });
  const [generateView, setGenerateView] = useState<"menu" | "workout" | "fixit">("menu");
  const [focusOpen, setFocusOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);

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

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    safeLocalStorage.setItem(TAB_STORAGE_KEY, tab);
  }, []);

  const handleActionClick = useCallback((tab: TabKey, genView?: "workout" | "fixit") => {
    setActiveTab(tab);
    safeLocalStorage.setItem(TAB_STORAGE_KEY, tab);
    if (genView) setGenerateView(genView);
    else if (tab === "generate") setGenerateView("menu");
    setFocusOpen(false);
    setChallengeOpen(false);
  }, []);

  const levelInfo = getLevelInfo(points?.total_points || 0);

  const actions = [
    {
      label: "Compound Lifts", icon: BarChart3, accent: "#f97316",
      onClick: () => handleActionClick("lifts"),
    },
    {
      label: "Perfect Workout Generator", icon: Brain, accent: "#a855f7",
      onClick: () => handleActionClick("generate", "workout"),
    },
    {
      label: "Fix It Engine", icon: Wrench, accent: "#00f0ff",
      onClick: () => handleActionClick("generate", "fixit"),
    },
    {
      label: "Workouts & Programs", icon: Dumbbell, accent: "#f97316",
      onClick: () => handleActionClick("train"),
    },
  ];

  return (
    <ZoneThemeWrapper className="min-h-screen pb-24" style={{ background: "#0a0a0a", color: "#e5e5e5" }}>
      {/* ── Zone Header ─────────────────────────── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-5 py-3"
        style={{ background: "rgba(10,10,10,0.88)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="M²" className="h-9 w-9 rounded-xl object-cover" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#f97316" }}>THE ZONE</p>
            <p className="text-sm font-semibold" style={{ color: "#fafafa" }}>{displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
          <span className="text-[10px] font-medium" style={{ color: "#737373" }}>{tierLabel}</span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pb-4 pt-5 space-y-4">

        {/* ═══ 3 RICH INFO HUBS ═══════════════════ */}

        {/* Hub 1: My Stats */}
        <HubCard icon={Flame} color="#f97316">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black" style={{ color: "#fafafa" }}>🔥 {streak}d</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#f9731618", color: "#f97316" }}>
                  {points?.total_points || 0} pts
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: "#f9731610", color: "#fb923c" }}>
                  {levelInfo.label}
                </span>
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: "#525252" }}>{sessionsThisWeek} sessions this week</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <PillBtn label="Profile" onClick={() => navigate("/profile")} color="#f97316" />
              <PillBtn label="Refer" onClick={() => navigate("/dashboard")} color="#f97316" />
            </div>
          </div>
        </HubCard>

        {/* Hub 2: AI Insights */}
        <HubCard icon={Activity} color="#a855f7">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: "#e5e5e5" }}>{currentProgram}</p>
              <p className="text-[10px]" style={{ color: "#525252" }}>Active Program</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <PillBtn label="Recovery" onClick={() => handleActionClick("lifts")} color="#a855f7" />
              <PillBtn label="Insights" onClick={() => handleActionClick("lifts")} color="#a855f7" />
              <PillBtn label="Avatar" onClick={() => handleActionClick("lifts")} color="#a855f7" />
            </div>
          </div>
        </HubCard>

        {/* Hub 3: Quick Launch */}
        <HubCard icon={Zap} color="#00f0ff">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                <span className="text-xs font-semibold" style={{ color: "#d4d4d4" }}>Coach Matt</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
                Available
              </span>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <PillBtn label="Timer" onClick={() => navigate("/timer")} color="#00f0ff" />
              <PillBtn label="Chat" onClick={() => handleActionClick("home")} color="#00f0ff" />
              <PillBtn label="PR" onClick={() => window.dispatchEvent(new Event("open-prove-it-zone"))} color="#f97316" />
            </div>
          </div>
        </HubCard>

        {/* ═══ 2×2 ACTION GRID ═══════════════════ */}
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="rounded-2xl p-4 text-left transition-all active:scale-[0.96]"
              style={{ ...cardStyle, borderColor: `${a.accent}22` }}
            >
              <a.icon size={22} style={{ color: a.accent }} className="mb-2" />
              <p className="text-xs font-bold leading-tight" style={{ color: "#fafafa" }}>{a.label}</p>
            </button>
          ))}
        </div>

        {/* ═══ COLLAPSIBLE WIDGETS ════════════════ */}
        <CollapsibleWidget
          title="Monthly Focus"
          icon={Flame}
          color="#f97316"
          isOpen={focusOpen}
          onToggle={() => setFocusOpen(v => !v)}
        >
          <MonthlyFocusWidget />
        </CollapsibleWidget>

        <CollapsibleWidget
          title="Challenge"
          icon={Trophy}
          color="#a855f7"
          isOpen={challengeOpen}
          onToggle={() => setChallengeOpen(v => !v)}
        >
          <DashboardChallengePreview onViewChallenge={() => {}} />
        </CollapsibleWidget>

        {/* ═══ TAB PILLS ═════════════════════════ */}
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

        {/* ═══ TAB CONTENT ═══════════════════════ */}
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
                {/* Inline Submit PR */}
                <div className="flex justify-end mb-3">
                  <button
                    onClick={() => window.dispatchEvent(new Event("open-prove-it-zone"))}
                    className="text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    style={{ color: "#f97316" }}
                  >
                    🏆 Submit a PR <ChevronRight size={12} />
                  </button>
                </div>
                <ProgressCharts />
              </Suspense>
            )}

            {activeTab === "generate" && <GenerateTabContent view={generateView} setView={setGenerateView} />}

            {activeTab === "train" && (
              <Suspense fallback={<TabLoader />}>
                <div className="space-y-4">
                  {/* Hero card */}
                  <div className="relative rounded-2xl p-[1px] overflow-hidden" style={{ background: "linear-gradient(135deg, #f97316, #ea580c, #fb923c)" }}>
                    <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: "#0a0a0a" }}>
                      <div>
                        <p className="text-lg font-black" style={{ color: "#fafafa" }}>Your Library</p>
                        <p className="text-[10px]" style={{ color: "#737373" }}>Workouts, programs & today's training</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
                        <Dumbbell size={20} style={{ color: "#fff" }} />
                      </div>
                    </div>
                  </div>
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
