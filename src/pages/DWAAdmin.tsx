import { useState, lazy, Suspense } from "react";
import DWASidebar, { type SidebarGroup } from "@/components/dwa-admin/DWASidebar";
import DWAClientRoster from "@/components/dwa-admin/DWAClientRoster";
import DWACommandDeck from "@/components/dwa-admin/DWACommandDeck";
import InstallAppBanner from "@/components/shared/InstallAppBanner";

const OutreachCommandCenter = lazy(() => import("@/components/dwa-admin/OutreachCommandCenter"));
const HealthComplianceHub = lazy(() => import("@/components/dwa-admin/HealthComplianceHub"));
const PlaybookHub = lazy(() => import("@/components/dwa-admin/PlaybookHub"));
const FieldOpsHub = lazy(() => import("@/components/dwa-admin/FieldOpsHub"));

const AdminAgencyOutreach = lazy(() => import("@/components/dwa-admin/AdminAgencyOutreach"));
const TalentRadarHub = lazy(() => import("@/components/dwa-admin/TalentRadarHub"));
const DemandRadarHub = lazy(() => import("@/components/dwa-admin/DemandRadarHub"));
const AdminHighVolumeBuyer = lazy(() => import("@/components/dwa-admin/AdminHighVolumeBuyer"));
const AgentToolkit = lazy(() => import("@/components/dwa-admin/AgentToolkit"));

const AdminDWAOverview = lazy(() => import("@/components/admin/AdminDWAOverview"));
const AdminDWARevenueDashboard = lazy(() => import("@/components/admin/AdminDWARevenueDashboard"));
const AdminDeadLeads = lazy(() => import("@/components/admin/AdminDeadLeads"));
const AdminContractorLeads = lazy(() => import("@/components/admin/AdminContractorLeads"));
const AdminFieldCRMClients = lazy(() => import("@/components/admin/AdminFieldCRMClients"));
const VisitorIntelFeed = lazy(() => import("@/components/admin/VisitorIntelFeed"));
const AdminSimulationSuite = lazy(() => import("@/components/admin/AdminSimulationSuite"));
const AdminTheWire = lazy(() => import("@/components/admin/AdminTheWire"));
const AdminGrowthSignals = lazy(() => import("@/components/admin/AdminGrowthSignals"));
const AdminGrowthSignalOutreach = lazy(() => import("@/components/admin/AdminGrowthSignalOutreach"));
const AdminCallList = lazy(() => import("@/components/admin/AdminCallList"));
const AdminSMSInbox = lazy(() => import("@/components/dwa-admin/AdminSMSInbox"));
const AdminPendingSMSDrafts = lazy(() => import("@/components/dwa-admin/AdminPendingSMSDrafts"));
const AdminAdLauncher = lazy(() => import("@/components/dwa-admin/AdminAdLauncher"));
const AdminCoverageMap = lazy(() => import("@/components/admin/AdminCoverageMap"));
const AdminCRMDashboard = lazy(() => import("@/components/admin/AdminCRMDashboard"));
const AdminContractorOnboarding = lazy(() => import("@/components/dwa-admin/AdminContractorOnboarding"));
const AdminContractorLeadsStatus = lazy(() => import("@/components/dwa-admin/AdminContractorLeadsStatus"));
const AdminProspectTracker = lazy(() => import("@/components/dwa-admin/AdminProspectTracker"));
const AdminCommandBar = lazy(() => import("@/components/dwa-admin/AdminCommandBar"));

type Tab =
  | "dwa-overview" | "revenue" | "leads-e2e" | "prospect-tracker" | "agent-toolkit"
  | "command-center" | "sms-inbox" | "sms-drafts" | "call-list" | "linkedin-blitz" | "ad-launcher" | "agency-outreach"
  | "contractor-leads" | "contractor-onboarding" | "dead-leads" | "fielddesk" | "techalert" | "clients-all"
  | "demand-radar" | "hvb" | "growth-signals" | "visitor-intel" | "the-wire" | "coverage-map"
  | "health" | "simulation" | "playbook-hub" | "field-ops" | "command";

