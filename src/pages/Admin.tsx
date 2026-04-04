import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { Navigate } from "react-router-dom";
import AppNavbar from "@/components/layout/AppNavbar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Users, Dumbbell, DollarSign, Megaphone, Globe,
  Activity, AlertTriangle, CheckCircle, Mail, Zap, Search,
  ChevronRight, X, ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

/* ── Lazy-load ALL admin sub-components ─────────────────────────────────────── */
const AdminAiBar = lazy(() => import("@/components/admin/AdminAiBar"));

// Training domain
const AdminPrograms           = lazy(() => import("@/components/admin/AdminPrograms"));
const AdminExerciseLibrary    = lazy(() => import("@/components/admin/AdminExerciseLibrary"));
const AdminWorkoutInventory   = lazy(() => import("@/components/admin/AdminWorkoutInventory"));
const AdminBatchGenerator     = lazy(() => import("@/components/admin/AdminBatchGenerator"));
const AdminExerciseGenerator  = lazy(() => import("@/components/admin/AdminExerciseGenerator"));
const AdminProgramCreator     = lazy(() => import("@/components/admin/AdminProgramCreator"));
const AdminAiQueue            = lazy(() => import("@/components/admin/AdminAiQueue"));
const AdminRecoveryHeatmap    = lazy(() => import("@/components/admin/AdminRecoveryHeatmap"));
const AdminMonthlyFocus       = lazy(() => import("@/components/admin/AdminMonthlyFocus"));
const AdminBiomechanics       = lazy(() => import("@/components/admin/AdminBiomechanics"));
const AdminAiToolkit          = lazy(() => import("@/components/admin/AdminAiToolkit"));
const AdminCoachAiQueue       = lazy(() => import("@/components/admin/AdminCoachAiQueue"));
const AdminCustomRequests     = lazy(() => import("@/components/admin/AdminCustomRequests"));
const AdminUserGeneratedWorkouts = lazy(() => import("@/components/admin/AdminUserGeneratedWorkouts"));
const AdminImageMatcher       = lazy(() => import("@/components/admin/AdminImageMatcher"));
const AdminProgressLogger     = lazy(() => import("@/components/admin/AdminProgressLogger"));
const AdminLiftVideoReview    = lazy(() => import("@/components/admin/AdminLiftVideoReview"));
const AdminProveItReview      = lazy(() => import("@/components/admin/AdminProveItReview"));

// People domain
const AdminClientList         = lazy(() => import("@/components/admin/AdminClientList"));
const AdminSupportCopilot     = lazy(() => import("@/components/admin/AdminSupportCopilot"));
const AdminFamilyManager      = lazy(() => import("@/components/admin/AdminFamilyManager"));
const AdminTeamRosters        = lazy(() => import("@/components/admin/AdminTeamRosters"));
const AdminCoachManager       = lazy(() => import("@/components/admin/AdminCoachManager"));
const AdminTeamSandbox        = lazy(() => import("@/components/admin/AdminTeamSandbox"));
const AdminParentReports      = lazy(() => import("@/components/admin/AdminParentReports"));
const AdminParentInbox        = lazy(() => import("@/components/admin/AdminParentInbox"));
const AdminCoachInbox         = lazy(() => import("@/components/admin/AdminCoachInbox"));
const AdminPostureRequests    = lazy(() => import("@/components/admin/AdminPostureRequests"));
const AdminCoachDashboard     = lazy(() => import("@/components/admin/AdminCoachDashboard"));
const AdminDirectMessages     = lazy(() => import("@/components/admin/AdminDirectMessages"));
const AdminVideoReview        = lazy(() => import("@/components/admin/AdminVideoReview"));
const AdminTrialSettings      = lazy(() => import("@/components/admin/AdminTrialSettings"));
const AdminClientOnboarding   = lazy(() => import("@/components/admin/AdminClientOnboarding"));
const AdminChurnRadar         = lazy(() => import("@/components/admin/AdminChurnRadar"));
const AdminSchedule           = lazy(() => import("@/components/admin/AdminSchedule"));
const AdminVipAccess          = lazy(() => import("@/components/admin/AdminVipAccess"));
const UserActivityFeed        = lazy(() => import("@/components/admin/UserActivityFeed"));

