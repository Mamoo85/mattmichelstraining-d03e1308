import { useState, useEffect, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import AppNavbar from "@/components/layout/AppNavbar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Users, Dumbbell, Landmark, FileText,
  Megaphone, Bot, Globe, DollarSign, Mail, CheckCircle, Zap, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminHelpCard, TAB_HELP, resetAdminHelp } from "@/components/admin/AdminHelpCard";
import { lazyRetry } from "@/lib/lazyRetry";

/* ── Lazy-load ALL admin sub-components ───────────────────────────────────── */
const AdminCommandDeck        = lazyRetry(() => import("@/components/admin/AdminCommandDeck"));
const AdminAiBar              = lazyRetry(() => import("@/components/admin/AdminAiBar"));
const AdminPurchaseAlert      = lazyRetry(() => import("@/components/admin/AdminPurchaseAlert"));
const AdminNotificationCenter = lazyRetry(() => import("@/components/admin/AdminNotificationCenter"));

// Roster
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

// Engine
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

// Vault
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

// Business
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
const AdminProductManager     = lazyRetry(() => import("@/components/admin/AdminProductManager"));
const AdminPinnedNotes        = lazyRetry(() => import("@/components/admin/AdminPinnedNotes"));
const AdminTestLab            = lazyRetry(() => import("@/components/admin/AdminTestLab"));
const AdminMarketplaceAudit   = lazyRetry(() => import("@/components/admin/AdminMarketplaceAudit"));

// Content
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

// Growth
const AdminM2GrowthHub        = lazyRetry(() => import("@/components/admin/AdminM2GrowthHub"));
const AdminAdCampaigns        = lazyRetry(() => import("@/components/admin/AdminAdCampaigns"));
const AdminOutreach           = lazyRetry(() => import("@/components/admin/AdminOutreach"));
const AdminSeoPages           = lazyRetry(() => import("@/components/admin/AdminSeoPages"));
const AdminSearchConsole      = lazyRetry(() => import("@/components/admin/AdminSearchConsole"));
const AdminGbpPosts           = lazyRetry(() => import("@/components/admin/AdminGbpPosts"));
const AdminInstagramPosts     = lazyRetry(() => import("@/components/admin/AdminInstagramPosts"));
const AdminContentGenerator   = lazyRetry(() => import("@/components/admin/AdminContentGenerator"));
const AdminAiCommandCenter    = lazyRetry(() => import("@/components/admin/AdminAiCommandCenter"));

// Web Design
const AdminWebDesignCRM       = lazyRetry(() => import("@/components/admin/AdminWebDesignCRM"));
const AdminAgencyCRM          = lazyRetry(() => import("@/components/admin/AdminAgencyCRM"));
const AdminDemoLinkGenerator  = lazyRetry(() => import("@/components/admin/AdminDemoLinkGenerator"));
const AdminProspector         = lazyRetry(() => import("@/components/admin/AdminProspector"));
const AdminAutomationHub      = lazyRetry(() => import("@/components/admin/AdminAutomationHub"));
const AdminSiteBuilder        = lazyRetry(() => import("@/components/admin/AdminSiteBuilder"));
const AdminWebDesignAutomations = lazyRetry(() => import("@/components/admin/AdminWebDesignAutomations"));
const AdminScoutingDashboard  = lazyRetry(() => import("@/components/admin/AdminScoutingDashboard"));

// DWA Suite
const AdminBoardReport        = lazyRetry(() => import("@/components/admin/AdminBoardReport"));
const AdminDWAOverview        = lazyRetry(() => import("@/components/admin/AdminDWAOverview"));
const AdminHireAlertClients   = lazyRetry(() => import("@/components/admin/AdminHireAlertClients"));
const AdminContractorLeads    = lazyRetry(() => import("@/components/admin/AdminContractorLeads"));
const AdminDWARevenueDashboard = lazyRetry(() => import("@/components/admin/AdminDWARevenueDashboard"));
const AdminSimulationSuite    = lazyRetry(() => import("@/components/admin/AdminSimulationSuite"));
const AdminGlobalOutbox       = lazyRetry(() => import("@/components/admin/AdminGlobalOutbox"));
const AdminGhostDelayManager  = lazyRetry(() => import("@/components/admin/AdminGhostDelayManager"));
const AdminPostcardCampaigns  = lazyRetry(() => import("@/components/admin/AdminPostcardCampaigns"));
const AdminDeadLeads          = lazyRetry(() => import("@/components/admin/AdminDeadLeads"));
const AdminFieldCRMClients    = lazyRetry(() => import("@/components/admin/AdminFieldCRMClients"));
const VisitorIntelFeed        = lazyRetry(() => import("@/components/admin/VisitorIntelFeed"));
const TechDispatchMap         = lazyRetry(() => import("@/components/admin/TechDispatchMap"));
const ReviewLeaderboard       = lazyRetry(() => import("@/components/admin/ReviewLeaderboard"));