const GROUPS: SidebarGroup[] = [
  {
    label: "Revenue",
    items: [
      { id: "dwa-overview",     label: "📊 Overview" },
      { id: "revenue",          label: "💰 Revenue" },
      { id: "leads-e2e",        label: "🟢 Leads E2E" },
      { id: "prospect-tracker", label: "📍 Prospect Tracker" },
      { id: "agent-toolkit",    label: "🤖 Agent Toolkit" },
    ],
  },
  {
    label: "Outreach",
    items: [
      { id: "command-center",   label: "🎯 Command Center" },
      { id: "sms-inbox",        label: "💬 SMS Inbox" },
      { id: "sms-drafts",       label: "✍️ Pending Drafts" },
      { id: "call-list",        label: "📞 Daily Call Sheet" },
      { id: "linkedin-blitz",   label: "🎯 Growth Outreach" },
      { id: "ad-launcher",      label: "🚀 Ad Launcher" },
      { id: "agency-outreach",  label: "📨 Agency Outreach" },
    ],
  },
  {
    label: "Customers",
    items: [
      { id: "contractor-leads",      label: "🏗️ Contractor Leads" },
      { id: "contractor-onboarding", label: "🤝 Contractor Onboarding" },
      { id: "dead-leads",            label: "♻️ Dead Leads" },
      { id: "fielddesk",             label: "🛠️ FieldDesk Clients" },
      { id: "techalert",             label: "🎯 TechAlert Clients" },
      { id: "clients-all",           label: "👥 All Clients / CRM" },
    ],
  },
  {
    label: "Intel & Radars",
    items: [
      { id: "techalert",       label: "🎯 Talent Radar" },
      { id: "demand-radar",    label: "📈 Demand Radar" },
      { id: "hvb",             label: "📦 High-Volume Buyers" },
      { id: "growth-signals",  label: "📡 Growth Signals" },
      { id: "visitor-intel",   label: "👁️ Visitor Intel" },
      { id: "the-wire",        label: "📡 The Wire" },
      { id: "coverage-map",    label: "🗺️ Coverage Map" },
    ],
  },
  {
    label: "Ops & Tools",
    items: [
      { id: "health",        label: "🛡️ Health & Compliance" },
      { id: "simulation",    label: "🧪 Simulation Suite" },
      { id: "playbook-hub",  label: "📖 Playbook & Strategy" },
      { id: "field-ops",     label: "⚙️ Field Ops" },
      { id: "command",       label: "🎛️ Command Deck" },
    ],
  },
];

const lazyFallback = (label: string) => <div className="text-white/40 text-sm p-6">Loading {label}…</div>;

