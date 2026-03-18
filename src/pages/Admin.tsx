import { useState } from "react";
import AppNavbar from "@/components/AppNavbar";
import AdminSubscriberList from "@/components/admin/AdminSubscriberList";
import AdminNewsletterComposer from "@/components/admin/AdminNewsletterComposer";
import AdminSendHistory from "@/components/admin/AdminSendHistory";
import AdminClientList from "@/components/admin/AdminClientList";
import AdminProtocols from "@/components/admin/AdminProtocols";
import AdminSiteEditor from "@/components/admin/AdminSiteEditor";
import AdminCoachDashboard from "@/components/admin/AdminCoachDashboard";
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
import AdminFamilyManager from "@/components/admin/AdminFamilyManager";
const TABS = [
  { key: "tiers", label: "Tier Access" },
  { key: "schedule", label: "Schedule" },
  { key: "monthly", label: "Monthly Focus" },
  { key: "coach", label: "Coach Review" },
  { key: "videos", label: "Videos" },
  { key: "dms", label: "Direct Messages" },
  { key: "family", label: "Family Accounts" },
  { key: "parent-reports", label: "Parent Reports" },
  { key: "ai-programs", label: "AI Programs" },
  { key: "programs", label: "Programs" },
  { key: "exercises", label: "Exercises" },
  { key: "promotions", label: "Promotions" },
  { key: "points", label: "Points" },
  { key: "clients", label: "Clients" },
  { key: "site", label: "Site Editor" },
  { key: "protocols", label: "Protocols" },
  { key: "subscribers", label: "Newsletter" },
  { key: "compose", label: "Compose" },
  { key: "history", label: "Send History" },
];

const Admin = () => {
  const [activeTab, setActiveTab] = useState("tiers");

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-display">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">Manage site content, clients, protocols & newsletters</p>
          </div>
        </div>

        <div className="flex gap-1 mb-6 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                activeTab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "tiers" && <AdminTierManager />}
        {activeTab === "schedule" && <AdminSchedule />}
        {activeTab === "monthly" && <AdminMonthlyFocus />}
        {activeTab === "coach" && (
          <div className="space-y-8">
            <AdminCoachInbox />
            <div className="border-t border-border pt-6">
              <AdminCoachDashboard />
            </div>
          </div>
        )}
        {activeTab === "videos" && <AdminVideoReview />}
        {activeTab === "dms" && <AdminDirectMessages />}
        {activeTab === "parent-reports" && <AdminParentReports />}
        {activeTab === "ai-programs" && <AdminProgramCreator />}
        {activeTab === "programs" && <AdminPrograms />}
        {activeTab === "exercises" && <AdminExerciseLibrary />}
        {activeTab === "promotions" && <AdminPromotions />}
        {activeTab === "points" && <AdminPointsManager />}
        {activeTab === "clients" && <AdminClientList />}
        {activeTab === "site" && <AdminSiteEditor />}
        {activeTab === "protocols" && <AdminProtocols />}
        {activeTab === "subscribers" && <AdminSubscriberList />}
        {activeTab === "compose" && <AdminNewsletterComposer />}
        {activeTab === "history" && <AdminSendHistory />}
      </div>
    </div>
  );
};

export default Admin;
