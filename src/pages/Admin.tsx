import { useState, useEffect, lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import AppNavbar from "@/components/layout/AppNavbar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Users, Dumbbell, Landmark, FileText, Trash2, ClipboardList,
  Megaphone, Bot, Globe, DollarSign, Mail, CheckCircle, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminHelpCard, TAB_HELP, resetAdminHelp } from "@/components/admin/AdminHelpCard";

/* ── Lazy-load ALL admin sub-components ───────────────────────────────────── */
const AdminCommandDeck        = lazy(() => import("@/components/admin/AdminCommandDeck"));
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
const UserActivityFeed        = lazy(() => import("@/components/admin/UserActivityFeed"));
const AdminAiCommandCenter    = lazy(() => import("@/components/admin/AdminAiCommandCenter"));

const AdminWebDesignCRM       = lazy(() => import("@/components/admin/AdminWebDesignCRM"));
const AdminAgencyCRM          = lazy(() => import("@/components/admin/AdminAgencyCRM"));
const AdminDemoLinkGenerator  = lazy(() => import("@/components/admin/AdminDemoLinkGenerator"));
const AdminProspector         = lazy(() => import("@/components/admin/AdminProspector"));
const AdminAutomationHub      = lazy(() => import("@/components/admin/AdminAutomationHub"));
const AdminSiteBuilder        = lazy(() => import("@/components/admin/AdminSiteBuilder"));
const AdminWebDesignAutomations = lazy(() => import("@/components/admin/AdminWebDesignAutomations"));
const AdminB2BPipeline        = lazy(() => import("@/components/admin/AdminB2BPipeline"));
const AdminSocialMediaOnboarding = lazy(() => import("@/components/admin/AdminSocialMediaOnboarding"));

const AdminClientHealth       = lazy(() => import("@/components/admin/AdminClientHealth"));
const AdminBusinessDashboard  = lazy(() => import("@/components/admin/AdminBusinessDashboard"));
const AdminEmailLog           = lazy(() => import("@/components/admin/AdminEmailLog"));
const AdminMigrations         = lazy(() => import("@/components/admin/AdminMigrations"));
const AdminFulfillment        = lazy(() => import("@/components/admin/AdminFulfillment"));
const AdminOrders             = lazy(() => import("@/components/admin/AdminOrders"));
const AdminOpsCenter          = lazy(() => import("@/components/admin/AdminOpsCenter"));
const AdminSandbox            = lazy(() => import("@/components/admin/AdminSandbox"));

/* ── Master tab definitions ────────────────────────────────────────────────── */
const MASTER_TABS = [
  { key: "command", label: "Command",  icon: Zap,        desc: "Quick Actions" },
  { key: "business", label: "Business", icon: DollarSign, desc: "Revenue · Ops" },
  { key: "ai",       label: "AI Center",icon: Bot,        desc: "All AI Tools" },
  { key: "roster",   label: "Roster",   icon: Users,      desc: "Users · Support" },
  { key: "engine",   label: "Engine",   icon: Dumbbell,   desc: "Training · AI" },
  { key: "vault",    label: "Vault",    icon: Landmark,   desc: "Money · Billing" },
  { key: "content",  label: "Content",  icon: FileText,   desc: "CMS · Email" },
  { key: "growth",   label: "Growth",   icon: Megaphone,  desc: "SEO · Outreach" },
  { key: "webdesign",label: "Web",      icon: Globe,      desc: "Leads · CRM" },
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
      {/* Help card for this section */}
      {helpId && TAB_HELP[helpId] && (
        <AdminHelpCard id={helpId} {...TAB_HELP[helpId]} />
      )}

      {/* Horizontal-scroll tab bar — works great on mobile */}
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

      {/* Content */}
      <Suspense fallback={<TabLoader />}>{content}</Suspense>
    </div>
  );
}