/* ── Master tab definitions ────────────────────────────────────────────────── */
const MASTER_TABS = [
  { key: "command",   label: "Command",   icon: Zap,        desc: "Quick Actions" },
  { key: "business",  label: "Business",  icon: DollarSign, desc: "Revenue · Ops" },
  { key: "ai",        label: "AI Center", icon: Bot,        desc: "All AI Tools" },
  { key: "roster",    label: "Roster",    icon: Users,      desc: "Users · Support" },
  { key: "engine",    label: "Engine",    icon: Dumbbell,   desc: "Training · AI" },
  { key: "vault",     label: "Vault",     icon: Landmark,   desc: "Money · Billing" },
  { key: "content",   label: "Content",   icon: FileText,   desc: "CMS · Email" },
  { key: "growth",    label: "Growth",    icon: Megaphone,  desc: "SEO · Outreach" },
  { key: "webdesign", label: "Web",       icon: Globe,      desc: "Leads · CRM" },
  { key: "dwa",       label: "DWA",       icon: Wrench,     desc: "Detroit Web Agency" },
];

/* ── Loaders ────────────────────────────────────────────────────────────────── */
const TabLoader = () => (
  <div className="flex justify-center py-12">
    <Loader2 size={20} className="text-primary animate-spin" />
  </div>
);