// Business & Ops domain
const AdminFinancials         = lazy(() => import("@/components/admin/AdminFinancials"));
const AdminPromotions         = lazy(() => import("@/components/admin/AdminPromotions"));
const AdminPointsManager      = lazy(() => import("@/components/admin/AdminPointsManager"));
const AdminTierManager        = lazy(() => import("@/components/admin/AdminTierManager"));
const AdminSystemSettings     = lazy(() => import("@/components/admin/AdminSystemSettings"));
const AdminStripeProducts     = lazy(() => import("@/components/admin/AdminStripeProducts"));
const AdminServiceCatalog     = lazy(() => import("@/components/admin/AdminServiceCatalog"));
const AdminGiftCards          = lazy(() => import("@/components/admin/AdminGiftCards"));
const AdminGuideStore         = lazy(() => import("@/components/admin/AdminGuideStore"));
const AdminAffiliateManager   = lazy(() => import("@/components/admin/AdminAffiliateManager"));
const AdminReferrals          = lazy(() => import("@/components/admin/AdminReferrals"));
const AdminLegalCompliance    = lazy(() => import("@/components/admin/AdminLegalCompliance"));
const AdminTrash              = lazy(() => import("@/components/admin/AdminTrash"));
const AdminFulfillment        = lazy(() => import("@/components/admin/AdminFulfillment"));
const AdminOrders             = lazy(() => import("@/components/admin/AdminOrders"));
const AdminOpsCenter          = lazy(() => import("@/components/admin/AdminOpsCenter"));
const AdminSandbox            = lazy(() => import("@/components/admin/AdminSandbox"));
const AdminBusinessDashboard  = lazy(() => import("@/components/admin/AdminBusinessDashboard"));
const AdminClientHealth       = lazy(() => import("@/components/admin/AdminClientHealth"));
const AdminEmailLog           = lazy(() => import("@/components/admin/AdminEmailLog"));
const AdminMigrations         = lazy(() => import("@/components/admin/AdminMigrations"));
const AdminB2BPipeline        = lazy(() => import("@/components/admin/AdminB2BPipeline"));
const AdminSocialMediaOnboarding = lazy(() => import("@/components/admin/AdminSocialMediaOnboarding"));

// Marketing & Content domain
const AdminFrontPage          = lazy(() => import("@/components/admin/AdminFrontPage"));
const AdminSiteEditor         = lazy(() => import("@/components/admin/AdminSiteEditor"));
const AdminTestimonials       = lazy(() => import("@/components/admin/AdminTestimonials"));
const AdminLearnEditor        = lazy(() => import("@/components/admin/AdminLearnEditor"));
const AdminBroadcasts         = lazy(() => import("@/components/admin/AdminBroadcasts"));
const AdminSubscriberList     = lazy(() => import("@/components/admin/AdminSubscriberList"));
const AdminNewsletterComposer = lazy(() => import("@/components/admin/AdminNewsletterComposer"));
const AdminSendHistory        = lazy(() => import("@/components/admin/AdminSendHistory"));
const AdminMarketingDrafts    = lazy(() => import("@/components/admin/AdminMarketingDrafts"));
const AdminAiBusinessTools    = lazy(() => import("@/components/admin/AdminAiBusinessTools"));
const AdminCmoReports         = lazy(() => import("@/components/admin/AdminCmoReports"));
const AdminMediaVault         = lazy(() => import("@/components/admin/AdminMediaVault"));
const AdminSeoGenerator       = lazy(() => import("@/components/admin/AdminSeoGenerator"));
const AdminTrainingNewsletter = lazy(() => import("@/components/admin/AdminTrainingNewsletter"));
const AdminM2GrowthHub        = lazy(() => import("@/components/admin/AdminM2GrowthHub"));
const AdminAdCampaigns        = lazy(() => import("@/components/admin/AdminAdCampaigns"));
const AdminOutreach           = lazy(() => import("@/components/admin/AdminOutreach"));
const AdminSeoPages           = lazy(() => import("@/components/admin/AdminSeoPages"));
const AdminSearchConsole      = lazy(() => import("@/components/admin/AdminSearchConsole"));
const AdminGbpPosts           = lazy(() => import("@/components/admin/AdminGbpPosts"));
const AdminInstagramPosts     = lazy(() => import("@/components/admin/AdminInstagramPosts"));
const AdminContentGenerator   = lazy(() => import("@/components/admin/AdminContentGenerator"));