/* ── Main Admin Component ───────────────────────────────────────────────────── */
const Admin = () => {
  const [activeTab, setActiveTab] = useState("command");
  const [testEmailState, setTestEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const { isAdmin, isLoading } = useIsAdmin();

  /* Cross-component navigation events */
  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "prospector") {
        setActiveTab("webdesign");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("switch-subtab", { detail: "prospector" }));
        }, 100);
      }
    };
    const handleNavigateAdmin = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener("switch-webdesign-tab", handleSwitchTab);
    window.addEventListener("navigate-admin", handleNavigateAdmin);
    return () => {
      window.removeEventListener("switch-webdesign-tab", handleSwitchTab);
      window.removeEventListener("navigate-admin", handleNavigateAdmin);
    };
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

  /* Badge map for bottom nav */
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

  /* ── Badge pill helper ──────────────────────────────────────────────────── */
  const Pip = ({ n }: { n: number }) =>
    n > 0 ? (
      <span className="absolute -top-1 -right-1.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5 leading-none">
        {n > 99 ? "99+" : n}
      </span>
    ) : null;

  /* ── Sub-tab label helpers with badges ──────────────────────────────────── */
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

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <div className="container pt-20 pb-24 md:pb-12">

        {/* ── Desktop top nav — hidden on mobile ──────────────────────────── */}
        <div className="hidden md:block mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-display">Command Center</h1>
              <p className="text-xs text-muted-foreground">Manage everything from one place</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm" variant="ghost"
                onClick={resetAdminHelp}
                className="text-[10px] text-muted-foreground h-7"
              >
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
                {testEmailState === "error" && <Mail size={12} className="text-red-400" />}
                {testEmailState === "idle" && <Mail size={12} />}
                {testEmailState === "idle" ? "Test Email" : testEmailState === "sending" ? "Sending…" : testEmailState === "sent" ? "Sent!" : "Failed"}
              </Button>
            </div>
          </div>

          {/* Desktop tab grid */}
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5">
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

        {/* ── Mobile top bar (title only, nav is at bottom) ───────────────── */}
        <div className="flex md:hidden items-center justify-between mb-4">
          <div>
            <h1 className="text-base font-bold text-foreground">
              {MASTER_TABS.find((t) => t.key === activeTab)?.label ?? "Admin"}
            </h1>
            <p className="text-[10px] text-muted-foreground">
              {MASTER_TABS.find((t) => t.key === activeTab)?.desc}
            </p>
          </div>
          <Button
            size="sm" variant="ghost"
            onClick={resetAdminHelp}
            className="text-[10px] text-muted-foreground h-7 px-2"
          >
            Help
          </Button>
        </div>

        {/* ── Tab content ───────────────────────────────────────────────────── */}

        {activeTab === "command" && (
          <div>
            <AdminHelpCard id="command" {...TAB_HELP.command} />
            <Suspense fallback={<TabLoader />}><AdminCommandDeck /></Suspense>
          </div>
        )}

        {activeTab === "business" && (
          <SubTabs helpId="business" tabs={[
            { key: "fulfillment",  label: "🔔 Fulfillment",      content: <AdminFulfillment /> },
            { key: "overview",     label: "Overview",             content: <AdminBusinessDashboard /> },
            { key: "sandbox",      label: "🧪 Sandbox",           content: <AdminSandbox /> },
            { key: "orders",       label: "📦 Orders",            content: <AdminOrders /> },
            { key: "health",       label: "Client Health",        content: <AdminClientHealth /> },
            { key: "ops",          label: "Ops Center",           content: <AdminOpsCenter /> },
            { key: "pipeline",     label: "Pipeline",             content: <AdminB2BPipeline /> },
            { key: "social-setup", label: "Social Setup",         content: <AdminSocialMediaOnboarding /> },
            { key: "email-log",    label: "📧 Email Log",         content: <AdminEmailLog /> },
            { key: "migrations",   label: "DB Migrations",        content: <AdminMigrations /> },
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
            { key: "athletes",  label: "All Users",       content: <AdminClientList /> },
            { key: "activity",  label: "Activity Feed",   content: <UserActivityFeed /> },
            { key: "support",   label: badgeLabel("Support", pendingSupportCount), content: <AdminSupportCopilot /> },
            { key: "coaching",  label: badgeLabel("Coach Review", pendingPostureCount), content: (
              <div className="space-y-8">
                <AdminCoachInbox />
                <div className="border-t border-border pt-6"><AdminCoachDashboard /></div>
                <div className="border-t border-border pt-6"><AdminPostureRequests /></div>
                <div className="border-t border-border pt-6"><AdminVideoReview /></div>
              </div>
            )},
            { key: "messages",   label: "Messages",       content: <AdminDirectMessages /> },
            { key: "families",   label: "Families",       content: <AdminFamilyManager /> },
            { key: "teams",      label: "🏟️ Teams",       content: (
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
            { key: "onboarding", label: "Onboarding",    content: (
              <div className="space-y-8">
                <AdminClientOnboarding />
                <div className="border-t border-border pt-6"><AdminTrialSettings /></div>
              </div>
            )},
            { key: "schedule",   label: "Schedule",      content: <AdminSchedule /> },
            { key: "vip",        label: "VIP Access",    content: <AdminVipAccess /> },
          ]} />
        )}

        {activeTab === "engine" && (
          <SubTabs helpId="engine" tabs={[
            { key: "log-lifts",      label: "Log Lifts",          content: <AdminProgressLogger /> },
            { key: "programs",       label: "Programs",            content: <AdminPrograms /> },
            { key: "exercises",      label: "Exercise Lib",        content: <AdminExerciseLibrary /> },
            { key: "image-matcher",  label: "Image Matcher",       content: <AdminImageMatcher /> },
            { key: "workouts",       label: "Workouts",            content: <AdminWorkoutInventory /> },
            { key: "batch",          label: "AI Workouts",         content: <AdminBatchGenerator /> },
            { key: "user-generated", label: "User Generated",      content: <AdminUserGeneratedWorkouts /> },
            { key: "exercise-gen",   label: "AI Exercises",        content: <AdminExerciseGenerator /> },
            { key: "ai-programs",    label: "AI Programs",         content: <AdminProgramCreator /> },
            { key: "ai-queue",       label: badgeLabel("AI Queue", pendingAiQueueCount), content: <AdminAiQueue /> },
            { key: "ai-toolkit",     label: "AI Toolkit",          content: <AdminAiToolkit /> },
            { key: "recovery",       label: "Recovery Map",        content: <AdminRecoveryHeatmap /> },
            { key: "monthly",        label: "Monthly Focus",       content: <AdminMonthlyFocus /> },
            { key: "biomechanics",   label: "Biomechanics",        content: <AdminBiomechanics /> },
            { key: "coach-ai",       label: badgeLabel("Coach AI", pendingDraftsCount), content: <AdminCoachAiQueue /> },
            { key: "custom-requests",label: badgeLabel("Custom Req", pendingCustomCount), content: <AdminCustomRequests /> },
            { key: "lift-videos",    label: badgeLabel("Lift Videos", pendingLiftVideosCount), content: <AdminLiftVideoReview /> },
            { key: "prove-it",       label: badgeLabel("Prove It", pendingProveItCount), content: <AdminProveItReview /> },
          ]} />
        )}

        {activeTab === "vault" && (
          <SubTabs helpId="vault" tabs={[
            { key: "revenue",        label: "Revenue & Ledger",  content: <AdminFinancials /> },
            { key: "promotions",     label: "Promotions",        content: <AdminPromotions /> },
            { key: "points",         label: "Points",            content: <AdminPointsManager /> },
            { key: "tiers",          label: "Tier Access",       content: <AdminTierManager /> },
            { key: "system",         label: "System & Refs",     content: <AdminSystemSettings /> },
            { key: "stripe-products",label: "Stripe Products",   content: <AdminStripeProducts /> },
            { key: "churn",          label: "Churn Radar",       content: <AdminChurnRadar /> },
            { key: "catalog",        label: "Service Catalog",   content: <AdminServiceCatalog /> },
            { key: "gift-cards",     label: "Gift Cards",        content: <AdminGiftCards /> },
            { key: "guides",         label: "Playbooks Store",   content: <AdminGuideStore /> },
            { key: "affiliates",     label: "Affiliates",        content: <AdminAffiliateManager /> },
            { key: "referrals",      label: "Referrals",         content: <AdminReferrals /> },
            { key: "legal",          label: "Legal",             content: <AdminLegalCompliance /> },
            { key: "trash",          label: badgeLabel("🗑 Trash", trashCount), content: <AdminTrash /> },
          ]} />
        )}

        {activeTab === "content" && (
          <SubTabs helpId="content" tabs={[
            { key: "front-page",     label: "Front Page",         content: <AdminFrontPage /> },
            { key: "site",           label: "Site Editor",        content: <AdminSiteEditor /> },
            { key: "testimonials",   label: "Testimonials",       content: <AdminTestimonials /> },
            { key: "learn",          label: "Learn Hub",          content: <AdminLearnEditor /> },
            { key: "broadcasts",     label: "Broadcasts",         content: <AdminBroadcasts /> },
            { key: "subscribers",    label: "Subscribers",        content: <AdminSubscriberList /> },
            { key: "compose",        label: "Compose",            content: <AdminNewsletterComposer /> },
            { key: "training-newsletter", label: "🏋️ Training NL", content: <AdminTrainingNewsletter /> },
            { key: "history",        label: "Send History",       content: <AdminSendHistory /> },
            { key: "marketing-ai",   label: "Marketing & AI",     content: (
              <div className="space-y-8">
                <AdminMarketingDrafts />
                <div className="border-t border-border pt-6"><AdminAiBusinessTools /></div>
              </div>
            )},
            { key: "cmo",            label: "CMO Reports",        content: <AdminCmoReports /> },
            { key: "media-vault",    label: "Media Vault",        content: <AdminMediaVault /> },
            { key: "seo",            label: "SEO Engine",         content: <AdminSeoGenerator /> },
          ]} />
        )}

        {activeTab === "growth" && (
          <SubTabs helpId="growth" defaultTab="m2-hub" tabs={[
            { key: "m2-hub",       label: "🚀 M² Hub",          content: <AdminM2GrowthHub /> },
            { key: "ad-campaigns", label: "⚡ Ad Campaigns",    content: <AdminAdCampaigns /> },
            { key: "outreach",     label: "Outreach",           content: <AdminOutreach /> },
            { key: "seo-pages",    label: "SEO Pages",          content: <AdminSeoPages /> },
            { key: "search",       label: "📊 Search Console",  content: <AdminSearchConsole /> },
            { key: "gbp",          label: "GBP Posts",          content: <AdminGbpPosts /> },
            { key: "instagram",    label: "Instagram",          content: <AdminInstagramPosts /> },
            { key: "content-gen",  label: "Content Gen",        content: <AdminContentGenerator /> },
          ]} />
        )}

        {activeTab === "webdesign" && (
          <SubTabs helpId="webdesign" defaultTab="pipeline" tabs={[
            { key: "pipeline",      label: "B2B Pipeline",      content: <AdminB2BPipeline /> },
            { key: "agency-crm",    label: "Agency CRM",        content: <AdminAgencyCRM /> },
            { key: "crm",           label: "Web Design CRM",    content: <AdminWebDesignCRM /> },
            { key: "site-builder",  label: "Site Builder",      content: <AdminSiteBuilder /> },
            { key: "prospector",    label: "Prospector",        content: <AdminProspector /> },
            { key: "automation",    label: "Automation Hub",    content: <AdminAutomationHub /> },
            { key: "wd-automations",label: "Email Automations", content: <AdminWebDesignAutomations /> },
            { key: "demo-links",    label: "🔗 Demo Links",     content: <AdminDemoLinkGenerator /> },
          ]} />
        )}
      </div>

      {/* ── Mobile bottom nav bar ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border md:hidden">
        {/* Two rows of 5 and 4 (or scroll) */}
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
                    "relative flex flex-col items-center gap-0.5 px-3 py-2 rounded transition-all min-w-[56px]",
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
