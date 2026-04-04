import { useState, useEffect, lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import AppNavbar from "@/components/layout/AppNavbar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Users, Dumbbell, DollarSign, Megaphone, Globe,
  Activity, AlertTriangle, CheckCircle, Mail, Zap, ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

/* ── Main Admin Component ───────────────────────────────────────────────────── */
const Admin = () => {
  const [activeTool, setActiveTool] = useState<string>("home");
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
  const domains: Domain[] = [
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
  ];

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

      <SidebarProvider defaultOpen={true}>
        <div className="flex w-full pt-16">
          {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
          <Sidebar collapsible="icon" className="border-r border-border/30 pt-16 z-30">
            <SidebarContent className="pt-2 pb-20">
              {/* Oz Status */}
              <div className="px-3 py-2">
                <div
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                  style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)" }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                  <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider group-data-[collapsible=icon]:hidden">
                    Oz Online
                  </span>
                  <Activity size={10} className="text-green-500/40 ml-auto shrink-0 group-data-[collapsible=icon]:hidden" />
                </div>
              </div>

              {domains.map((domain) => {
                const Icon = domain.icon;
                const domainBadge = domain.tools.reduce((sum, t) => sum + (t.badge ?? 0), 0);
                const isActiveDomain = currentDomain?.key === domain.key;

                return (
                  <Collapsible key={domain.key} defaultOpen={isActiveDomain || domain.key === "actions"}>
                    <SidebarGroup>
                      <CollapsibleTrigger asChild>
                        <SidebarGroupLabel className="cursor-pointer hover:bg-muted/30 rounded-md transition flex items-center gap-2 px-3 py-1.5">
                          <Icon size={13} style={{ color: domain.color }} className="shrink-0" />
                          <span className="flex-1 text-left text-[11px] group-data-[collapsible=icon]:hidden">{domain.label}</span>
                          {domainBadge > 0 && (
                            <Badge variant="destructive" className="text-[7px] px-1 py-0 h-3.5 group-data-[collapsible=icon]:hidden">
                              {domainBadge}
                            </Badge>
                          )}
                          <ChevronDown size={10} className="text-muted-foreground transition-transform group-data-[collapsible=icon]:hidden [&[data-state=open]>svg]:rotate-180" />
                        </SidebarGroupLabel>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarGroupContent>
                          <SidebarMenu>
                            {domain.tools.map((tool) => (
                              <SidebarMenuItem key={tool.key}>
                                <SidebarMenuButton
                                  onClick={() => setActiveTool(tool.key)}
                                  isActive={activeTool === tool.key}
                                  className="text-[11px] py-1.5 h-auto"
                                >
                                  <span className="flex-1 truncate">{tool.label}</span>
                                  {(tool.badge ?? 0) > 0 && (
                                    <Badge variant="destructive" className="text-[7px] px-1 py-0 h-3.5 ml-auto">
                                      {tool.badge}
                                    </Badge>
                                  )}
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </SidebarGroupContent>
                      </CollapsibleContent>
                    </SidebarGroup>
                  </Collapsible>
                );
              })}
            </SidebarContent>
          </Sidebar>

          {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            <div className="max-w-5xl mx-auto px-4 py-4">
              {/* Top bar: toggle + title + test email */}
              <div className="flex items-center gap-3 mb-4">
                <SidebarTrigger className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <h1 className="text-sm font-bold text-foreground truncate">
                    {activeTool === "home" ? "Mission Control" : currentTool?.label ?? "Mission Control"}
                  </h1>
                  {currentDomain && activeTool !== "home" && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {currentDomain.label} → {currentTool?.label}
                    </p>
                  )}
                </div>
                <Button
                  size="sm" variant="ghost"
                  onClick={sendTestEmail}
                  disabled={testEmailState === "sending"}
                  className="text-[10px] text-muted-foreground h-7 px-2 shrink-0"
                >
                  {testEmailState === "sending" && <Loader2 size={10} className="animate-spin mr-1" />}
                  {testEmailState === "sent" && <CheckCircle size={10} className="text-green-400 mr-1" />}
                  {testEmailState === "error" && <AlertTriangle size={10} className="text-red-400 mr-1" />}
                  {testEmailState === "idle" && <Mail size={10} className="mr-1" />}
                  {testEmailState === "idle" ? "Test" : testEmailState === "sending" ? "…" : testEmailState === "sent" ? "✓" : "✗"}
                </Button>
              </div>

              {/* AI Bar (always visible) */}
              <div className="mb-6">
                <Suspense fallback={<div className="h-12 rounded-2xl bg-muted/10 animate-pulse" />}>
                  <AdminAiBar />
                </Suspense>
              </div>

              {/* Content */}
              {activeTool === "home" ? (
                <div className="space-y-6">
                  {/* Dashboard home: quick stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "AI Queue", value: b.aiQueue, color: "#f97316" },
                      { label: "Support", value: b.support, color: "#3b82f6" },
                      { label: "Coach AI", value: b.drafts, color: "#a855f7" },
                      { label: "Custom Req", value: b.custom, color: "#22c55e" },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl p-4 text-center"
                        style={{ background: `${stat.color}08`, border: `1px solid ${stat.color}15` }}
                      >
                        <p className="text-2xl font-black text-foreground">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Oz status */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Agent Oz — Online</span>
                      <p className="text-[9px] text-muted-foreground">Monitoring all systems · Auto-fixing issues · Generating reports</p>
                    </div>
                    <Activity size={14} className="text-green-500/50 shrink-0" />
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    Pick a tool from the sidebar to get started. Oz is watching everything.
                  </p>
                </div>
              ) : currentTool ? (
                <Suspense fallback={<TabLoader />}>
                  {currentTool.component}
                </Suspense>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Tool not found.</p>
              )}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default Admin;
