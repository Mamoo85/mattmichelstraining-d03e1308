import { useState, lazy, Suspense, memo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Search, HelpCircle, X, Loader2, Dumbbell, MessageSquare,
  BarChart3, Wand2, Headphones, Camera, ChevronRight,
  Zap, Send, Bot, Activity, Brain,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

/* ── Lazy-loaded sub-panels ── */
const AdminBatchGenerator = lazy(() => import("./AdminBatchGenerator"));
const AdminExerciseGenerator = lazy(() => import("./AdminExerciseGenerator"));
const AdminProgramCreator = lazy(() => import("./AdminProgramCreator"));
const AdminAiToolkit = lazy(() => import("./AdminAiToolkit"));
const AdminAiTimerGenerator = lazy(() => import("./AdminAiTimerGenerator"));
const AdminMonthlyFocus = lazy(() => import("./AdminMonthlyFocus"));
const AdminNewsletterComposer = lazy(() => import("./AdminNewsletterComposer"));
const AdminBroadcasts = lazy(() => import("./AdminBroadcasts"));
const AdminCoachAiQueue = lazy(() => import("./AdminCoachAiQueue"));
const AdminDirectMessages = lazy(() => import("./AdminDirectMessages"));
const AdminCmoReports = lazy(() => import("./AdminCmoReports"));
const AdminChurnRadar = lazy(() => import("./AdminChurnRadar"));
const AdminAiBusinessTools = lazy(() => import("./AdminAiBusinessTools"));
const AdminRecoveryHeatmap = lazy(() => import("./AdminRecoveryHeatmap"));
const AdminBiomechanics = lazy(() => import("./AdminBiomechanics"));
const AdminSeoGenerator = lazy(() => import("./AdminSeoGenerator"));
const AdminContentGenerator = lazy(() => import("./AdminContentGenerator"));
const AdminGbpPosts = lazy(() => import("./AdminGbpPosts"));
const AdminInstagramPosts = lazy(() => import("./AdminInstagramPosts"));
const AdminMarketingDrafts = lazy(() => import("./AdminMarketingDrafts"));
const AdminSupportCopilot = lazy(() => import("./AdminSupportCopilot"));
const AdminParentReports = lazy(() => import("./AdminParentReports"));
const AdminAiQueue = lazy(() => import("./AdminAiQueue"));
const AdminMediaVault = lazy(() => import("./AdminMediaVault"));

const Loader = () => (
  <div className="flex justify-center py-10">
    <Loader2 size={18} className="animate-spin" style={{ color: "#f97316" }} />
  </div>
);

/* ── Category definitions with contextual suggestions ── */
const CATEGORIES = [
  {
    key: "train",
    label: "Train",
    icon: Dumbbell,
    color: "#f97316",
    desc: "Workouts · Programs · Exercises · Timers",
    suggestions: [
      "Generate a 4-week beginner strength program",
      "Create a speed & agility workout for baseball",
      "Build a deload week template",
      "Generate 10 new exercise library entries",
    ],
    panels: [
      { key: "ai-workouts", label: "AI Workout Generator" },
      { key: "ai-exercises", label: "AI Exercise Builder" },
      { key: "ai-programs", label: "AI Program Creator" },
      { key: "ai-toolkit", label: "AI Toolkit" },
      { key: "ai-timer", label: "AI Timer Generator" },
      { key: "monthly-focus", label: "Monthly Focus" },
    ],
  },
  {
    key: "communicate",
    label: "Communicate",
    icon: MessageSquare,
    color: "#3b82f6",
    desc: "Emails · Newsletters · Coach AI · DMs",
    suggestions: [
      "Draft this week's newsletter about recovery",
      "Write a re-engagement email for inactive users",
      "Compose a parent update template",
      "Draft a welcome message for new members",
    ],
    panels: [
      { key: "compose", label: "Newsletter Composer" },
      { key: "broadcasts", label: "Broadcasts" },
      { key: "coach-ai", label: "Coach AI Queue", badge: true },
      { key: "messages", label: "Direct Messages" },
    ],
  },
  {
    key: "analyze",
    label: "Analyze",
    icon: BarChart3,
    color: "#10b981",
    desc: "CMO Reports · Churn · BI · Recovery",
    suggestions: [
      "Show me the last 20 user actions",
      "Which users are at risk of churning?",
      "Run a CMO intelligence report",
      "What are the top 5 most active users this week?",
    ],
    panels: [
      { key: "cmo", label: "CMO Intelligence" },
      { key: "churn", label: "Churn Radar" },
      { key: "bi-tools", label: "Business Intelligence" },
      { key: "recovery", label: "Recovery Heatmap" },
      { key: "biomechanics", label: "Biomechanics Lab" },
    ],
  },
  {
    key: "create",
    label: "Create",
    icon: Wand2,
    color: "#a855f7",
    desc: "SEO · Social Posts · Marketing Content",
    suggestions: [
      "Create SEO content for youth training",
      "Generate 4 Google Business posts",
      "Write an Instagram caption about deadlifts",
      "Draft a marketing ad for summer programs",
    ],
    panels: [
      { key: "seo-engine", label: "SEO Engine" },
      { key: "content-gen", label: "Content Generator" },
      { key: "gbp", label: "Google Business Posts" },
      { key: "instagram", label: "Instagram Content" },
      { key: "marketing-drafts", label: "Marketing Drafts" },
    ],
  },
  {
    key: "support",
    label: "Support",
    icon: Headphones,
    color: "#06b6d4",
    desc: "Triage · Parent Reports · AI Queue",
    suggestions: [
      "How many support items are pending?",
      "Show me unreviewed AI drafts",
      "Generate a parent progress report",
      "What coach replies need review?",
    ],
    panels: [
      { key: "support-copilot", label: "Support Copilot" },
      { key: "parent-reports", label: "Parent Reports" },
      { key: "ai-queue", label: "AI Approval Queue", badge: true },
    ],
  },
  {
    key: "media",
    label: "Media",
    icon: Camera,
    color: "#ec4899",
    desc: "Photos · Videos · Graphics · Studio",
    suggestions: [
      "How many media files are uploaded?",
      "What video content should I create next?",
      "Suggest social media content ideas",
      "What types of graphics perform best?",
    ],
    panels: [
      { key: "media-vault", label: "Media Vault" },
      { key: "ai-studio", label: "AI Media Studio" },
    ],
  },
];

/* ── Badge counts ── */
const useBadgeCounts = () => {
  const { data } = useQuery({
    queryKey: ["ai-cmd-badges"],
    queryFn: async () => {
      const [ai, coach] = await Promise.all([
        supabase.from("ai_action_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("coach_ai_drafts").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return { aiQueue: ai.count ?? 0, coachQueue: coach.count ?? 0 };
    },
    refetchInterval: 30000,
  });
  return data ?? { aiQueue: 0, coachQueue: 0 };
};

/* ── Panel Renderer ── */
const PanelRenderer = memo(({ panelKey }: { panelKey: string }) => {
  const map: Record<string, React.ReactNode> = {
    "ai-workouts": <AdminBatchGenerator />,
    "ai-exercises": <AdminExerciseGenerator />,
    "ai-programs": <AdminProgramCreator />,
    "ai-toolkit": <AdminAiToolkit />,
    "ai-timer": <AdminAiTimerGenerator />,
    "monthly-focus": <AdminMonthlyFocus />,
    compose: <AdminNewsletterComposer />,
    broadcasts: <AdminBroadcasts />,
    "coach-ai": <AdminCoachAiQueue />,
    messages: <AdminDirectMessages />,
    cmo: <AdminCmoReports />,
    churn: <AdminChurnRadar />,
    "bi-tools": <AdminAiBusinessTools />,
    recovery: <AdminRecoveryHeatmap />,
    biomechanics: <AdminBiomechanics />,
    "seo-engine": <AdminSeoGenerator />,
    "content-gen": <AdminContentGenerator />,
    gbp: <AdminGbpPosts />,
    instagram: <AdminInstagramPosts />,
    "marketing-drafts": <AdminMarketingDrafts />,
    "support-copilot": <AdminSupportCopilot />,
    "parent-reports": <AdminParentReports />,
    "ai-queue": <AdminAiQueue />,
    "media-vault": <AdminMediaVault />,
    "ai-studio": <AdminMediaVault />,
  };
  return <Suspense fallback={<Loader />}>{map[panelKey] || <p className="text-neutral-500 text-xs p-4">Panel not found</p>}</Suspense>;
});
PanelRenderer.displayName = "PanelRenderer";

/* ── Category Card ── */
const CategoryCard = memo(({ cat, isExpanded, onToggle, activePanel, onPanelSelect, badges }: {
  cat: typeof CATEGORIES[0];
  isExpanded: boolean;
  onToggle: () => void;
  activePanel: string | null;
  onPanelSelect: (k: string) => void;
  badges: { aiQueue: number; coachQueue: number };
}) => {
  const Icon = cat.icon;
  const totalBadge = cat.key === "support" ? badges.aiQueue : cat.key === "communicate" ? badges.coachQueue : 0;

  return (
    <div
      className="overflow-hidden transition-all"
      style={{
        background: isExpanded ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isExpanded ? cat.color + "40" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 20,
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3.5 px-4 py-4 transition active:scale-[0.98]"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: cat.color + "18" }}>
          <Icon size={20} style={{ color: cat.color }} />
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{cat.label}</span>
            {totalBadge > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">{totalBadge}</span>
            )}
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: "#737373" }}>{cat.desc}</p>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight size={16} className="text-neutral-500" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="pt-2" />
              {cat.panels.map((p) => (
                <button
                  key={p.key}
                  onClick={() => onPanelSelect(p.key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition"
                  style={{
                    background: activePanel === p.key ? cat.color + "15" : "transparent",
                    border: activePanel === p.key ? `1px solid ${cat.color}30` : "1px solid transparent",
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: activePanel === p.key ? cat.color : "#404040" }} />
                  <span className="text-xs font-medium" style={{ color: activePanel === p.key ? "#e5e5e5" : "#a3a3a3" }}>{p.label}</span>
                  {p.badge && (
                    (cat.key === "communicate" && badges.coachQueue > 0) ||
                    (cat.key === "support" && badges.aiQueue > 0)
                  ) && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
                      {cat.key === "communicate" ? badges.coachQueue : badges.aiQueue}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
CategoryCard.displayName = "CategoryCard";

/* ════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════ */
const AdminAiCommandCenter = () => {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const badges = useBadgeCounts();

  // Get suggestions based on expanded category
  const currentSuggestions = expandedCat
    ? CATEGORIES.find(c => c.key === expandedCat)?.suggestions || []
    : [
        "Show me the last 20 user actions",
        "Which users are at risk of churning?",
        "How many active subscribers do we have?",
        "What coach replies need review?",
      ];

  const handlePanelSelect = useCallback((panelKey: string) => {
    setActivePanel(prev => prev === panelKey ? null : panelKey);
    setAiResponse("");
    setAiError(null);
  }, []);

  const handleAiQuery = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setAiLoading(true);
    setAiResponse("");
    setAiError(null);
    setShowSuggestions(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated — please log in.");
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-admin-assist`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            type: "general_query",
            context: { query },
          }),
        }
      );

      if (!resp.ok) {
        let errMsg = "AI service error";
        try {
          const errData = await resp.json();
          errMsg = errData.error || errMsg;
        } catch { /* ignore */ }
        if (resp.status === 429) errMsg = "Rate limited — please try again in a moment.";
        if (resp.status === 402) errMsg = "AI credits needed — please add credits in workspace settings.";
        throw new Error(errMsg);
      }

      const data = await resp.json();
      setAiResponse(data.result || "No response generated.");
    } catch (e: any) {
      const msg = e.message || "Unknown error";
      setAiError(msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      handleAiQuery(searchQuery.trim());
    }
  }, [searchQuery, handleAiQuery]);

  return (
    <div className="space-y-4">
      {/* ── Hero Header ── */}
      <div
        className="relative"
        style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(168,85,247,0.05) 100%)",
          border: "1px solid rgba(249,115,22,0.15)",
          borderRadius: 20,
          padding: "20px 16px 16px",
        }}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(249,115,22,0.15)" }}>
            <Bot size={20} style={{ color: "#f97316" }} />
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-tight">AI Command Center</h2>
            <p className="text-[10px]" style={{ color: "#737373" }}>Ask anything. Get real answers with live data.</p>
          </div>
        </div>

        {/* ── Search bar ── */}
        <div className="relative">
          <div
            className="flex items-center gap-2"
            style={{
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "10px 14px",
            }}
          >
            <Search size={14} className="text-neutral-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              placeholder="Ask AI anything about your business..."
              className="flex-1 bg-transparent text-xs text-white placeholder:text-neutral-500 outline-none"
              disabled={aiLoading}
            />
            {aiLoading ? (
              <Loader2 size={14} className="animate-spin shrink-0" style={{ color: "#f97316" }} />
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!searchQuery.trim()}
                className="w-7 h-7 rounded-full flex items-center justify-center transition active:scale-90 shrink-0 disabled:opacity-30"
                style={{ background: "rgba(249,115,22,0.25)", border: "1px solid rgba(249,115,22,0.4)" }}
              >
                <Send size={12} style={{ color: "#f97316" }} />
              </button>
            )}
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="relative w-7 h-7 rounded-full flex items-center justify-center transition active:scale-90"
              style={{
                background: showSuggestions ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.06)",
                border: showSuggestions ? "1px solid rgba(249,115,22,0.4)" : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <HelpCircle size={13} style={{ color: showSuggestions ? "#f97316" : "#737373" }} />
            </button>
          </div>

          {/* ── Suggestions popup ── */}
          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 top-full mt-2 z-50 w-72 overflow-hidden"
                style={{
                  background: "#1a1a1a",
                  border: "1px solid rgba(249,115,22,0.25)",
                  borderRadius: 16,
                  boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
                }}
              >
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-2">
                    <Brain size={14} style={{ color: "#f97316" }} />
                    <span className="text-xs font-bold text-white tracking-wide">
                      {expandedCat ? `${CATEGORIES.find(c => c.key === expandedCat)?.label} Ideas` : "Quick Queries"}
                    </span>
                  </div>
                  <button onClick={() => setShowSuggestions(false)} className="p-1 rounded-full hover:bg-white/10 transition">
                    <X size={14} className="text-neutral-400" />
                  </button>
                </div>
                <div className="p-2 space-y-0.5 max-h-80 overflow-y-auto">
                  {currentSuggestions.map((s, i) => (
                    <button
                      key={`${expandedCat}-${i}`}
                      onClick={() => {
                        setSearchQuery(s);
                        setShowSuggestions(false);
                        handleAiQuery(s);
                      }}
                      className="w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition hover:bg-white/5 active:scale-[0.98]"
                    >
                      <Zap size={12} className="mt-0.5 shrink-0" style={{ color: "#f97316" }} />
                      <span className="text-[11px] leading-snug text-neutral-300">{s}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── AI Response Area ── */}
      <AnimatePresence>
        {(aiLoading || aiResponse || aiError) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: aiError ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(249,115,22,0.2)",
              borderRadius: 20,
              padding: 16,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(249,115,22,0.15)" }}>
                {aiLoading ? (
                  <Loader2 size={12} className="animate-spin" style={{ color: "#f97316" }} />
                ) : (
                  <Sparkles size={12} style={{ color: "#f97316" }} />
                )}
              </div>
              <span className="text-xs font-bold text-white">
                {aiLoading ? "Thinking..." : aiError ? "Error" : "AI Response"}
              </span>
              {aiResponse && (
                <button
                  onClick={() => { setAiResponse(""); setAiError(null); }}
                  className="ml-auto p-1 rounded-full hover:bg-white/10 transition"
                >
                  <X size={12} className="text-neutral-400" />
                </button>
              )}
            </div>

            {aiLoading && (
              <div className="space-y-2">
                <div className="h-3 rounded-full bg-white/5 animate-pulse w-3/4" />
                <div className="h-3 rounded-full bg-white/5 animate-pulse w-1/2" />
                <div className="h-3 rounded-full bg-white/5 animate-pulse w-5/6" />
              </div>
            )}

            {aiError && (
              <p className="text-xs text-red-400">{aiError}</p>
            )}

            {aiResponse && (
              <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs [&_p]:text-xs [&_li]:text-xs [&_strong]:text-orange-400 [&_a]:text-cyan-400">
                <ReactMarkdown>{aiResponse}</ReactMarkdown>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Activity Pulse ── */}
      {(badges.aiQueue > 0 || badges.coachQueue > 0) && (
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: 14,
          }}
        >
          <Activity size={14} className="text-red-400 shrink-0 animate-pulse" />
          <p className="text-[11px] text-red-300">
            <span className="font-bold">{badges.aiQueue + badges.coachQueue}</span> AI items need your review
          </p>
          <button
            onClick={() => { setExpandedCat("support"); setActivePanel("ai-queue"); }}
            className="ml-auto text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg transition active:scale-95"
            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}
          >
            Review
          </button>
        </div>
      )}

      {/* ── Category Cards ── */}
      <div className="space-y-2">
        {CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat.key}
            cat={cat}
            isExpanded={expandedCat === cat.key}
            onToggle={() => {
              const newCat = expandedCat === cat.key ? null : cat.key;
              setExpandedCat(newCat);
              if (expandedCat === cat.key) setActivePanel(null);
            }}
            activePanel={activePanel}
            onPanelSelect={handlePanelSelect}
            badges={badges}
          />
        ))}
      </div>

      {/* ── Active Panel ── */}
      <AnimatePresence mode="wait">
        {activePanel && (
          <motion.div
            key={activePanel}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 20,
              padding: 16,
            }}
          >
            <PanelRenderer panelKey={activePanel} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminAiCommandCenter;