// Agency domain
const AdminWebDesignCRM       = lazy(() => import("@/components/admin/AdminWebDesignCRM"));
const AdminAgencyCRM          = lazy(() => import("@/components/admin/AdminAgencyCRM"));
const AdminDemoLinkGenerator  = lazy(() => import("@/components/admin/AdminDemoLinkGenerator"));
const AdminProspector         = lazy(() => import("@/components/admin/AdminProspector"));
const AdminAutomationHub      = lazy(() => import("@/components/admin/AdminAutomationHub"));
const AdminSiteBuilder        = lazy(() => import("@/components/admin/AdminSiteBuilder"));
const AdminWebDesignAutomations = lazy(() => import("@/components/admin/AdminWebDesignAutomations"));

// Command Deck
const AdminCommandDeck        = lazy(() => import("@/components/admin/AdminCommandDeck"));

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface Tool {
  key: string;
  label: string;
  component: React.ReactNode;
  badge?: number;
}

interface Domain {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  tools: Tool[];
}

/* ── Loader ─────────────────────────────────────────────────────────────────── */
const TabLoader = () => (
  <div className="flex justify-center py-12">
    <Loader2 size={20} className="text-primary animate-spin" />
  </div>
);

/* ── Agent Status Card ──────────────────────────────────────────────────────── */
const AgentCard = ({ name, role, status, color }: { name: string; role: string; status: "online" | "scheduled" | "idle"; color: string }) => (
  <div
    className="flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all hover:scale-[1.02]"
    style={{
      background: `${color}08`,
      borderColor: `${color}20`,
    }}
  >
    <div
      className={`w-2 h-2 rounded-full shrink-0 ${status === "online" ? "animate-pulse" : ""}`}
      style={{ background: status === "online" ? "#22c55e" : status === "scheduled" ? "#f59e0b" : "#6b7280" }}
    />
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-bold text-foreground truncate">{name}</p>
      <p className="text-[9px] text-muted-foreground truncate">{role}</p>
    </div>
  </div>
);

