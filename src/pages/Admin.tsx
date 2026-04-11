import { useState, useEffect, Suspense, useMemo } from "react";
import { Navigate } from "react-router-dom";
import AppNavbar from "@/components/layout/AppNavbar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Users, Dumbbell, DollarSign, Megaphone, Globe,
  Activity, AlertTriangle, CheckCircle, Mail, Zap, Search,
  ChevronRight, X, ArrowLeft, Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { lazyRetry } from "@/lib/lazyRetry";

/* ── Lazy-load ALL admin sub-components (with retry) ────────────────────────── */
const AdminAiBar = lazyRetry(() => import("@/components/admin/AdminAiBar"));

// Training domain
const AdminPrograms           = lazyRetry(() => import("@/components/admin/AdminPrograms"));
const AdminExerciseLibrary    = lazyRetry(() => import("@/components/admin/AdminExerciseLibrary"));
const AdminWorkoutInventory   = lazyRetry(() => import("@/components/admin/AdminWorkoutInventory"));
const AdminBatchGenerator     = lazyRetry(() => import("@/components/admin/AdminBatchGenerator"));
const AdminExerciseGenerator  = lazyRetry(() => import("@/components/admin/AdminExerciseGenerator"));
const AdminProgramCreator     = lazyRetry(() => import("@/components/admin/AdminProgramCreator"));
const AdminAiQueue            = lazyRetry(() => import("@/components/admin/AdminAiQueue"));
const AdminRecoveryHeatmap    = lazyRetry(() => import("@/components/admin/AdminRecoveryHeatmap"));
const AdminMonthlyFocus       = lazyRetry(() => import("@/components/admin/AdminMonthlyFocus"));
const AdminBiomechanics       = lazyRetry(() => import("@/components/admin/AdminBiomechanics"));
const AdminAiToolkit          = lazyRetry(() => import("@/components/admin/AdminAiToolkit"));
const AdminCoachAiQueue       = lazyRetry(() => import("@/components/admin/AdminCoachAiQueue"));
const AdminCustomRequests     = lazyRetry(() => import("@/components/admin/AdminCustomRequests"));
const AdminUserGeneratedWorkouts = lazyRetry(() => import("@/components/admin/AdminUserGeneratedWorkouts"));
const AdminImageMatcher       = lazyRetry(() => import("@/components/admin/AdminImageMatcher"));
const AdminProgressLogger     = lazyRetry(() => import("@/components/admin/AdminProgressLogger"));
const AdminLiftVideoReview    = lazyRetry(() => import("@/components/admin/AdminLiftVideoReview"));
const AdminProveItReview      = lazyRetry(() => import("@/components/admin/AdminProveItReview"));

// People domain
const AdminClientList         = lazyRetry(() => import("@/components/admin/AdminClientList"));
const AdminSupportCopilot     = lazyRetry(() => import("@/components/admin/AdminSupportCopilot"));
const AdminFamilyManager      = lazyRetry(() => import("@/components/admin/AdminFamilyManager"));
const AdminTeamRosters        = lazyRetry(() => import("@/components/admin/AdminTeamRosters"));
const AdminCoachManager       = lazyRetry(() => import("@/components/admin/AdminCoachManager"));
const AdminTeamSandbox        = lazyRetry(() => import("@/components/admin/AdminTeamSandbox"));
const AdminParentReports      = lazyRetry(() => import("@/components/admin/AdminParentReports"));
const AdminParentInbox        = lazyRetry(() => import("@/components/admin/AdminParentInbox"));
const AdminCoachInbox         = lazyRetry(() => import("@/components/admin/AdminCoachInbox"));
const AdminPostureRequests    = lazyRetry(() => import("@/components/admin/AdminPostureRequests"));
const AdminCoachDashboard     = lazyRetry(() => import("@/components/admin/AdminCoachDashboard"));
const AdminDirectMessages     = lazyRetry(() => import("@/components/admin/AdminDirectMessages"));
const AdminVideoReview        = lazyRetry(() => import("@/components/admin/AdminVideoReview"));
const AdminTrialSettings      = lazyRetry(() => import("@/components/admin/AdminTrialSettings"));
const AdminClientOnboarding   = lazyRetry(() => import("@/components/admin/AdminClientOnboarding"));
const AdminChurnRadar         = lazyRetry(() => import("@/components/admin/AdminChurnRadar"));
const AdminSchedule           = lazyRetry(() => import("@/components/admin/AdminSchedule"));
const AdminVipAccess          = lazyRetry(() => import("@/components/admin/AdminVipAccess"));
const UserActivityFeed        = lazyRetry(() => import("@/components/admin/UserActivityFeed"));

