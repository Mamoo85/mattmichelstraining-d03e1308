import { useState } from "react";
import { Navigate } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Loader2, Users, Dumbbell, Landmark, FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* ── Tab 1: The Roster ─────────────────────────────── */
import AdminClientList from "@/components/admin/AdminClientList";
import AdminSupportCopilot from "@/components/admin/AdminSupportCopilot";
import AdminFamilyManager from "@/components/admin/AdminFamilyManager";
import AdminTeamRosters from "@/components/admin/AdminTeamRosters";
import AdminParentReports from "@/components/admin/AdminParentReports";
import AdminParentInbox from "@/components/admin/AdminParentInbox";
import AdminCoachInbox from "@/components/admin/AdminCoachInbox";
import AdminCoachDashboard from "@/components/admin/AdminCoachDashboard";
import AdminDirectMessages from "@/components/admin/AdminDirectMessages";
import AdminVideoReview from "@/components/admin/AdminVideoReview";
import AdminTrialSettings from "@/components/admin/AdminTrialSettings";
import AdminClientOnboarding from "@/components/admin/AdminClientOnboarding";
import AdminChurnRadar from "@/components/admin/AdminChurnRadar";

/* ── Tab 2: The Training Engine ────────────────────── */
import AdminPrograms from "@/components/admin/AdminPrograms";
import AdminExerciseLibrary from "@/components/admin/AdminExerciseLibrary";
import AdminProtocols from "@/components/admin/AdminProtocols";
import AdminBatchGenerator from "@/components/admin/AdminBatchGenerator";
import AdminProgramCreator from "@/components/admin/AdminProgramCreator";
import AdminAiQueue from "@/components/admin/AdminAiQueue";
import AdminAiCopilot from "@/components/admin/AdminAiCopilot";
import AdminRecoveryHeatmap from "@/components/admin/AdminRecoveryHeatmap";
import AdminSchedule from "@/components/admin/AdminSchedule";
import AdminMonthlyFocus from "@/components/admin/AdminMonthlyFocus";
import AdminBiomechanics from "@/components/admin/AdminBiomechanics";

/* ── Tab 3: The Vault ──────────────────────────────── */
import AdminFinancials from "@/components/admin/AdminFinancials";
import AdminPromotions from "@/components/admin/AdminPromotions";
import AdminPointsManager from "@/components/admin/AdminPointsManager";
import AdminTierManager from "@/components/admin/AdminTierManager";
import AdminSystemSettings from "@/components/admin/AdminSystemSettings";
import AdminStripeProducts from "@/components/admin/AdminStripeProducts";

/* ── Tab 4: Site Content ───────────────────────────── */
import AdminFrontPage from "@/components/admin/AdminFrontPage";
import AdminSiteEditor from "@/components/admin/AdminSiteEditor";
import AdminTestimonials from "@/components/admin/AdminTestimonials";
import AdminLearnEditor from "@/components/admin/AdminLearnEditor";
import AdminBroadcasts from "@/components/admin/AdminBroadcasts";
import AdminSubscriberList from "@/components/admin/AdminSubscriberList";
import AdminNewsletterComposer from "@/components/admin/AdminNewsletterComposer";
import AdminSendHistory from "@/components/admin/AdminSendHistory";

const MASTER_TABS = [
  { key: "roster", label: "The Roster", icon: Users, desc: "Users · Support · Families" },
  { key: "engine", label: "Training Engine", icon: Dumbbell, desc: "Programs · AI · Coaching" },
  { key: "vault", label: "The Vault", icon: Landmark, desc: "Financials · Billing" },
  { key: "content", label: "Site Content", icon: FileText, desc: "CMS · Comms · Learn" },
];

const SubTabs = ({ tabs, defaultTab }: { tabs: { key: string; label: string; content: React.ReactNode }[]; defaultTab?: string }) => (
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
        {t.content}
      </TabsContent>
    ))}
  </Tabs>
);

const Admin = () => {
  const [activeTab, setActiveTab] = useState("roster");
  const { isAdmin, isLoading } = useIsAdmin();

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
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-bold text-foreground tracking-display">Command Center</h1>
          <p className="text-xs text-muted-foreground">Manage everything from one place</p>
        </div>

        {/* 4 Master Tabs */}
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
                <Icon size={18} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
                <span className={`text-[9px] ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {tab.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: The Roster */}
        {activeTab === "roster" && (
          <SubTabs tabs={[
            { key: "athletes", label: "All Users", content: <AdminClientList /> },
            { key: "support", label: "Support Tickets", content: <AdminSupportCopilot /> },
            { key: "coaching", label: "Coach Review", content: (
              <div className="space-y-8">
                <AdminCoachInbox />
                <div className="border-t border-border pt-6"><AdminCoachDashboard /></div>
              </div>
            )},
            { key: "messages", label: "Messages", content: <AdminDirectMessages /> },
            { key: "videos", label: "Videos", content: <AdminVideoReview /> },
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
            { key: "trials", label: "Trial Settings", content: <AdminTrialSettings /> },
            { key: "onboarding", label: "Onboarding", content: <AdminClientOnboarding /> },
          ]} />
        )}

        {/* Tab 2: The Training Engine */}
        {activeTab === "engine" && (
          <SubTabs tabs={[
            { key: "programs", label: "Programs", content: <AdminPrograms /> },
            { key: "exercises", label: "Exercise Library", content: <AdminExerciseLibrary /> },
            { key: "protocols", label: "Protocols", content: <AdminProtocols /> },
            { key: "batch", label: "AI Generator", content: <AdminBatchGenerator /> },
            { key: "ai-programs", label: "AI Programs", content: <AdminProgramCreator /> },
            { key: "ai-queue", label: "AI Queue", content: <AdminAiQueue /> },
            { key: "ai-copilot", label: "AI Copilot", content: <AdminAiCopilot /> },
            { key: "recovery", label: "Recovery Map", content: <AdminRecoveryHeatmap /> },
            { key: "schedule", label: "Schedule", content: <AdminSchedule /> },
            { key: "monthly", label: "Monthly Focus", content: <AdminMonthlyFocus /> },
            { key: "biomechanics", label: "Biomechanics", content: <AdminBiomechanics /> },
          ]} />
        )}

        {/* Tab 3: The Vault */}
        {activeTab === "vault" && (
          <SubTabs tabs={[
            { key: "revenue", label: "Revenue & Ledger", content: <AdminFinancials /> },
            { key: "promotions", label: "Promotions", content: <AdminPromotions /> },
            { key: "points", label: "Points", content: <AdminPointsManager /> },
            { key: "tiers", label: "Tier Access", content: <AdminTierManager /> },
            { key: "system", label: "System & Referrals", content: <AdminSystemSettings /> },
            { key: "stripe-products", label: "Stripe Products", content: <AdminStripeProducts /> },
          ]} />
        )}

        {/* Tab 4: Site Content */}
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
          ]} />
        )}
      </div>
    </div>
  );
};

export default Admin;