/* ── Main Admin Component ───────────────────────────────────────────────────── */
const Admin = () => {
  const [activeTool, setActiveTool] = useState<string>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [testEmailState, setTestEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const { isAdmin, isLoading } = useIsAdmin();

  /* Cross-component navigation events */
  useEffect(() => {
    const handleNavigateAdmin = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        const toolMap: Record<string, string> = {
          command: "command-deck", business: "biz-overview",
          roster: "athletes", engine: "programs",
          vault: "revenue", content: "front-page",
          growth: "m2-hub", webdesign: "agency-crm", ai: "command-deck",
        };
        setActiveTool(toolMap[detail] || detail);
      }
    };
    window.addEventListener("navigate-admin", handleNavigateAdmin);
    return () => window.removeEventListener("navigate-admin", handleNavigateAdmin);
  }, []);

  /* Cmd+K shortcut */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("admin-search")?.focus();
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        setSearchFocused(false);
        (document.activeElement as HTMLElement)?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ── Badge counts (30s polling) ──────────────────────────────────────────── */
  const { data: badges } = useQuery({
    queryKey: ["admin-badge-counts"],
    queryFn: async () => {
      const [aiQueue, support, drafts, posture, custom, liftVideos, proveIt, trash] = await Promise.all([
        supabase.from("ai_action_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("coach_ai_drafts").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("posture_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("custom_program_requests" as any).select("id", { count: "exact", head: true }).in("status", ["pending", "ready_for_review"]),
        supabase.from("lift_videos" as any).select("id", { count: "exact", head: true }).eq("status", "pending_review"),
        supabase.from("pr_submissions" as any).select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("admin_trash" as any).select("id", { count: "exact", head: true }),
      ]);
      return {
        aiQueue: aiQueue.count ?? 0,
        support: support.count ?? 0,
        drafts: drafts.count ?? 0,
        posture: posture.count ?? 0,
        custom: custom.count ?? 0,
        liftVideos: liftVideos.count ?? 0,
        proveIt: proveIt.count ?? 0,
        trash: trash.count ?? 0,
      };
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const b = badges ?? { aiQueue: 0, support: 0, drafts: 0, posture: 0, custom: 0, liftVideos: 0, proveIt: 0, trash: 0 };

  /* ── Domain definitions ──────────────────────────────────────────────────── */
  const domains: Domain[] = useMemo(() => [
    {
      key: "actions",
      label: "⚡ Quick Actions",
      icon: Zap,
      color: "#f97316",
      tools: [
        { key: "command-deck", label: "Command Deck", component: <AdminCommandDeck /> },
      ],
    },
    {
      key: "training",
      label: "Training",
      icon: Dumbbell,
      color: "#f97316",
      tools: [
        { key: "log-lifts", label: "📊 Log Lifts", component: <AdminProgressLogger /> },
        { key: "programs", label: "Programs", component: <AdminPrograms /> },
        { key: "exercises", label: "Exercise Library", component: <AdminExerciseLibrary /> },
        { key: "image-matcher", label: "Image Matcher", component: <AdminImageMatcher /> },
        { key: "workouts", label: "Workouts", component: <AdminWorkoutInventory /> },
        { key: "ai-workouts", label: "⚡ AI Workouts", component: <AdminBatchGenerator /> },
        { key: "user-generated", label: "User Generated", component: <AdminUserGeneratedWorkouts /> },
        { key: "ai-exercises", label: "⚡ AI Exercises", component: <AdminExerciseGenerator /> },
        { key: "ai-programs", label: "⚡ AI Programs", component: <AdminProgramCreator /> },
        { key: "ai-queue", label: "AI Queue", component: <AdminAiQueue />, badge: b.aiQueue },
        { key: "ai-toolkit", label: "AI Toolkit", component: <AdminAiToolkit /> },
        { key: "recovery", label: "Recovery Map", component: <AdminRecoveryHeatmap /> },
        { key: "monthly", label: "Monthly Focus", component: <AdminMonthlyFocus /> },
        { key: "biomechanics", label: "Biomechanics", component: <AdminBiomechanics /> },
        { key: "coach-ai", label: "Coach AI", component: <AdminCoachAiQueue />, badge: b.drafts },
        { key: "custom-req", label: "Custom Requests", component: <AdminCustomRequests />, badge: b.custom },
        { key: "lift-videos", label: "Lift Videos", component: <AdminLiftVideoReview />, badge: b.liftVideos },
        { key: "prove-it", label: "Prove It", component: <AdminProveItReview />, badge: b.proveIt },
      ],
    },
    {
      key: "people",
      label: "People",
      icon: Users,
      color: "#3b82f6",
      tools: [
        { key: "athletes", label: "👥 All Users", component: <AdminClientList /> },
        { key: "activity", label: "Activity Feed", component: <UserActivityFeed /> },
        { key: "support", label: "Support", component: <AdminSupportCopilot />, badge: b.support },
        { key: "coaching", label: "Coach Review", component: (
          <div className="space-y-8">
            <AdminCoachInbox />
            <div className="border-t border-border pt-6"><AdminCoachDashboard /></div>
            <div className="border-t border-border pt-6"><AdminPostureRequests /></div>
            <div className="border-t border-border pt-6"><AdminVideoReview /></div>
          </div>
        ), badge: b.posture },
        { key: "messages", label: "Messages", component: <AdminDirectMessages /> },
        { key: "families", label: "Families", component: <AdminFamilyManager /> },
        { key: "teams", label: "🏟️ Teams", component: (
          <div className="space-y-8">
            <AdminTeamSandbox />
            <div className="border-t border-border pt-6"><AdminCoachManager /></div>
            <div className="border-t border-border pt-6"><AdminTeamRosters /></div>
          </div>
        )},
        { key: "parents", label: "Parent Hub", component: (
          <div className="space-y-8">
            <AdminParentInbox />
            <div className="border-t border-border pt-6"><AdminParentReports /></div>
          </div>
        )},
        { key: "onboarding", label: "Onboarding", component: (
          <div className="space-y-8">
            <AdminClientOnboarding />
            <div className="border-t border-border pt-6"><AdminTrialSettings /></div>
          </div>
        )},
        { key: "churn", label: "Churn Radar", component: <AdminChurnRadar /> },
        { key: "schedule", label: "Schedule", component: <AdminSchedule /> },
        { key: "vip", label: "VIP Access", component: <AdminVipAccess /> },
      ],
    },
    {
      key: "business",
      label: "Business",
      icon: DollarSign,
      color: "#22c55e",
      tools: [
        { key: "biz-overview", label: "📊 Overview", component: <AdminBusinessDashboard /> },
        { key: "fulfillment", label: "🔔 Fulfillment", component: <AdminFulfillment /> },
        { key: "orders", label: "📦 Orders", component: <AdminOrders /> },
        { key: "ops", label: "Ops Center", component: <AdminOpsCenter /> },
        { key: "health", label: "Client Health", component: <AdminClientHealth /> },
        { key: "revenue", label: "Revenue & Ledger", component: <AdminFinancials /> },
        { key: "promotions", label: "Promotions", component: <AdminPromotions /> },
        { key: "points", label: "Points", component: <AdminPointsManager /> },
        { key: "tiers", label: "Tier Access", component: <AdminTierManager /> },
        { key: "stripe", label: "Stripe Products", component: <AdminStripeProducts /> },
        { key: "catalog", label: "Service Catalog", component: <AdminServiceCatalog /> },
        { key: "gift-cards", label: "Gift Cards", component: <AdminGiftCards /> },
        { key: "guides", label: "Playbooks Store", component: <AdminGuideStore /> },
        { key: "affiliates", label: "Affiliates", component: <AdminAffiliateManager /> },
        { key: "referrals", label: "Referrals", component: <AdminReferrals /> },
        { key: "pipeline", label: "B2B Pipeline", component: <AdminB2BPipeline /> },
        { key: "social-setup", label: "Social Setup", component: <AdminSocialMediaOnboarding /> },
        { key: "legal", label: "Legal", component: <AdminLegalCompliance /> },
        { key: "sandbox", label: "🧪 Sandbox", component: <AdminSandbox /> },
        { key: "email-log", label: "📧 Email Log", component: <AdminEmailLog /> },
        { key: "system", label: "System & Refs", component: <AdminSystemSettings /> },
        { key: "migrations", label: "DB Migrations", component: <AdminMigrations /> },
        { key: "trash", label: "🗑 Trash", component: <AdminTrash />, badge: b.trash },
      ],
    },
    {
      key: "marketing",
      label: "Marketing",
      icon: Megaphone,
      color: "#a855f7",
      tools: [
        { key: "m2-hub", label: "🚀 Growth Hub", component: <AdminM2GrowthHub /> },
        { key: "ad-campaigns", label: "⚡ Ad Campaigns", component: <AdminAdCampaigns /> },
        { key: "front-page", label: "Front Page", component: <AdminFrontPage /> },
        { key: "site", label: "Site Editor", component: <AdminSiteEditor /> },
        { key: "testimonials", label: "Testimonials", component: <AdminTestimonials /> },
        { key: "learn", label: "Learn Hub", component: <AdminLearnEditor /> },
        { key: "broadcasts", label: "Broadcasts", component: <AdminBroadcasts /> },
        { key: "subscribers", label: "Subscribers", component: <AdminSubscriberList /> },
        { key: "compose", label: "Newsletter", component: <AdminNewsletterComposer /> },
        { key: "training-newsletter", label: "Training Newsletter", component: <AdminTrainingNewsletter /> },
        { key: "history", label: "Send History", component: <AdminSendHistory /> },
        { key: "marketing-ai", label: "Marketing AI", component: (
          <div className="space-y-8">
            <AdminMarketingDrafts />
            <div className="border-t border-border pt-6"><AdminAiBusinessTools /></div>
          </div>
        )},
        { key: "cmo", label: "CMO Reports", component: <AdminCmoReports /> },
        { key: "media-vault", label: "Media Vault", component: <AdminMediaVault /> },
        { key: "seo", label: "SEO Engine", component: <AdminSeoGenerator /> },
        { key: "outreach", label: "Outreach", component: <AdminOutreach /> },
        { key: "seo-pages", label: "SEO Pages", component: <AdminSeoPages /> },
        { key: "search", label: "📊 Search Console", component: <AdminSearchConsole /> },
        { key: "gbp", label: "GBP Posts", component: <AdminGbpPosts /> },
        { key: "instagram", label: "Instagram", component: <AdminInstagramPosts /> },
        { key: "content-gen", label: "Content Generator", component: <AdminContentGenerator /> },
      ],
    },
    {
      key: "agency",
      label: "Agency",
      icon: Globe,
      color: "#06b6d4",
      tools: [
        { key: "agency-crm", label: "Agency CRM", component: <AdminAgencyCRM /> },
        { key: "crm", label: "Web Design CRM", component: <AdminWebDesignCRM /> },
        { key: "site-builder", label: "Site Builder", component: <AdminSiteBuilder /> },
        { key: "prospector", label: "Prospector", component: <AdminProspector /> },
        { key: "automation", label: "Automation Hub", component: <AdminAutomationHub /> },
        { key: "wd-automations", label: "Email Automations", component: <AdminWebDesignAutomations /> },
        { key: "demo-links", label: "🔗 Demo Links", component: <AdminDemoLinkGenerator /> },
      ],
    },
  ], [b]);

  /* ── Search filtering ────────────────────────────────────────────────────── */
  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: { tool: Tool; domain: Domain }[] = [];
    for (const d of domains) {
      for (const t of d.tools) {
        if (t.label.toLowerCase().includes(q) || t.key.toLowerCase().includes(q)) {
          results.push({ tool: t, domain: d });
        }
      }
    }
    return results.slice(0, 8);
  }, [searchQuery, domains]);

  /* ── Find active tool component ──────────────────────────────────────────── */
  const findTool = (key: string): Tool | undefined => {
    for (const d of domains) {
      const t = d.tools.find((t) => t.key === key);
      if (t) return t;
    }
    return undefined;
  };

  const findDomainForTool = (key: string): Domain | undefined => {
    return domains.find((d) => d.tools.some((t) => t.key === key));
  };

  const currentTool = findTool(activeTool);
  const currentDomain = findDomainForTool(activeTool);

  const sendTestEmail = async () => {
    setTestEmailState("sending");
    try {
      const { error } = await supabase.functions.invoke("send-test-email");
      setTestEmailState(error ? "error" : "sent");
      setTimeout(() => setTestEmailState("idle"), 5000);
    } catch {
      setTestEmailState("error");
      setTimeout(() => setTestEmailState("idle"), 5000);
    }
  };

  const handleToolClick = (toolKey: string) => {
    setActiveTool(toolKey);
    setSearchQuery("");
    setSearchFocused(false);
    setExpandedDomain(null);
  };

  const totalPending = b.aiQueue + b.support + b.drafts + b.posture + b.custom + b.liftVideos + b.proveIt;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />

      <div className="pt-16 px-3 sm:px-4 max-w-6xl mx-auto">

        {/* ── HEADER: Title + Agent Strip ──────────────────────────────── */}
        <div className="py-4">
          {activeTool !== "home" ? (
            <div className="flex items-center gap-2 mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setActiveTool("home"); setExpandedDomain(null); }}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={14} className="mr-1" />
                <span className="text-[11px]">Back</span>
              </Button>
              {currentDomain && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">{currentDomain.label}</span>
                  <ChevronRight size={10} className="text-muted-foreground" />
                  <span className="text-[11px] font-semibold text-foreground">{currentTool?.label}</span>
                </div>
              )}
              <div className="ml-auto">
                <Button
                  size="sm" variant="ghost"
                  onClick={sendTestEmail}
                  disabled={testEmailState === "sending"}
                  className="text-[10px] text-muted-foreground h-7 px-2"
                >
                  {testEmailState === "sending" && <Loader2 size={10} className="animate-spin mr-1" />}
                  {testEmailState === "sent" && <CheckCircle size={10} className="text-green-400 mr-1" />}
                  {testEmailState === "error" && <AlertTriangle size={10} className="text-red-400 mr-1" />}
                  {testEmailState === "idle" && <Mail size={10} className="mr-1" />}
                  Test
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Title Row */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-lg font-black text-foreground tracking-tight">
                    M² Mission Control
                  </h1>
                  {totalPending > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {totalPending} item{totalPending !== 1 ? "s" : ""} need attention
                    </p>
                  )}
                </div>
                <Button
                  size="sm" variant="ghost"
                  onClick={sendTestEmail}
                  disabled={testEmailState === "sending"}
                  className="text-[10px] text-muted-foreground h-7 px-2"
                >
                  {testEmailState === "idle" && <Mail size={10} className="mr-1" />}
                  {testEmailState === "sending" && <Loader2 size={10} className="animate-spin mr-1" />}
                  {testEmailState === "sent" && <CheckCircle size={10} className="text-green-400 mr-1" />}
                  {testEmailState === "error" && <AlertTriangle size={10} className="text-red-400 mr-1" />}
                  Test
                </Button>
              </div>

              {/* Agent Status Strip */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <AgentCard name="Oz" role="System Monitor" status="online" color="#22c55e" />
                <AgentCard name="Selma" role="Head Marketer" status="scheduled" color="#a855f7" />
                <AgentCard name="Scarlett" role="Creative Strategy" status="scheduled" color="#f43f5e" />
              </div>
            </>
          )}
        </div>

        {/* ── SEARCH BAR (always visible) ─────────────────────────────── */}
        <div className="relative mb-4">
          <div
            className={`relative flex items-center rounded-2xl border transition-all ${
              searchFocused
                ? "border-primary/50 bg-card shadow-lg shadow-primary/5"
                : "border-border/40 bg-card/50"
            }`}
          >
            <Search size={14} className="absolute left-3 text-muted-foreground" />
            <Input
              id="admin-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder="Search tools or ⌘K..."
              className="border-0 bg-transparent pl-9 pr-8 h-10 text-[12px] focus-visible:ring-0 placeholder:text-muted-foreground/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          <AnimatePresence>
            {searchFocused && filteredTools.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute z-50 top-12 left-0 right-0 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
              >
                {filteredTools.map(({ tool, domain }) => (
                  <button
                    key={tool.key}
                    onMouseDown={() => handleToolClick(tool.key)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition text-left"
                  >
                    <domain.icon size={13} style={{ color: domain.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground truncate">{tool.label}</p>
                      <p className="text-[9px] text-muted-foreground">{domain.label}</p>
                    </div>
                    {(tool.badge ?? 0) > 0 && (
                      <Badge variant="destructive" className="text-[7px] px-1 py-0 h-3.5">
                        {tool.badge}
                      </Badge>
                    )}
                    <ChevronRight size={10} className="text-muted-foreground" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── AI BAR ──────────────────────────────────────────────────── */}
        {activeTool === "home" && (
          <div className="mb-5">
            <Suspense fallback={<div className="h-12 rounded-2xl bg-muted/10 animate-pulse" />}>
              <AdminAiBar />
            </Suspense>
          </div>
        )}

        {/* ── CONTENT ─────────────────────────────────────────────────── */}
        {activeTool === "home" ? (
          <div className="space-y-4 pb-20">
            {/* Quick Stats Row */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "AI Queue", value: b.aiQueue, color: "#f97316", tool: "ai-queue" },
                { label: "Support", value: b.support, color: "#3b82f6", tool: "support" },
                { label: "Coach AI", value: b.drafts, color: "#a855f7", tool: "coach-ai" },
                { label: "Requests", value: b.custom, color: "#22c55e", tool: "custom-req" },
              ].map((stat) => (
                <button
                  key={stat.label}
                  onClick={() => handleToolClick(stat.tool)}
                  className="rounded-xl p-3 text-center transition-all hover:scale-[1.03] active:scale-95"
                  style={{
                    background: `${stat.color}08`,
                    border: `1px solid ${stat.color}15`,
                  }}
                >
                  <p className="text-xl font-black text-foreground">{stat.value}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{stat.label}</p>
                </button>
              ))}
            </div>

            {/* Domain Cards Grid */}
            <div className="space-y-3">
              {domains.map((domain) => {
                const Icon = domain.icon;
                const domainBadge = domain.tools.reduce((sum, t) => sum + (t.badge ?? 0), 0);
                const isExpanded = expandedDomain === domain.key;

                return (
                  <motion.div
                    key={domain.key}
                    layout
                    className="rounded-2xl border overflow-hidden transition-colors"
                    style={{
                      background: isExpanded ? `${domain.color}06` : "hsl(var(--card))",
                      borderColor: isExpanded ? `${domain.color}25` : "hsl(var(--border) / 0.3)",
                    }}
                  >
                    {/* Domain Header — clickable to expand */}
                    <button
                      onClick={() => setExpandedDomain(isExpanded ? null : domain.key)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${domain.color}15` }}
                      >
                        <Icon size={15} style={{ color: domain.color }} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-[12px] font-bold text-foreground">{domain.label}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {domain.tools.length} tool{domain.tools.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {domainBadge > 0 && (
                        <Badge variant="destructive" className="text-[8px] px-1.5 py-0 h-4">
                          {domainBadge}
                        </Badge>
                      )}
                      <ChevronRight
                        size={14}
                        className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      />
                    </button>

                    {/* Expanded Tool List */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
                            {domain.tools.map((tool) => (
                              <button
                                key={tool.key}
                                onClick={() => handleToolClick(tool.key)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all hover:bg-muted/20 active:scale-[0.98]"
                              >
                                <span className="text-[11px] text-foreground truncate flex-1">
                                  {tool.label}
                                </span>
                                {(tool.badge ?? 0) > 0 && (
                                  <Badge variant="destructive" className="text-[7px] px-1 py-0 h-3.5 shrink-0">
                                    {tool.badge}
                                  </Badge>
                                )}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : currentTool ? (
          <div className="pb-20">
            {/* AI Bar in tool view too */}
            <div className="mb-4">
              <Suspense fallback={<div className="h-12 rounded-2xl bg-muted/10 animate-pulse" />}>
                <AdminAiBar />
              </Suspense>
            </div>
            <Suspense fallback={<TabLoader />}>
              {currentTool.component}
            </Suspense>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Tool not found.</p>
        )}
      </div>
    </div>
  );
};

export default Admin;
