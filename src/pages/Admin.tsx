import { useState, lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import AppNavbar from "@/components/layout/AppNavbar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, Dumbbell, Landmark, FileText, Trash2, ClipboardList, Megaphone, Bot, Globe, DollarSign, Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

/* ── Lazy-load ALL admin sub-components ─────────── */
const AdminClientList = lazy(() => import("@/components/admin/AdminClientList"));
const AdminSupportCopilot = lazy(() => import("@/components/admin/AdminSupportCopilot"));
const AdminFamilyManager = lazy(() => import("@/components/admin/AdminFamilyManager"));
const AdminTeamRosters = lazy(() => import("@/components/admin/AdminTeamRosters"));
const AdminParentReports = lazy(() => import("@/components/admin/AdminParentReports"));
const AdminParentInbox = lazy(() => import("@/components/admin/AdminParentInbox"));
const AdminCoachInbox = lazy(() => import("@/components/admin/AdminCoachInbox"));
const AdminPostureRequests = lazy(() => import("@/components/admin/AdminPostureRequests"));
const AdminCoachDashboard = lazy(() => import("@/components/admin/AdminCoachDashboard"));
const AdminDirectMessages = lazy(() => import("@/components/admin/AdminDirectMessages"));
const AdminVideoReview = lazy(() => import("@/components/admin/AdminVideoReview"));
const AdminTrialSettings = lazy(() => import("@/components/admin/AdminTrialSettings"));
const AdminClientOnboarding = lazy(() => import("@/components/admin/AdminClientOnboarding"));
const AdminChurnRadar = lazy(() => import("@/components/admin/AdminChurnRadar"));
const AdminSchedule = lazy(() => import("@/components/admin/AdminSchedule"));
const AdminVipAccess = lazy(() => import("@/components/admin/AdminVipAccess"));

const AdminPrograms = lazy(() => import("@/components/admin/AdminPrograms"));
const AdminExerciseLibrary = lazy(() => import("@/components/admin/AdminExerciseLibrary"));
const AdminWorkoutInventory = lazy(() => import("@/components/admin/AdminWorkoutInventory"));
const AdminBatchGenerator = lazy(() => import("@/components/admin/AdminBatchGenerator"));
const AdminExerciseGenerator = lazy(() => import("@/components/admin/AdminExerciseGenerator"));
const AdminProgramCreator = lazy(() => import("@/components/admin/AdminProgramCreator"));
const AdminAiQueue = lazy(() => import("@/components/admin/AdminAiQueue"));
const AdminRecoveryHeatmap = lazy(() => import("@/components/admin/AdminRecoveryHeatmap"));
const AdminMonthlyFocus = lazy(() => import("@/components/admin/AdminMonthlyFocus"));
const AdminBiomechanics = lazy(() => import("@/components/admin/AdminBiomechanics"));
const AdminAiToolkit = lazy(() => import("@/components/admin/AdminAiToolkit"));
const AdminCoachAiQueue = lazy(() => import("@/components/admin/AdminCoachAiQueue"));
const AdminCustomRequests = lazy(() => import("@/components/admin/AdminCustomRequests"));
const AdminUserGeneratedWorkouts = lazy(() => import("@/components/admin/AdminUserGeneratedWorkouts"));

const AdminFinancials = lazy(() => import("@/components/admin/AdminFinancials"));
const AdminPromotions = lazy(() => import("@/components/admin/AdminPromotions"));
const AdminPointsManager = lazy(() => import("@/components/admin/AdminPointsManager"));
const AdminTierManager = lazy(() => import("@/components/admin/AdminTierManager"));
const AdminSystemSettings = lazy(() => import("@/components/admin/AdminSystemSettings"));
const AdminStripeProducts = lazy(() => import("@/components/admin/AdminStripeProducts"));
const AdminServiceCatalog = lazy(() => import("@/components/admin/AdminServiceCatalog"));

const AdminFrontPage = lazy(() => import("@/components/admin/AdminFrontPage"));
const AdminSiteEditor = lazy(() => import("@/components/admin/AdminSiteEditor"));
const AdminTestimonials = lazy(() => import("@/components/admin/AdminTestimonials"));
const AdminLearnEditor = lazy(() => import("@/components/admin/AdminLearnEditor"));
const AdminBroadcasts = lazy(() => import("@/components/admin/AdminBroadcasts"));
const AdminSubscriberList = lazy(() => import("@/components/admin/AdminSubscriberList"));
const AdminNewsletterComposer = lazy(() => import("@/components/admin/AdminNewsletterComposer"));
const AdminSendHistory = lazy(() => import("@/components/admin/AdminSendHistory"));
const AdminMarketingDrafts = lazy(() => import("@/components/admin/AdminMarketingDrafts"));
const AdminAiBusinessTools = lazy(() => import("@/components/admin/AdminAiBusinessTools"));
const AdminCmoReports = lazy(() => import("@/components/admin/AdminCmoReports"));
const AdminTrash = lazy(() => import("@/components/admin/AdminTrash"));
const AdminMediaVault = lazy(() => import("@/components/admin/AdminMediaVault"));
const AdminProgressLogger = lazy(() => import("@/components/admin/AdminProgressLogger"));
const AdminLiftVideoReview = lazy(() => import("@/components/admin/AdminLiftVideoReview"));
const AdminProveItReview = lazy(() => import("@/components/admin/AdminProveItReview"));
const AdminSeoGenerator = lazy(() => import("@/components/admin/AdminSeoGenerator"));
const AdminOutreach = lazy(() => import("@/components/admin/AdminOutreach"));
const AdminSeoPages = lazy(() => import("@/components/admin/AdminSeoPages"));
const AdminSearchConsole = lazy(() => import("@/components/admin/AdminSearchConsole"));
const AdminGbpPosts = lazy(() => import("@/components/admin/AdminGbpPosts"));
const AdminInstagramPosts = lazy(() => import("@/components/admin/AdminInstagramPosts"));
const AdminContentGenerator = lazy(() => import("@/components/admin/AdminContentGenerator"));
const UserActivityFeed = lazy(() => import("@/components/admin/UserActivityFeed"));
const AdminAiCommandCenter = lazy(() => import("@/components/admin/AdminAiCommandCenter"));
const AdminImageMatcher = lazy(() => import("@/components/admin/AdminImageMatcher"));
const AdminWebDesignCRM = lazy(() => import("@/components/admin/AdminWebDesignCRM"));
const AdminAgencyCRM = lazy(() => import("@/components/admin/AdminAgencyCRM"));
const AdminDemoLinkGenerator = lazy(() => import("@/components/admin/AdminDemoLinkGenerator"));
const AdminProspector = lazy(() => import("@/components/admin/AdminProspector"));
const AdminAutomationHub = lazy(() => import("@/components/admin/AdminAutomationHub"));
const AdminSiteBuilder = lazy(() => import("@/components/admin/AdminSiteBuilder"));
const AdminM2GrowthHub = lazy(() => import("@/components/admin/AdminM2GrowthHub"));
const AdminAdCampaigns = lazy(() => import("@/components/admin/AdminAdCampaigns"));
const AdminWebDesignAutomations = lazy(() => import("@/components/admin/AdminWebDesignAutomations"));
const AdminClientHealth = lazy(() => import("@/components/admin/AdminClientHealth"));
const AdminGiftCards = lazy(() => import("@/components/admin/AdminGiftCards"));
const AdminGuideStore = lazy(() => import("@/components/admin/AdminGuideStore"));
const AdminAffiliateManager = lazy(() => import("@/components/admin/AdminAffiliateManager"));
const AdminBusinessDashboard = lazy(() => import("@/components/admin/AdminBusinessDashboard"));
const AdminB2BPipeline = lazy(() => import("@/components/admin/AdminB2BPipeline"));
const AdminSocialMediaOnboarding = lazy(() => import("@/components/admin/AdminSocialMediaOnboarding"));
const AdminLegalCompliance = lazy(() => import("@/components/admin/AdminLegalCompliance"));
const AdminOpsCenter = lazy(() => import("@/components/admin/AdminOpsCenter"));
const AdminEmailLog = lazy(() => import("@/components/admin/AdminEmailLog"));
const AdminMigrations = lazy(() => import("@/components/admin/AdminMigrations"));
const AdminReferrals = lazy(() => import("@/components/admin/AdminReferrals"));

const MASTER_TABS = [
  { key: "business", label: "Business", icon: DollarSign, desc: "Revenue · Automation" },
  { key: "ai", label: "AI Center", icon: Bot, desc: "All AI · One Place" },
  { key: "roster", label: "The Roster", icon: Users, desc: "Users · Support · Families" },
  { key: "engine", label: "Training Engine", icon: Dumbbell, desc: "Programs · AI · Coaching" },
  { key: "vault", label: "The Vault", icon: Landmark, desc: "Revenue · Business" },
  { key: "content", label: "Site Content", icon: FileText, desc: "CMS · Comms · Marketing" },
  { key: "growth", label: "Growth", icon: Megaphone, desc: "Outreach · SEO · GBP" },
  { key: "webdesign", label: "Web Design", icon: Globe, desc: "Leads · Projects · CRM" },
];

const TabLoader = () => (
  <div className="flex justify-center py-12">
    <Loader2 size={20} className="text-primary animate-spin" />
  </div>
);

const SubTabs = ({ tabs, defaultTab }: { tabs: { key: string; label: string | React.ReactNode; content: React.ReactNode }[]; defaultTab?: string }) => (
  <Tabs defaultValue={defaultTab || tabs[0].key} className="w-full">
    <TabsList className="bg-muted/50 h-auto flex-wrap gap-0.5 mb-4">
      {tabs.map((t) => (
        <TabsTrigger key={t.key} value={t.key} className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          {t.label}
        </TabsTrigger>
      ))}
    </TabsList>
    {tabs.map((t) => (
      <TabsContent key={t.key} value={t.key} className="mt-0">
        <Suspense fallback={<TabLoader />}>
          {t.content}
        </Suspense>
      </TabsContent>
    ))}
  </Tabs>
);

const Admin = () => {
  const [activeTab, setActiveTab] = useState("business");
  const [testEmailState, setTestEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const { isAdmin, isLoading } = useIsAdmin();

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

  const { data: pendingDraftsCount = 0 } = useQuery({
    queryKey: ["pending-coach-drafts-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("coach_ai_drafts")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: pendingAiQueueCount = 0 } = useQuery({
    queryKey: ["pending-ai-queue-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("ai_action_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: pendingSupportCount = 0 } = useQuery({
    queryKey: ["pending-support-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      return count ?? 0;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: unreadParentCount = 0 } = useQuery({
    queryKey: ["unread-parent-inbox-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("parent_inbox")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false)
        .eq("is_deleted", false);
      return count ?? 0;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: pendingPostureCount = 0 } = useQuery({
    queryKey: ["pending-posture-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("posture_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: pendingCustomCount = 0 } = useQuery({
    queryKey: ["pending-custom-requests-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("custom_program_requests" as any)
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "ready_for_review"]);
      return count ?? 0;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: pendingLiftVideosCount = 0 } = useQuery({
    queryKey: ["pending-lift-videos-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("lift_videos" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review");
      return count ?? 0;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: pendingProveItCount = 0 } = useQuery({
    queryKey: ["pending-prove-it-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("pr_submissions" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const totalEngineBadge = pendingDraftsCount + pendingAiQueueCount + pendingCustomCount + pendingLiftVideosCount + pendingProveItCount;
  const totalRosterBadge = pendingSupportCount + unreadParentCount + pendingPostureCount;

  const { data: trashCount = 0 } = useQuery({
    queryKey: ["admin-trash-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("admin_trash" as any)
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

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
      <div className="container pt-20 pb-12">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-foreground tracking-display">Command Center</h1>
          <p className="text-xs text-muted-foreground">Manage everything from one place</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
          {MASTER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-col items-center gap-1.5 px-4 py-4 transition-all border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                }`}
              >
                <div className="relative">
                  <Icon size={18} />
                  {tab.key === "engine" && totalEngineBadge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {totalEngineBadge}
                    </span>
                  )}
                  {tab.key === "roster" && totalRosterBadge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {totalRosterBadge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
                <span className={`text-[9px] ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {tab.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── BUSINESS DASHBOARD ── */}
        {activeTab === "business" && (
          <>
          <div className="flex justify-end mb-2">
            <Button
              size="sm"
              variant="outline"
              onClick={sendTestEmail}
              disabled={testEmailState === "sending"}
              className="text-xs gap-1.5 border-slate-600 text-slate-300 hover:text-white"
            >
              {testEmailState === "sending" && <Loader2 size={12} className="animate-spin" />}
              {testEmailState === "sent" && <CheckCircle size={12} className="text-green-400" />}
              {testEmailState === "error" && <Mail size={12} className="text-red-400" />}
              {testEmailState === "idle" && <Mail size={12} />}
              {testEmailState === "idle" && "Send Test Email"}
              {testEmailState === "sending" && "Sending…"}
              {testEmailState === "sent" && "Sent! Check gmail"}
              {testEmailState === "error" && "Failed — check Resend"}
            </Button>
          </div>
          <SubTabs tabs={[
            { key: "overview", label: "Overview", content: <AdminBusinessDashboard /> },
            { key: "health", label: "Client Health", content: <AdminClientHealth /> },
            { key: "ops", label: "Ops Center", content: <AdminOpsCenter /> },
            { key: "pipeline", label: "Pipeline", content: <AdminB2BPipeline /> },
            { key: "social-setup", label: "Social Media Setup", content: <AdminSocialMediaOnboarding /> },
            { key: "email-log", label: "📧 Email Log", content: <AdminEmailLog /> },
            { key: "migrations", label: "DB Migrations", content: <AdminMigrations /> },
          ]} />
          </>
        )}

        {/* ── AI COMMAND CENTER ── */}
        {activeTab === "ai" && (
          <Suspense fallback={<TabLoader />}>
            <AdminAiCommandCenter />
          </Suspense>
        )}

        {/* ── THE ROSTER ── */}
        {activeTab === "roster" && (
          <SubTabs tabs={[
            { key: "athletes", label: "All Users", content: <AdminClientList /> },
            { key: "activity", label: "Activity Feed", content: <UserActivityFeed /> },
            { key: "support", label: <span className="flex items-center gap-1">Support Tickets{pendingSupportCount > 0 && <Badge variant="destructive" className="text-[8px] px-1.5 py-0 min-w-[18px] h-4">{pendingSupportCount}</Badge>}</span>, content: <AdminSupportCopilot /> },
            { key: "coaching", label: <span className="flex items-center gap-1">Coach Review{pendingPostureCount > 0 && <Badge variant="destructive" className="text-[8px] px-1.5 py-0 min-w-[18px] h-4">{pendingPostureCount}</Badge>}</span>, content: (
              <div className="space-y-8">
                <AdminCoachInbox />
                <div className="border-t border-border pt-6"><AdminCoachDashboard /></div>
                <div className="border-t border-border pt-6"><AdminPostureRequests /></div>
                <div className="border-t border-border pt-6"><AdminVideoReview /></div>
              </div>
            )},
            { key: "messages", label: "Messages", content: <AdminDirectMessages /> },
            { key: "families", label: "Families & Teams", content: (
              <div className="space-y-8">
                <AdminFamilyManager />
                <div className="border-t border-border pt-6"><AdminTeamRosters /></div>
              </div>
            )},
            { key: "parents", label: <span className="flex items-center gap-1">Parent Hub{unreadParentCount > 0 && <Badge variant="destructive" className="text-[8px] px-1.5 py-0 min-w-[18px] h-4">{unreadParentCount}</Badge>}</span>, content: (
              <div className="space-y-8">
                <AdminParentInbox />
                <div className="border-t border-border pt-6"><AdminParentReports /></div>
              </div>
            )},
            { key: "onboarding", label: "Onboarding & Trials", content: (
              <div className="space-y-8">
                <AdminClientOnboarding />
                <div className="border-t border-border pt-6"><AdminTrialSettings /></div>
              </div>
            )},
            { key: "schedule", label: "Schedule", content: <AdminSchedule /> },
            { key: "vip", label: "VIP Access", content: <AdminVipAccess /> },
          ]} />
        )}

        {/* ── TRAINING ENGINE ── */}
        {activeTab === "engine" && (
          <SubTabs tabs={[
            { key: "log-lifts", label: <span className="flex items-center gap-1"><ClipboardList size={11} /> Log Lifts</span>, content: <AdminProgressLogger /> },
            { key: "programs", label: "Programs", content: <AdminPrograms /> },
            { key: "exercises", label: "Exercise Library", content: <AdminExerciseLibrary /> },
            { key: "image-matcher", label: "Image Matcher", content: <AdminImageMatcher /> },
            { key: "workouts", label: "Workouts", content: <AdminWorkoutInventory /> },
            { key: "batch", label: "AI Workouts", content: <AdminBatchGenerator /> },
            { key: "user-generated", label: "User Generated", content: <AdminUserGeneratedWorkouts /> },
            { key: "exercise-gen", label: "AI Exercises", content: <AdminExerciseGenerator /> },
            { key: "ai-programs", label: "AI Programs", content: <AdminProgramCreator /> },
            { key: "ai-queue", label: <span className="flex items-center gap-1">AI Queue{pendingAiQueueCount > 0 && <Badge variant="destructive" className="text-[8px] px-1.5 py-0 min-w-[18px] h-4">{pendingAiQueueCount}</Badge>}</span>, content: <AdminAiQueue /> },
            { key: "ai-toolkit", label: "AI Toolkit", content: <AdminAiToolkit /> },
            { key: "recovery", label: "Recovery Map", content: <AdminRecoveryHeatmap /> },
            { key: "monthly", label: "Monthly Focus", content: <AdminMonthlyFocus /> },
            { key: "biomechanics", label: "Biomechanics", content: <AdminBiomechanics /> },
            { key: "coach-ai", label: <span className="flex items-center gap-1">Coach AI{pendingDraftsCount > 0 && <Badge variant="destructive" className="text-[8px] px-1.5 py-0 min-w-[18px] h-4">{pendingDraftsCount}</Badge>}</span>, content: <AdminCoachAiQueue /> },
            { key: "custom-requests", label: <span className="flex items-center gap-1">Custom Requests{pendingCustomCount > 0 && <Badge variant="destructive" className="text-[8px] px-1.5 py-0 min-w-[18px] h-4">{pendingCustomCount}</Badge>}</span>, content: <AdminCustomRequests /> },
            { key: "lift-videos", label: <span className="flex items-center gap-1">Lift Videos{pendingLiftVideosCount > 0 && <Badge variant="destructive" className="text-[8px] px-1.5 py-0 min-w-[18px] h-4">{pendingLiftVideosCount}</Badge>}</span>, content: <AdminLiftVideoReview /> },
            { key: "prove-it", label: <span className="flex items-center gap-1">Prove It{pendingProveItCount > 0 && <Badge variant="destructive" className="text-[8px] px-1.5 py-0 min-w-[18px] h-4">{pendingProveItCount}</Badge>}</span>, content: <AdminProveItReview /> },
          ]} />
        )}

        {/* ── THE VAULT ── */}
        {activeTab === "vault" && (
          <SubTabs tabs={[
            { key: "revenue", label: "Revenue & Ledger", content: <AdminFinancials /> },
            { key: "promotions", label: "Promotions", content: <AdminPromotions /> },
            { key: "points", label: "Points", content: <AdminPointsManager /> },
            { key: "tiers", label: "Tier Access", content: <AdminTierManager /> },
            { key: "system", label: "System & Referrals", content: <AdminSystemSettings /> },
            { key: "stripe-products", label: "Stripe Products", content: <AdminStripeProducts /> },
            { key: "churn", label: "Churn Radar", content: <AdminChurnRadar /> },
            { key: "catalog", label: "Service Catalog", content: <AdminServiceCatalog /> },
            { key: "gift-cards", label: "Gift Cards", content: <AdminGiftCards /> },
            { key: "guides", label: "Playbooks Store", content: <AdminGuideStore /> },
            { key: "affiliates", label: "Affiliates", content: <AdminAffiliateManager /> },
            { key: "referrals", label: "Referrals", content: <AdminReferrals /> },
            { key: "legal", label: "Legal & Compliance", content: <AdminLegalCompliance /> },
            { key: "trash", label: <span className="flex items-center gap-1"><Trash2 size={11} /> Trash{trashCount > 0 && <Badge variant="secondary" className="text-[8px] px-1.5 py-0 min-w-[18px] h-4">{trashCount}</Badge>}</span>, content: <AdminTrash /> },
          ]} />
        )}

        {/* ── SITE CONTENT ── */}
        {activeTab === "content" && (
          <SubTabs tabs={[
            { key: "front-page", label: "Front Page", content: <AdminFrontPage /> },
            { key: "site", label: "Site Editor", content: <AdminSiteEditor /> },
            { key: "testimonials", label: "Testimonials", content: <AdminTestimonials /> },
            { key: "learn", label: "Learn Hub", content: <AdminLearnEditor /> },
            { key: "broadcasts", label: "Broadcasts", content: <AdminBroadcasts /> },
            { key: "subscribers", label: "Subscribers", content: <AdminSubscriberList /> },
            { key: "compose", label: "Compose", content: <AdminNewsletterComposer /> },
            { key: "history", label: "Send History", content: <AdminSendHistory /> },
            { key: "marketing-ai", label: "Marketing & AI", content: (
              <div className="space-y-8">
                <AdminMarketingDrafts />
                <div className="border-t border-border pt-6"><AdminAiBusinessTools /></div>
              </div>
            )},
            { key: "cmo", label: "CMO Reports", content: <AdminCmoReports /> },
            { key: "media-vault", label: "Media Vault", content: <AdminMediaVault /> },
            { key: "seo", label: "SEO Engine", content: <AdminSeoGenerator /> },
          ]} />
        )}

        {/* ── GROWTH ── */}
        {activeTab === "growth" && (
          <SubTabs tabs={[
            { key: "m2-hub", label: "🚀 M² Self-Service", content: <AdminM2GrowthHub /> },
            { key: "ad-campaigns", label: "⚡ Ad Campaigns", content: <AdminAdCampaigns /> },
            { key: "outreach", label: "Outreach", content: <AdminOutreach /> },
            { key: "seo-pages", label: "SEO Pages", content: <AdminSeoPages /> },
            { key: "search-console", label: "📊 Search Console", content: <AdminSearchConsole /> },
            { key: "gbp", label: "GBP Posts", content: <AdminGbpPosts /> },
            { key: "instagram", label: "Instagram", content: <AdminInstagramPosts /> },
            { key: "content-gen", label: "Content Generator", content: <AdminContentGenerator /> },
          ]} defaultTab="m2-hub" />
        )}

        {/* ── WEB DESIGN ── */}
        {activeTab === "webdesign" && (
          <SubTabs tabs={[
            { key: "fulfillment", label: "Agency CRM", content: <AdminAgencyCRM /> },
            { key: "pipeline", label: "B2B Pipeline", content: <AdminB2BPipeline /> },
            { key: "crm", label: "Web Design CRM", content: <AdminWebDesignCRM /> },
            { key: "site-builder", label: "Site Builder", content: <AdminSiteBuilder /> },
            { key: "prospector", label: "Prospector", content: <AdminProspector /> },
            { key: "automation", label: "Automation Hub", content: <AdminAutomationHub /> },
            { key: "client-health", label: "Client Health", content: <AdminClientHealth /> },
            { key: "ops-center", label: "Ops Center", content: <AdminOpsCenter /> },
            { key: "wd-automations", label: "Email Automations", content: <AdminWebDesignAutomations /> },
            { key: "demo-links", label: "🔗 Demo Links", content: <AdminDemoLinkGenerator /> },
          ]} defaultTab="pipeline" />
        )}
      </div>
    </div>
  );
};

export default Admin;
