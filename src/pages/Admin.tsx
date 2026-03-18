import { useState } from "react";
import { Navigate } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Loader2, Bot, Users, Dumbbell, Mail, UserCheck, FileText, DollarSign, Settings } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import AdminTrialSettings from "@/components/admin/AdminTrialSettings";
import AdminSubscriberList from "@/components/admin/AdminSubscriberList";
import AdminNewsletterComposer from "@/components/admin/AdminNewsletterComposer";
import AdminSendHistory from "@/components/admin/AdminSendHistory";
import AdminClientList from "@/components/admin/AdminClientList";
import AdminProtocols from "@/components/admin/AdminProtocols";
import AdminSiteEditor from "@/components/admin/AdminSiteEditor";
import AdminCoachDashboard from "@/components/admin/AdminCoachDashboard";
import AdminRecoveryHeatmap from "@/components/admin/AdminRecoveryHeatmap";
import AdminCoachInbox from "@/components/admin/AdminCoachInbox";
import AdminPrograms from "@/components/admin/AdminPrograms";
import AdminExerciseLibrary from "@/components/admin/AdminExerciseLibrary";
import AdminPromotions from "@/components/admin/AdminPromotions";
import AdminMonthlyFocus from "@/components/admin/AdminMonthlyFocus";
import AdminProgramCreator from "@/components/admin/AdminProgramCreator";
import AdminSchedule from "@/components/admin/AdminSchedule";
import AdminTierManager from "@/components/admin/AdminTierManager";
import AdminDirectMessages from "@/components/admin/AdminDirectMessages";
import AdminPointsManager from "@/components/admin/AdminPointsManager";
import AdminVideoReview from "@/components/admin/AdminVideoReview";
import AdminParentReports from "@/components/admin/AdminParentReports";
import AdminParentInbox from "@/components/admin/AdminParentInbox";
import AdminFamilyManager from "@/components/admin/AdminFamilyManager";
import AdminTeamRosters from "@/components/admin/AdminTeamRosters";
import AdminLearnEditor from "@/components/admin/AdminLearnEditor";
import AdminFinancials from "@/components/admin/AdminFinancials";
import AdminSystemSettings from "@/components/admin/AdminSystemSettings";
import AdminTestimonials from "@/components/admin/AdminTestimonials";
import AdminFrontPage from "@/components/admin/AdminFrontPage";
import AdminAiQueue from "@/components/admin/AdminAiQueue";
import AdminAiCopilot from "@/components/admin/AdminAiCopilot";
import AdminBroadcasts from "@/components/admin/AdminBroadcasts";
import AdminBatchGenerator from "@/components/admin/AdminBatchGenerator";

const SECTIONS = [
  { key: "ai", label: "AI Hub", icon: Bot },
  { key: "coaching", label: "Coaching", icon: Users },
  { key: "programs", label: "Programs", icon: Dumbbell },
  { key: "comms", label: "Communications", icon: Mail },
  { key: "users", label: "Users & Families", icon: UserCheck },
  { key: "content", label: "Content & Site", icon: FileText },
  { key: "commerce", label: "Commerce", icon: DollarSign },
  { key: "settings", label: "Settings", icon: Settings },
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
  const [activeSection, setActiveSection] = useState("ai");
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-display">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">Full CMS — manage content, clients, products & more</p>
          </div>
        </div>

        {/* Primary section selector */}
        <div className="flex gap-1.5 mb-6 flex-wrap">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                  activeSection === s.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                <Icon size={13} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Section content with sub-tabs */}
        {activeSection === "ai" && (
          <SubTabs tabs={[
            { key: "queue", label: "AI Queue", content: <AdminAiQueue /> },
            { key: "copilot", label: "AI Copilot", content: <AdminAiCopilot /> },
            { key: "batch", label: "Batch Generator", content: <AdminBatchGenerator /> },
            { key: "ai-programs", label: "AI Programs", content: <AdminProgramCreator /> },
          ]} />
        )}

        {activeSection === "coaching" && (
          <SubTabs tabs={[
            { key: "review", label: "Coach Review", content: (
              <div className="space-y-8">
                <AdminCoachInbox />
                <div className="border-t border-border pt-6">
                  <AdminCoachDashboard />
                </div>
              </div>
            )},
            { key: "videos", label: "Videos", content: <AdminVideoReview /> },
            { key: "dms", label: "Direct Messages", content: <AdminDirectMessages /> },
            { key: "recovery", label: "Recovery Heatmap", content: <AdminRecoveryHeatmap /> },
          ]} />
        )}

        {activeSection === "programs" && (
          <SubTabs tabs={[
            { key: "programs", label: "Programs", content: <AdminPrograms /> },
            { key: "exercises", label: "Exercise Library", content: <AdminExerciseLibrary /> },
            { key: "protocols", label: "Protocols", content: <AdminProtocols /> },
          ]} />
        )}

        {activeSection === "comms" && (
          <SubTabs tabs={[
            { key: "broadcasts", label: "Broadcasts", content: <AdminBroadcasts /> },
            { key: "subscribers", label: "Subscribers", content: <AdminSubscriberList /> },
            { key: "compose", label: "Compose", content: <AdminNewsletterComposer /> },
            { key: "history", label: "Send History", content: <AdminSendHistory /> },
          ]} />
        )}

        {activeSection === "users" && (
          <SubTabs tabs={[
            { key: "athletes", label: "Athletes & Trials", content: <AdminClientList /> },
            { key: "teams", label: "Team Rosters", content: <AdminTeamRosters /> },
            { key: "family", label: "Family Accounts", content: <AdminFamilyManager /> },
            { key: "parent-reports", label: "Parent Reports", content: <AdminParentReports /> },
            { key: "parent-inbox", label: "Parent Inbox", content: <AdminParentInbox /> },
            { key: "trial", label: "Trial Settings", content: <AdminTrialSettings /> },
          ]} />
        )}

        {activeSection === "content" && (
          <SubTabs tabs={[
            { key: "front-page", label: "Front Page", content: <AdminFrontPage /> },
            { key: "site", label: "Site Editor", content: <AdminSiteEditor /> },
            { key: "testimonials", label: "Testimonials", content: <AdminTestimonials /> },
            { key: "learn", label: "Learn Hub", content: <AdminLearnEditor /> },
          ]} />
        )}

        {activeSection === "commerce" && (
          <SubTabs tabs={[
            { key: "financials", label: "Financials", content: <AdminFinancials /> },
            { key: "promotions", label: "Promotions", content: <AdminPromotions /> },
            { key: "points", label: "Points", content: <AdminPointsManager /> },
          ]} />
        )}

        {activeSection === "settings" && (
          <SubTabs tabs={[
            { key: "system", label: "System & Referrals", content: <AdminSystemSettings /> },
            { key: "tiers", label: "Tier Access", content: <AdminTierManager /> },
            { key: "schedule", label: "Schedule", content: <AdminSchedule /> },
            { key: "monthly", label: "Monthly Focus", content: <AdminMonthlyFocus /> },
          ]} />
        )}
      </div>
    </div>
  );
};

export default Admin;