// Business & Ops domain
const AdminFinancials         = lazyRetry(() => import("@/components/admin/AdminFinancials"));
const AdminPromotions         = lazyRetry(() => import("@/components/admin/AdminPromotions"));
const AdminPointsManager      = lazyRetry(() => import("@/components/admin/AdminPointsManager"));
const AdminTierManager        = lazyRetry(() => import("@/components/admin/AdminTierManager"));
const AdminSystemSettings     = lazyRetry(() => import("@/components/admin/AdminSystemSettings"));
const AdminStripeProducts     = lazyRetry(() => import("@/components/admin/AdminStripeProducts"));
const AdminServiceCatalog     = lazyRetry(() => import("@/components/admin/AdminServiceCatalog"));
const AdminGiftCards          = lazyRetry(() => import("@/components/admin/AdminGiftCards"));
const AdminGuideStore         = lazyRetry(() => import("@/components/admin/AdminGuideStore"));
const AdminAffiliateManager   = lazyRetry(() => import("@/components/admin/AdminAffiliateManager"));
const AdminReferrals          = lazyRetry(() => import("@/components/admin/AdminReferrals"));
const AdminLegalCompliance    = lazyRetry(() => import("@/components/admin/AdminLegalCompliance"));
const AdminTrash              = lazyRetry(() => import("@/components/admin/AdminTrash"));
const AdminFulfillment        = lazyRetry(() => import("@/components/admin/AdminFulfillment"));
const AdminOrders             = lazyRetry(() => import("@/components/admin/AdminOrders"));
const AdminOpsCenter          = lazyRetry(() => import("@/components/admin/AdminOpsCenter"));
const AdminSandbox            = lazyRetry(() => import("@/components/admin/AdminSandbox"));
const AdminBusinessDashboard  = lazyRetry(() => import("@/components/admin/AdminBusinessDashboard"));
const AdminClientHealth       = lazyRetry(() => import("@/components/admin/AdminClientHealth"));
const AdminEmailLog           = lazyRetry(() => import("@/components/admin/AdminEmailLog"));
const AdminMigrations         = lazyRetry(() => import("@/components/admin/AdminMigrations"));
const AdminB2BPipeline        = lazyRetry(() => import("@/components/admin/AdminB2BPipeline"));
const AdminSocialMediaOnboarding = lazyRetry(() => import("@/components/admin/AdminSocialMediaOnboarding"));
const AdminEnrichmentPanel    = lazyRetry(() => import("@/components/admin/AdminEnrichmentPanel"));