export default function DWAAdmin() {
  const [activeTab, setActiveTab] = useState<Tab>("dwa-overview");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a1628] text-white flex w-full">
      <DWASidebar
        groups={GROUPS}
        active={activeTab}
        onSelect={(id) => setActiveTab(id as Tab)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <header className="h-14 sticky top-0 z-30 bg-[#0a1628]/95 backdrop-blur border-b border-white/10 flex items-center justify-between px-4 sm:px-6">
          <span className="font-bold text-sm">
            <span className="text-white">DETROIT</span>{" "}
            <span className="text-[#00d4ff]">WEB AGENCY</span>
            <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30">Admin</span>
          </span>
          <span className="text-white/40 text-xs hidden sm:block">We Handle The Tech</span>
        </header>

        <div className="px-3 sm:px-6 py-6">
          <InstallAppBanner app="dwa-admin" />

          <Suspense fallback={null}><AdminCommandBar /></Suspense>

          {activeTab === "dwa-overview"     && <Suspense fallback={lazyFallback("overview")}><AdminDWAOverview /></Suspense>}
          {activeTab === "revenue"          && <Suspense fallback={lazyFallback("revenue")}><AdminDWARevenueDashboard /></Suspense>}
          {activeTab === "leads-e2e"        && <Suspense fallback={lazyFallback("Leads E2E")}><AdminContractorLeadsStatus /></Suspense>}
          {activeTab === "prospect-tracker" && <Suspense fallback={lazyFallback("prospect tracker")}><AdminProspectTracker /></Suspense>}
          {activeTab === "agent-toolkit"    && <Suspense fallback={lazyFallback("agent toolkit")}><AgentToolkit /></Suspense>}

          {activeTab === "command-center"   && <Suspense fallback={lazyFallback("Command Center")}><OutreachCommandCenter /></Suspense>}
          {activeTab === "sms-inbox"        && <Suspense fallback={lazyFallback("SMS inbox")}><AdminSMSInbox /></Suspense>}
          {activeTab === "sms-drafts"       && <Suspense fallback={lazyFallback("pending drafts")}><AdminPendingSMSDrafts /></Suspense>}
          {activeTab === "call-list"        && <Suspense fallback={lazyFallback("call sheet")}><AdminCallList /></Suspense>}
          {activeTab === "linkedin-blitz"   && <Suspense fallback={lazyFallback("Growth Outreach")}><AdminGrowthSignalOutreach /></Suspense>}
          {activeTab === "ad-launcher"      && <Suspense fallback={lazyFallback("Ad Launcher")}><AdminAdLauncher /></Suspense>}
          {activeTab === "agency-outreach"  && <Suspense fallback={lazyFallback("agency outreach")}><AdminAgencyOutreach /></Suspense>}

          {activeTab === "contractor-leads"      && <Suspense fallback={lazyFallback("contractor leads")}><AdminContractorLeads /></Suspense>}
          {activeTab === "contractor-onboarding" && <Suspense fallback={lazyFallback("onboarding")}><AdminContractorOnboarding /></Suspense>}
          {activeTab === "dead-leads"            && <Suspense fallback={lazyFallback("dead leads")}><AdminDeadLeads /></Suspense>}
          {activeTab === "fielddesk"             && <Suspense fallback={lazyFallback("FieldDesk")}><AdminFieldCRMClients /></Suspense>}
          {activeTab === "techalert"             && <Suspense fallback={lazyFallback("Talent Radar")}><TalentRadarHub /></Suspense>}
          {activeTab === "clients-all"           && (
            <div className="space-y-6">
              <DWAClientRoster />
              <Suspense fallback={lazyFallback("CRM")}><AdminCRMDashboard /></Suspense>
            </div>
          )}

          {activeTab === "demand-radar"    && <Suspense fallback={lazyFallback("Demand Radar")}><DemandRadarHub /></Suspense>}
          {activeTab === "hvb"             && <Suspense fallback={lazyFallback("HVB")}><AdminHighVolumeBuyer /></Suspense>}
          {activeTab === "growth-signals"  && <Suspense fallback={lazyFallback("growth signals")}><AdminGrowthSignals /></Suspense>}
          {activeTab === "visitor-intel"   && <Suspense fallback={lazyFallback("visitor intel")}><VisitorIntelFeed /></Suspense>}
          {activeTab === "the-wire"        && <Suspense fallback={lazyFallback("The Wire")}><AdminTheWire /></Suspense>}
          {activeTab === "coverage-map"    && <Suspense fallback={lazyFallback("coverage map")}><AdminCoverageMap /></Suspense>}

          {activeTab === "health"        && <Suspense fallback={lazyFallback("health")}><HealthComplianceHub /></Suspense>}
          {activeTab === "simulation"    && <Suspense fallback={lazyFallback("simulation")}><AdminSimulationSuite /></Suspense>}
          {activeTab === "playbook-hub"  && <Suspense fallback={lazyFallback("playbook")}><PlaybookHub /></Suspense>}
          {activeTab === "field-ops"     && <Suspense fallback={lazyFallback("field ops")}><FieldOpsHub /></Suspense>}
          {activeTab === "command"       && <DWACommandDeck />}
        </div>
      </main>
    </div>
  );
}
