import { useState, lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, Dumbbell, Landmark, FileText, Trash2 } from "lucide-react";
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

const AdminPrograms = lazy(() => import("@/components/admin/AdminPrograms"));
const AdminExerciseLibrary = lazy(() => import("@/components/admin/AdminExerciseLibrary"));
const AdminProtocols = lazy(() => import("@/components/admin/AdminProtocols"));
const AdminBatchGenerator = lazy(() => import("@/components/admin/AdminBatchGenerator"));
const AdminExerciseGenerator = lazy(() => import("@/components/admin/AdminExerciseGenerator"));
const AdminProgramCreator = lazy(() => import("@/components/admin/AdminProgramCreator"));
const AdminAiQueue = lazy(() => import("@/components/admin/AdminAiQueue"));
const AdminRecoveryHeatmap = lazy(() => import("@/components/admin/AdminRecoveryHeatmap"));
const AdminMonthlyFocus = lazy(() => import("@/components/admin/AdminMonthlyFocus"));
const AdminBiomechanics = lazy(() => import("@/components/admin/AdminBiomechanics"));
const AdminAiToolkit = lazy(() => import("@/components/admin/AdminAiToolkit"));
const AdminCoachAiQueue = lazy(() => import("@/components/admin/AdminCoachAiQueue"));

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

const MASTER_TABS = [
  { key: "roster", label: "The Roster", icon: Users, desc: "Users · Support · Families" },
  { key: "engine", label: "Training Engine", icon: Dumbbell, desc: "Programs · AI · Coaching" },
  { key: "vault", label: "The Vault", icon: Landmark, desc: "Revenue · Business" },
  { key: "content", label: "Site Content", icon: FileText, desc: "CMS · Comms · Marketing" },
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
  const [activeTab, setActiveTab] = useState("roster");
  const { isAdmin, isLoading } = useIsAdmin();

  const { data: pendingDraftsCount = 0 } = useQuery({
    queryKey: ["pending-coach-drafts-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("coach_ai_drafts")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const { data: trashCount = 0 } = useQuery({
    queryKey: ["admin-trash-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("admin_trash" as any)
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
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
                  {tab.key === "engine" && pendingDraftsCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {pendingDraftsCount}
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

        {/* ── THE ROSTER ── */}
        {activeTab === "roster" && (
          <SubTabs tabs={[
            { key: "athletes", label: "All Users", content: <AdminClientList /> },
            { key: "support", label: "Support Tickets", content: <AdminSupportCopilot /> },
            { key: "coaching", label: "Coach Review", content: (
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
            { key: "parents", label: "Parent Hub", content: (
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
          ]} />
        )}

        {/* ── TRAINING ENGINE ── */}
        {activeTab === "engine" && (
          <SubTabs tabs={[
            { key: "programs", label: "Programs", content: <AdminPrograms /> },
            { key: "exercises", label: "Exercise Library", content: <AdminExerciseLibrary /> },
            { key: "protocols", label: "Protocols", content: <AdminProtocols /> },
            { key: "batch", label: "AI Workouts", content: <AdminBatchGenerator /> },
            { key: "exercise-gen", label: "AI Exercises", content: <AdminExerciseGenerator /> },
            { key: "ai-programs", label: "AI Programs", content: <AdminProgramCreator /> },
            { key: "ai-queue", label: "AI Queue", content: <AdminAiQueue /> },
            { key: "ai-toolkit", label: "AI Toolkit", content: <AdminAiToolkit /> },
            { key: "recovery", label: "Recovery Map", content: <AdminRecoveryHeatmap /> },
            { key: "monthly", label: "Monthly Focus", content: <AdminMonthlyFocus /> },
            { key: "biomechanics", label: "Biomechanics", content: <AdminBiomechanics /> },
            { key: "coach-ai", label: <span className="flex items-center gap-1">Coach AI{pendingDraftsCount > 0 && <Badge variant="destructive" className="text-[8px] px-1.5 py-0 min-w-[18px] h-4">{pendingDraftsCount}</Badge>}</span>, content: <AdminCoachAiQueue /> },
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
          ]} />
        )}
      </div>
    </div>
  );
};

export default Admin;