// Marketing & Content domain
const AdminFrontPage          = lazyRetry(() => import("@/components/admin/AdminFrontPage"));
const AdminSiteEditor         = lazyRetry(() => import("@/components/admin/AdminSiteEditor"));
const AdminTestimonials       = lazyRetry(() => import("@/components/admin/AdminTestimonials"));
const AdminLearnEditor        = lazyRetry(() => import("@/components/admin/AdminLearnEditor"));
const AdminBroadcasts         = lazyRetry(() => import("@/components/admin/AdminBroadcasts"));
const AdminSubscriberList     = lazyRetry(() => import("@/components/admin/AdminSubscriberList"));
const AdminNewsletterComposer = lazyRetry(() => import("@/components/admin/AdminNewsletterComposer"));
const AdminSendHistory        = lazyRetry(() => import("@/components/admin/AdminSendHistory"));
const AdminMarketingDrafts    = lazyRetry(() => import("@/components/admin/AdminMarketingDrafts"));
const AdminAiBusinessTools    = lazyRetry(() => import("@/components/admin/AdminAiBusinessTools"));
const AdminCmoReports         = lazyRetry(() => import("@/components/admin/AdminCmoReports"));
const AdminMediaVault         = lazyRetry(() => import("@/components/admin/AdminMediaVault"));
const AdminSeoGenerator       = lazyRetry(() => import("@/components/admin/AdminSeoGenerator"));
const AdminTrainingNewsletter = lazyRetry(() => import("@/components/admin/AdminTrainingNewsletter"));
const AdminM2GrowthHub        = lazyRetry(() => import("@/components/admin/AdminM2GrowthHub"));
const AdminAdCampaigns        = lazyRetry(() => import("@/components/admin/AdminAdCampaigns"));
const AdminOutreach           = lazyRetry(() => import("@/components/admin/AdminOutreach"));
const AdminSeoPages           = lazyRetry(() => import("@/components/admin/AdminSeoPages"));
const AdminSearchConsole      = lazyRetry(() => import("@/components/admin/AdminSearchConsole"));
const AdminGbpPosts           = lazyRetry(() => import("@/components/admin/AdminGbpPosts"));
const AdminInstagramPosts     = lazyRetry(() => import("@/components/admin/AdminInstagramPosts"));
const AdminContentGenerator   = lazyRetry(() => import("@/components/admin/AdminContentGenerator"));

// DWA domain
const AdminBoardReport        = lazyRetry(() => import("@/components/admin/AdminBoardReport"));
const AdminDWAOverview        = lazyRetry(() => import("@/components/admin/AdminDWAOverview"));
const AdminHireAlertClients   = lazyRetry(() => import("@/components/admin/AdminHireAlertClients"));

// Agency domain
const AdminWebDesignCRM       = lazyRetry(() => import("@/components/admin/AdminWebDesignCRM"));
const AdminAgencyCRM          = lazyRetry(() => import("@/components/admin/AdminAgencyCRM"));
const AdminDemoLinkGenerator  = lazyRetry(() => import("@/components/admin/AdminDemoLinkGenerator"));
const AdminProspector         = lazyRetry(() => import("@/components/admin/AdminProspector"));
const AdminAutomationHub      = lazyRetry(() => import("@/components/admin/AdminAutomationHub"));
const AdminSiteBuilder        = lazyRetry(() => import("@/components/admin/AdminSiteBuilder"));
const AdminWebDesignAutomations = lazyRetry(() => import("@/components/admin/AdminWebDesignAutomations"));
const AdminCRMDashboard       = lazyRetry(() => import("@/components/admin/AdminCRMDashboard"));
const VisitorIntelFeed        = lazyRetry(() => import("@/components/admin/VisitorIntelFeed"));
const TechDispatchMap         = lazyRetry(() => import("@/components/admin/TechDispatchMap"));
const ReviewLeaderboard       = lazyRetry(() => import("@/components/admin/ReviewLeaderboard"));
const AdminFieldCRMClients    = lazyRetry(() => import("@/components/admin/AdminFieldCRMClients"));