/* ── Horizontal-scroll sub-tabs (mobile friendly) ─────────────────────────── */
function SubTabs({
  tabs,
  defaultTab,
  helpId,
}: {
  tabs: { key: string; label: string | React.ReactNode; content: React.ReactNode }[];
  defaultTab?: string;
  helpId?: string;
}) {
  const [active, setActive] = useState(defaultTab || tabs[0].key);
  const content = tabs.find((t) => t.key === active)?.content ?? tabs[0].content;

  return (
    <div className="w-full">
      {helpId && TAB_HELP[helpId] && (
        <AdminHelpCard id={helpId} {...TAB_HELP[helpId]} />
      )}
      <div className="overflow-x-auto pb-1 -mx-2 px-2 mb-4">
        <div className="flex gap-1 min-w-max">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={cn(
                "flex-shrink-0 px-3 py-2 rounded text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all",
                active === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <Suspense fallback={<TabLoader />}>{content}</Suspense>
    </div>
  );
}

/* ── Main Admin Component ───────────────────────────────────────────────────── */
const Admin = () => {
  const [activeTab, setActiveTab] = useState("command");
  const [testEmailState, setTestEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const { isAdmin, isLoading } = useIsAdmin();

  useEffect(() => {
    const handleNavigateAdmin = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener("navigate-admin", handleNavigateAdmin);
    return () => window.removeEventListener("navigate-admin", handleNavigateAdmin);
  }, []);

  /* ── Badge counts (30s polling) ──────────────────────────────────────────── */
  const { data: pendingDraftsCount = 0 } = useQuery({
    queryKey: ["pending-coach-drafts-count"],
    queryFn: async () => {
      const { count } = await supabase.from("coach_ai_drafts").select("id", { count: "exact", head: true }).eq("status", "pending");
      return count ?? 0;
    },
    staleTime: 30000, refetchInterval: 30000,
  });
  const { data: pendingAiQueueCount = 0 } = useQuery({
    queryKey: ["pending-ai-queue-count"],
    queryFn: async () => {
      const { count } = await supabase.from("ai_action_queue").select("id", { count: "exact", head: true }).eq("status", "pending");
      return count ?? 0;
    },
    staleTime: 30000, refetchInterval: 30000,
  });
  const { data: pendingSupportCount = 0 } = useQuery({
    queryKey: ["pending-support-count"],
    queryFn: async () => {
      const { count } = await supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open");
      return count ?? 0;
    },
    staleTime: 30000, refetchInterval: 30000,
  });
  const { data: unreadParentCount = 0 } = useQuery({
    queryKey: ["unread-parent-inbox-count"],
    queryFn: async () => {
      const { count } = await supabase.from("parent_inbox").select("id", { count: "exact", head: true }).eq("is_read", false).eq("is_deleted", false);
      return count ?? 0;
    },
    staleTime: 30000, refetchInterval: 30000,
  });
  const { data: pendingPostureCount = 0 } = useQuery({
    queryKey: ["pending-posture-count"],
    queryFn: async () => {
      const { count } = await supabase.from("posture_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
      return count ?? 0;
    },
    staleTime: 30000, refetchInterval: 30000,
  });
  const { data: pendingCustomCount = 0 } = useQuery({
    queryKey: ["pending-custom-requests-count"],
    queryFn: async () => {
      const { count } = await supabase.from("custom_program_requests" as any).select("id", { count: "exact", head: true }).in("status", ["pending", "ready_for_review"]);
      return count ?? 0;
    },
    staleTime: 30000, refetchInterval: 30000,
  });
  const { data: pendingLiftVideosCount = 0 } = useQuery({
    queryKey: ["pending-lift-videos-count"],
    queryFn: async () => {
      const { count } = await supabase.from("lift_videos" as any).select("id", { count: "exact", head: true }).eq("status", "pending_review");
      return count ?? 0;
    },
    staleTime: 30000, refetchInterval: 30000,
  });
  const { data: pendingProveItCount = 0 } = useQuery({
    queryKey: ["pending-prove-it-count"],
    queryFn: async () => {
      const { count } = await supabase.from("pr_submissions" as any).select("id", { count: "exact", head: true }).eq("status", "pending");
      return count ?? 0;
    },
    staleTime: 30000, refetchInterval: 30000,
  });
  const { data: trashCount = 0 } = useQuery({
    queryKey: ["admin-trash-count"],
    queryFn: async () => {
      const { count } = await supabase.from("admin_trash" as any).select("id", { count: "exact", head: true });
      return count ?? 0;
    },
    staleTime: 60000, refetchInterval: 60000,
  });

  const totalEngineBadge = pendingDraftsCount + pendingAiQueueCount + pendingCustomCount + pendingLiftVideosCount + pendingProveItCount;
  const totalRosterBadge = pendingSupportCount + unreadParentCount + pendingPostureCount;
  const totalCommandBadge = totalEngineBadge + totalRosterBadge;

  const tabBadge: Record<string, number> = {
    command: totalCommandBadge,
    roster: totalRosterBadge,
    engine: totalEngineBadge,
    vault: trashCount,
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const Pip = ({ n }: { n: number }) =>
    n > 0 ? (
      <span className="absolute -top-1 -right-1.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5 leading-none">
        {n > 99 ? "99+" : n}
      </span>
    ) : null;

  const badgeLabel = (label: string, count: number) =>
    count > 0 ? (
      <span className="flex items-center gap-1">
        {label}
        <Badge variant="destructive" className="text-[8px] px-1.5 py-0 min-w-[18px] h-4">{count}</Badge>
      </span>
    ) : label;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />

      <div className="container pt-20 pb-24 md:pb-12">

        {/* ── Desktop top nav ─────────────────────────────────────────────── */}
        <div className="hidden md:block mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-display">Command Center</h1>
              <p className="text-xs text-muted-foreground">Manage everything from one place</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={resetAdminHelp} className="text-[10px] text-muted-foreground h-7">
                Reset Help Tips
              </Button>
              <Button
                size="sm" variant="outline"
                onClick={sendTestEmail}
                disabled={testEmailState === "sending"}
                className="text-xs gap-1.5 border-slate-600 text-slate-300 hover:text-white h-8"
              >
                {testEmailState === "sending" && <Loader2 size={12} className="animate-spin" />}
                {testEmailState === "sent" && <CheckCircle size={12} className="text-green-400" />}
                {testEmailState === "idle" && <Mail size={12} />}
                {testEmailState === "idle" ? "Test Email" : testEmailState === "sending" ? "Sending…" : testEmailState === "sent" ? "Sent!" : "Failed"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-5 lg:grid-cols-10 gap-1.5">
            {MASTER_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              const badge = tabBadge[tab.key] ?? 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-2 py-3 rounded-lg border text-center transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                  )}
                >
                  <div className="relative">
                    <Icon size={16} />
                    <Pip n={badge} />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest leading-none">{tab.label}</span>
                  <span className={cn("text-[8px] leading-none", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {tab.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Mobile top bar ──────────────────────────────────────────────── */}
        <div className="flex md:hidden items-center justify-between mb-4">
          <div>
            <h1 className="text-base font-bold text-foreground">
              {MASTER_TABS.find((t) => t.key === activeTab)?.label ?? "Admin"}
            </h1>
            <p className="text-[10px] text-muted-foreground">
              {MASTER_TABS.find((t) => t.key === activeTab)?.desc}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={resetAdminHelp} className="text-[10px] text-muted-foreground h-7 px-2">
            Help
          </Button>
        </div>

        {/* ── Tab content ─────────────────────────────────────────────────── */}

        {activeTab === "command" && (
          <div>
            <AdminHelpCard id="command" {...TAB_HELP.command} />
            <Suspense fallback={null}><AdminPurchaseAlert /></Suspense>
            <div className="mb-4">
              <Suspense fallback={<div className="h-12 rounded-2xl bg-muted/10 animate-pulse" />}>
                <AdminAiBar />
              </Suspense>
            </div>
            <Suspense fallback={null}><AdminNotificationCenter /></Suspense>
            <Suspense fallback={<TabLoader />}><AdminCommandDeck /></Suspense>
          </div>
        )}

        {activeTab === "business" && (
          <SubTabs helpId="business" tabs={[
            { key: "fulfillment",  label: "🔔 Fulfillment",    content: <AdminFulfillment /> },
            { key: "overview",     label: "Overview",           content: <AdminBusinessDashboard /> },
            { key: "sandbox",      label: "🧪 Sandbox",         content: <AdminSandbox /> },
            { key: "testlab",      label: "🔬 Test Lab",        content: <AdminTestLab /> },
            { key: "orders",       label: "📦 Orders",          content: <AdminOrders /> },
            { key: "health",       label: "Client Health",      content: <AdminClientHealth /> },
            { key: "ops",          label: "Ops Center",         content: <AdminOpsCenter /> },
            { key: "pipeline",     label: "Pipeline",           content: <AdminB2BPipeline /> },
            { key: "enrichment",   label: "⚡ Enrichment",      content: <AdminEnrichmentPanel /> },
            { key: "social-setup", label: "Social Setup",       content: <AdminSocialMediaOnboarding /> },
            { key: "email-log",    label: "📧 Email Log",       content: <AdminEmailLog /> },
            { key: "migrations",   label: "DB Migrations",      content: <AdminMigrations /> },
            { key: "product-mgr",  label: "Products",           content: <AdminProductManager /> },
            { key: "notes",        label: "📌 Notes",           content: <AdminPinnedNotes /> },
            { key: "mp-audit",     label: "🛒 Marketplace Audit", content: <AdminMarketplaceAudit /> },
          ]} />
        )}

        {activeTab === "ai" && (
          <div>
            <AdminHelpCard id="ai" {...TAB_HELP.ai} />
            <Suspense fallback={<TabLoader />}><AdminAiCommandCenter /></Suspense>
          </div>
        )}

        {activeTab === "roster" && (
          <SubTabs helpId="roster" tabs={[
            { key: "athletes",   label: "All Users",     content: <AdminClientList /> },
            { key: "activity",   label: "Activity Feed", content: <UserActivityFeed /> },
            { key: "support",    label: badgeLabel("Support", pendingSupportCount),      content: <AdminSupportCopilot /> },
            { key: "coaching",   label: badgeLabel("Coach Review", pendingPostureCount), content: (
              <div className="space-y-8">
                <AdminCoachInbox />
                <div className="border-t border-border pt-6"><AdminCoachDashboard /></div>
                <div className="border-t border-border pt-6"><AdminPostureRequests /></div>
                <div className="border-t border-border pt-6"><AdminVideoReview /></div>
              </div>
            )},
            { key: "messages",   label: "Messages",      content: <AdminDirectMessages /> },
            { key: "families",   label: "Families",      content: <AdminFamilyManager /> },
            { key: "teams",      label: "🏟️ Teams",      content: (
              <div className="space-y-8">
                <AdminTeamSandbox />
                <div className="border-t border-border pt-6"><AdminCoachManager /></div>
                <div className="border-t border-border pt-6"><AdminTeamRosters /></div>
              </div>
            )},
            { key: "parents",    label: badgeLabel("Parent Hub", unreadParentCount), content: (
              <div className="space-y-8">
                <AdminParentInbox />
                <div className="border-t border-border pt-6"><AdminParentReports /></div>
              </div>
            )},
            { key: "onboarding", label: "Onboarding",   content: (
              <div className="space-y-8">
                <AdminClientOnboarding />
                <div className="border-t border-border pt-6"><AdminTrialSettings /></div>
              </div>
            )},
            { key: "churn",      label: "Churn Radar",  content: <AdminChurnRadar /> },
            { key: "schedule",   label: "Schedule",     content: <AdminSchedule /> },
            { key: "vip",        label: "VIP Access",   content: <AdminVipAccess /> },
          ]} />
        )}

        {activeTab === "engine" && (
          <SubTabs helpId="engine" tabs={[
            { key: "log-lifts",       label: "Log Lifts",          content: <AdminProgressLogger /> },
            { key: "programs",        label: "Programs",            content: <AdminPrograms /> },
            { key: "exercises",       label: "Exercise Lib",        content: <AdminExerciseLibrary /> },
            { key: "image-matcher",   label: "Image Matcher",       content: <AdminImageMatcher /> },
            { key: "workouts",        label: "Workouts",            content: <AdminWorkoutInventory /> },
            { key: "batch",           label: "AI Workouts",         content: <AdminBatchGenerator /> },
            { key: "user-generated",  label: "User Generated",      content: <AdminUserGeneratedWorkouts /> },
            { key: "exercise-gen",    label: "AI Exercises",        content: <AdminExerciseGenerator /> },
            { key: "ai-programs",     label: "AI Programs",         content: <AdminProgramCreator /> },
            { key: "ai-queue",        label: badgeLabel("AI Queue", pendingAiQueueCount),   content: <AdminAiQueue /> },
            { key: "ai-toolkit",      label: "AI Toolkit",          content: <AdminAiToolkit /> },
            { key: "recovery",        label: "Recovery Map",        content: <AdminRecoveryHeatmap /> },
            { key: "monthly",         label: "Monthly Focus",       content: <AdminMonthlyFocus /> },
            { key: "biomechanics",    label: "Biomechanics",        content: <AdminBiomechanics /> },
            { key: "coach-ai",        label: badgeLabel("Coach AI", pendingDraftsCount),    content: <AdminCoachAiQueue /> },
            { key: "custom-requests", label: badgeLabel("Custom Req", pendingCustomCount),  content: <AdminCustomRequests /> },
            { key: "lift-videos",     label: badgeLabel("Lift Videos", pendingLiftVideosCount), content: <AdminLiftVideoReview /> },
            { key: "prove-it",        label: badgeLabel("Prove It", pendingProveItCount),   content: <AdminProveItReview /> },
          ]} />
        )}

        {activeTab === "vault" && (
          <SubTabs helpId="vault" tabs={[
            { key: "revenue",         label: "Revenue & Ledger",  content: <AdminFinancials /> },
            { key: "promotions",      label: "Promotions",        content: <AdminPromotions /> },
            { key: "points",          label: "Points",            content: <AdminPointsManager /> },
            { key: "tiers",           label: "Tier Access",       content: <AdminTierManager /> },
            { key: "system",          label: "System & Refs",     content: <AdminSystemSettings /> },
            { key: "stripe-products", label: "Stripe Products",   content: <AdminStripeProducts /> },
            { key: "catalog",         label: "Service Catalog",   content: <AdminServiceCatalog /> },
            { key: "gift-cards",      label: "Gift Cards",        content: <AdminGiftCards /> },
            { key: "guides",          label: "Playbooks Store",   content: <AdminGuideStore /> },
            { key: "affiliates",      label: "Affiliates",        content: <AdminAffiliateManager /> },
            { key: "referrals",       label: "Referrals",         content: <AdminReferrals /> },
            { key: "legal",           label: "Legal",             content: <AdminLegalCompliance /> },
            { key: "trash",           label: badgeLabel("🗑 Trash", trashCount), content: <AdminTrash /> },
          ]} />
        )}

        {activeTab === "content" && (
          <SubTabs helpId="content" tabs={[
            { key: "front-page",   label: "Front Page",   content: <AdminFrontPage /> },
            { key: "site",         label: "Site Editor",  content: <AdminSiteEditor /> },
            { key: "testimonials", label: "Testimonials", content: <AdminTestimonials /> },
            { key: "learn",        label: "Learn Hub",    content: <AdminLearnEditor /> },
            { key: "broadcasts",   label: "Broadcasts",   content: <AdminBroadcasts /> },
            { key: "subscribers",  label: "Subscribers",  content: <AdminSubscriberList /> },
            { key: "compose",      label: "Compose",      content: <AdminNewsletterComposer /> },
            { key: "training-nl",  label: "🏋️ Training NL", content: <AdminTrainingNewsletter /> },
            { key: "history",      label: "Send History", content: <AdminSendHistory /> },
            { key: "marketing-ai", label: "Marketing & AI", content: (
              <div className="space-y-8">
                <AdminMarketingDrafts />
                <div className="border-t border-border pt-6"><AdminAiBusinessTools /></div>
              </div>
            )},
            { key: "cmo",          label: "CMO Reports",  content: <AdminCmoReports /> },
            { key: "media-vault",  label: "Media Vault",  content: <AdminMediaVault /> },
            { key: "seo",          label: "SEO Engine",   content: <AdminSeoGenerator /> },
          ]} />
        )}

        {activeTab === "growth" && (
          <SubTabs helpId="growth" defaultTab="m2-hub" tabs={[
            { key: "m2-hub",       label: "🚀 M² Hub",       content: <AdminM2GrowthHub /> },
            { key: "ad-campaigns", label: "⚡ Ad Campaigns",  content: <AdminAdCampaigns /> },
            { key: "outreach",     label: "Outreach",         content: <AdminOutreach /> },
            { key: "seo-pages",    label: "SEO Pages",        content: <AdminSeoPages /> },
            { key: "search",       label: "📊 Search Console",content: <AdminSearchConsole /> },
            { key: "gbp",          label: "GBP Posts",        content: <AdminGbpPosts /> },
            { key: "instagram",    label: "Instagram",        content: <AdminInstagramPosts /> },
            { key: "content-gen",  label: "Content Gen",      content: <AdminContentGenerator /> },
          ]} />
        )}

        {activeTab === "webdesign" && (
          <SubTabs helpId="webdesign" defaultTab="pipeline" tabs={[
            { key: "pipeline",       label: "B2B Pipeline",     content: <AdminB2BPipeline /> },
            { key: "agency-crm",     label: "Agency CRM",       content: <AdminAgencyCRM /> },
            { key: "crm",            label: "Web Design CRM",   content: <AdminWebDesignCRM /> },
            { key: "site-builder",   label: "Site Builder",     content: <AdminSiteBuilder /> },
            { key: "prospector",     label: "Prospector",       content: <AdminProspector /> },
            { key: "automation",     label: "Automation Hub",   content: <AdminAutomationHub /> },
            { key: "wd-automations", label: "Email Automations",content: <AdminWebDesignAutomations /> },
            { key: "scouting",       label: "Scouting",         content: <AdminScoutingDashboard /> },
            { key: "demo-links",     label: "🔗 Demo Links",    content: <AdminDemoLinkGenerator /> },
          ]} />
        )}

        {activeTab === "dwa" && (
          <div className="max-w-2xl mx-auto py-12">
            <div className="bg-card border-2 border-primary/40 rounded-xl p-8 text-center space-y-5 shadow-lg">
              <div className="text-5xl">🏢</div>
              <h2 className="text-2xl font-bold text-foreground">Detroit Web Agency Admin has moved.</h2>
              <p className="text-muted-foreground text-sm">
                All DWA revenue dashboards, client panels, dead leads, postcards, and outbox now live in the dedicated DWA command center.
              </p>
              <a
                href="/dwa-admin"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                Open DWA Admin →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile bottom nav bar ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border md:hidden">
        <div className="overflow-x-auto">
          <div className="flex min-w-max px-1 py-1 gap-0.5">
            {MASTER_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              const badge = tabBadge[tab.key] ?? 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 px-3 py-2 rounded transition-all min-w-[52px]",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="relative">
                    <Icon size={18} />
                    <Pip n={badge} />
                  </div>
                  <span className="text-[8px] font-bold uppercase tracking-widest leading-none">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