// Command Deck
const AdminCommandDeck        = lazyRetry(() => import("@/components/admin/AdminCommandDeck"));
const AdminPurchaseAlert      = lazyRetry(() => import("@/components/admin/AdminPurchaseAlert"));
const AdminCommandCenter      = lazyRetry(() => import("@/components/admin/AdminCommandCenter"));
const AdminNotificationCenter = lazyRetry(() => import("@/components/admin/AdminNotificationCenter"));
const AdminScoutingDashboard  = lazyRetry(() => import("@/components/admin/AdminScoutingDashboard"));

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
  const [activeTool, setActiveToolRaw] = useState<string>(() => {
    const hash = window.location.hash.replace("#", "");
    return hash || "home";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [testEmailState, setTestEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const { isAdmin, isLoading } = useIsAdmin();

  /* Wrap setActiveTool to push browser history */
  const setActiveTool = (tool: string) => {
    setActiveToolRaw(tool);
    if (tool === "home") {
      window.history.pushState({ adminTool: "home" }, "", "/admin");
    } else {
      window.history.pushState({ adminTool: tool }, "", `/admin#${tool}`);
    }
  };

  /* Listen for browser back/forward */
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const tool = e.state?.adminTool;
      if (tool) {
        setActiveToolRaw(tool);
      } else {
        // No admin state = user went back past admin, go to home
        const hash = window.location.hash.replace("#", "");
        setActiveToolRaw(hash || "home");
      }
    };
    window.addEventListener("popstate", handlePopState);
    // Replace current entry so first back goes to previous page
    window.history.replaceState({ adminTool: activeTool }, "", window.location.href);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
        { key: "lead-command", label: "Lead Command Center", component: <AdminProspector /> },
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
        { key: "revenue", label: "💰 Revenue & Ledger", component: <AdminFinancials /> },
        { key: "fulfillment", label: "🔔 Fulfillment", component: <AdminFulfillment /> },
        { key: "ops", label: "Ops Center", component: <AdminOpsCenter /> },
        { key: "pipeline", label: "B2B Pipeline", component: <AdminB2BPipeline /> },
        { key: "enrichment", label: "⚡ Enrichment", component: <AdminEnrichmentPanel /> },
        { key: "referrals", label: "Referrals", component: <AdminReferrals /> },
        { key: "sandbox", label: "🧪 Sandbox", component: <AdminSandbox /> },
        { key: "orders", label: "Orders", component: <AdminOrders /> },
        { key: "health", label: "Client Health", component: <AdminClientHealth /> },
        { key: "promotions", label: "Promotions", component: <AdminPromotions /> },
        { key: "stripe", label: "Stripe Products", component: <AdminStripeProducts /> },
        { key: "affiliates", label: "Affiliates", component: <AdminAffiliateManager /> },
        { key: "notifications", label: "🔔 Notifications", component: <AdminNotificationCenter /> },
        { key: "email-log", label: "📧 Email Log", component: <AdminEmailLog /> },
        { key: "system", label: "System & Refs", component: <AdminSystemSettings /> },
        { key: "trash", label: "🗑 Trash", component: <AdminTrash />, badge: b.trash },
      ],
    },
    {
      key: "marketing",
      label: "Marketing & Ads",
      icon: Megaphone,
      color: "#a855f7",
      tools: [
        { key: "ad-campaigns", label: "⚡ Ad Campaigns", component: <AdminAdCampaigns /> },
        { key: "m2-hub", label: "🚀 Growth Hub", component: <AdminM2GrowthHub /> },
        { key: "outreach", label: "📧 Outreach", component: <AdminOutreach /> },
        { key: "search", label: "📊 Search Console", component: <AdminSearchConsole /> },
        { key: "gbp", label: "GBP Posts", component: <AdminGbpPosts /> },
        { key: "seo", label: "SEO Engine", component: <AdminSeoGenerator /> },
        { key: "broadcasts", label: "Broadcasts", component: <AdminBroadcasts /> },
        { key: "compose", label: "Newsletter", component: <AdminNewsletterComposer /> },
        { key: "testimonials", label: "Testimonials", component: <AdminTestimonials /> },
        { key: "media-vault", label: "Media Vault", component: <AdminMediaVault /> },
        { key: "subscribers", label: "Subscribers", component: <AdminSubscriberList /> },
        { key: "marketing-ai", label: "Marketing AI", component: (
          <div className="space-y-8">
            <AdminMarketingDrafts />
            <div className="border-t border-border pt-6"><AdminAiBusinessTools /></div>
          </div>
        )},
        { key: "site", label: "Site Editor", component: <AdminSiteEditor /> },
        { key: "front-page", label: "Front Page", component: <AdminFrontPage /> },
        { key: "seo-pages", label: "SEO Pages", component: <AdminSeoPages /> },
        { key: "instagram", label: "Instagram", component: <AdminInstagramPosts /> },
        { key: "content-gen", label: "Content Generator", component: <AdminContentGenerator /> },
        { key: "cmo", label: "CMO Reports", component: <AdminCmoReports /> },
        { key: "training-newsletter", label: "Training Newsletter", component: <AdminTrainingNewsletter /> },
        { key: "history", label: "Send History", component: <AdminSendHistory /> },
        { key: "learn", label: "Learn Hub", component: <AdminLearnEditor /> },
      ],
    },
    {
      key: "dwa",
      label: "Detroit Web Agency",
      icon: Wrench,
      color: "#00d4ff",
      tools: [
        { key: "dwa-overview", label: "🏗 DWA Overview", component: <AdminDWAOverview /> },
        { key: "field-crm-clients", label: "🏢 FieldDesk Clients", component: <AdminFieldCRMClients /> },
        { key: "hire-alert-clients", label: "🔔 TechAlert Clients", component: <AdminHireAlertClients /> },
        { key: "dwa-visitor-intel", label: "👁 SiteRadar (Visitor Intel)", component: <VisitorIntelFeed /> },
        { key: "dwa-dispatch-map", label: "🗺 Dispatch Map", component: <TechDispatchMap /> },
        { key: "dwa-review-engine", label: "⭐ Review Engine", component: <ReviewLeaderboard /> },
        { key: "dwa-crm", label: "🏗️ Web Design CRM", component: <AdminWebDesignCRM /> },
        { key: "dwa-prospector", label: "🔍 Prospector", component: <AdminProspector /> },
        { key: "dwa-demo-links", label: "🔗 Demo Links", component: <AdminDemoLinkGenerator /> },
        { key: "dwa-scouting", label: "📊 Scouting Dashboard", component: <AdminScoutingDashboard /> },
      ],
    },
    {
      key: "agency",
      label: "Agency",
      icon: Globe,
      color: "#06b6d4",
      tools: [
        { key: "crm-dashboard", label: "📊 CRM Intelligence", component: <AdminCRMDashboard /> },
        { key: "field-crm-clients", label: "🏢 Field CRM Clients", component: <AdminFieldCRMClients /> },
        { key: "visitor-intel", label: "👁 Visitor Intel", component: <VisitorIntelFeed /> },
        { key: "dispatch-map", label: "🗺 Dispatch Map", component: <TechDispatchMap /> },
        { key: "review-engine", label: "⭐ Review Engine", component: <ReviewLeaderboard /> },
        { key: "crm", label: "🏗️ Web Design CRM", component: <AdminWebDesignCRM /> },
        { key: "prospector", label: "🔍 Prospector", component: <AdminProspector /> },
        { key: "scouting", label: "📊 Scouting Dashboard", component: <AdminScoutingDashboard /> },
        { key: "agency-crm", label: "Agency CRM", component: <AdminAgencyCRM /> },
        { key: "site-builder", label: "Site Builder", component: <AdminSiteBuilder /> },
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
                onClick={() => { window.history.back(); }}
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
            {/* Purchase Alert Banner — shows when new purchases need onboarding */}
            <Suspense fallback={null}>
              <AdminPurchaseAlert />
            </Suspense>

            {/* Command Center Dashboard */}
            <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/10 animate-pulse" />}>
              <AdminCommandCenter onNavigate={handleToolClick} />
            </Suspense>

            {/* Smart Notifications */}
            <Suspense fallback={null}>
              <AdminNotificationCenter />
            </Suspense>

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
