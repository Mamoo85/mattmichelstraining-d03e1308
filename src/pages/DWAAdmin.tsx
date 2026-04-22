import { useState, lazy, Suspense } from "react";
import DWASidebar, { type SidebarGroup } from "@/components/dwa-admin/DWASidebar";
import DWAStats from "@/components/dwa-admin/DWAStats";
import DWAClientRoster from "@/components/dwa-admin/DWAClientRoster";
import DWARecentJobs from "@/components/dwa-admin/DWARecentJobs";
import DWACommandDeck from "@/components/dwa-admin/DWACommandDeck";
import DWADataImport from "@/components/dwa-admin/DWADataImport";
import AssetManager from "@/components/field-service/AssetManager";
import ContractManager from "@/components/field-service/ContractManager";
import InstallAppBanner from "@/components/shared/InstallAppBanner";

const DWAPlaybook = lazy(() => import("@/components/dwa-admin/DWAPlaybook"));
const DWAStrategy = lazy(() => import("@/components/dwa-admin/DWAStrategy"));
const DWALabs = lazy(() => import("@/components/dwa-admin/DWALabs"));
const DWASalesGuide = lazy(() => import("@/components/dwa-admin/DWASalesGuide"));
const AdminAgencyOutreach = lazy(() => import("@/components/dwa-admin/AdminAgencyOutreach"));
const TalentRadarHub = lazy(() => import("@/components/dwa-admin/TalentRadarHub"));
const DemandRadarHub = lazy(() => import("@/components/dwa-admin/DemandRadarHub"));
const AdminHighVolumeBuyer = lazy(() => import("@/components/dwa-admin/AdminHighVolumeBuyer"));
const SupplierOutreachGenerator = lazy(() => import("@/components/dwa-admin/SupplierOutreachGenerator"));
const AgentToolkit = lazy(() => import("@/components/dwa-admin/AgentToolkit"));
const AdminServiceResilience = lazy(() => import("@/components/dwa-admin/AdminServiceResilience"));
const AdminCronSentinel = lazy(() => import("@/components/dwa-admin/AdminCronSentinel"));
const AdminCronStatus = lazy(() => import("@/components/dwa-admin/AdminCronStatus"));
const AdminComplianceMonitor = lazy(() => import("@/components/dwa-admin/AdminComplianceMonitor"));

const AdminDWAOverview = lazy(() => import("@/components/admin/AdminDWAOverview"));
const AdminDWARevenueDashboard = lazy(() => import("@/components/admin/AdminDWARevenueDashboard"));
const AdminDeadLeads = lazy(() => import("@/components/admin/AdminDeadLeads"));
const AdminContractorLeads = lazy(() => import("@/components/admin/AdminContractorLeads"));

const AdminFieldCRMClients = lazy(() => import("@/components/admin/AdminFieldCRMClients"));
const VisitorIntelFeed = lazy(() => import("@/components/admin/VisitorIntelFeed"));
const AdminSimulationSuite = lazy(() => import("@/components/admin/AdminSimulationSuite"));
const AdminGlobalOutbox = lazy(() => import("@/components/admin/AdminGlobalOutbox"));
const AdminPostcardCampaigns = lazy(() => import("@/components/admin/AdminPostcardCampaigns"));
const AdminFaxCampaigns = lazy(() => import("@/components/admin/AdminFaxCampaigns"));
const AdminCampaignTargeting = lazy(() => import("@/components/admin/AdminCampaignTargeting"));
const AdminTheWire = lazy(() => import("@/components/admin/AdminTheWire"));
const AdminMedicareIntel = lazy(() => import("@/components/admin/AdminMedicareIntel"));
const AdminIndustrialIntel = lazy(() => import("@/components/admin/AdminIndustrialIntel"));
const AdminTechAlertProspects = lazy(() => import("@/components/dwa-admin/AdminTechAlertProspects"));
const AdminLaraHealth = lazy(() => import("@/components/admin/AdminLaraHealth"));
const AdminGrowthSignals = lazy(() => import("@/components/admin/AdminGrowthSignals"));
const AdminLinkedInBlitz = lazy(() => import("@/components/admin/AdminLinkedInBlitz"));
const AdminCallList = lazy(() => import("@/components/admin/AdminCallList"));
const AdminCommunityDrop = lazy(() => import("@/components/admin/AdminCommunityDrop"));
const AdminReferralKickback = lazy(() => import("@/components/admin/AdminReferralKickback"));
const AdminTrojanHorseLog = lazy(() => import("@/components/admin/AdminTrojanHorseLog"));
const AdminSMSInbox = lazy(() => import("@/components/dwa-admin/AdminSMSInbox"));
const AdminPendingSMSDrafts = lazy(() => import("@/components/dwa-admin/AdminPendingSMSDrafts"));
const AdminAdLauncher = lazy(() => import("@/components/dwa-admin/AdminAdLauncher"));
const AdminOutreachBlocklist = lazy(() => import("@/components/dwa-admin/AdminOutreachBlocklist"));
const AdminErrorLogs = lazy(() => import("@/components/dwa-admin/AdminErrorLogs"));

const AdminCoverageMap = lazy(() => import("@/components/admin/AdminCoverageMap"));
const AdminCRMDashboard = lazy(() => import("@/components/admin/AdminCRMDashboard"));
const AdminContractorOnboarding = lazy(() => import("@/components/dwa-admin/AdminContractorOnboarding"));
const AdminAdSpendTracker = lazy(() => import("@/components/dwa-admin/AdminAdSpendTracker"));
const AdminAdOptimizerLog = lazy(() => import("@/components/dwa-admin/AdminAdOptimizerLog"));
const AdminContractorLeadsStatus = lazy(() => import("@/components/dwa-admin/AdminContractorLeadsStatus"));
const AdminProspectTracker = lazy(() => import("@/components/dwa-admin/AdminProspectTracker"));

type Tab =
  | "dwa-overview" | "revenue" | "agent-toolkit"
  | "dead-leads" | "contractor-leads" | "techalert" | "fielddesk"
  | "visitor-intel" | "the-wire"
  | "postcards" | "faxes" | "targeting" | "outbox"
  | "simulation" | "resilience" | "cron-sentinel" | "cron-status" | "compliance"
  | "field-stats" | "clients" | "jobs" | "assets" | "contracts" | "import"
  | "command" | "playbook" | "strategy" | "labs" | "sales-guide"
  | "agency-outreach" | "demand-radar" | "supplier-outreach" | "hvb"
  | "medicare-intel" | "industrial-intel" | "techalert-prospects"
  | "lara-health" | "growth-signals" | "trojan-log" | "coverage-map" | "crm-dashboard"
  | "sms-inbox" | "sms-drafts" | "ad-launcher" | "blocklist" | "error-logs"
  | "contractor-onboarding" | "ad-spend" | "ad-optimizer" | "leads-e2e" | "prospect-tracker"
  | "linkedin-blitz" | "call-list" | "community-drop" | "referral-kickback";

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
    label: "Radars",
    items: [
      { id: "techalert",     label: "🎯 Talent Radar" },
      { id: "demand-radar",  label: "📈 Demand Radar" },
      { id: "hvb",           label: "📦 High-Volume Buyers" },
    ],
  },
  {
    label: "Market Intel",
    items: [
      { id: "medicare-intel",     label: "🏥 Medicare Intel" },
      { id: "industrial-intel",   label: "🏭 Industrial Intel" },
      { id: "techalert-prospects",label: "🎯 TechAlert Prospects" },
      { id: "growth-signals",     label: "📡 Growth Signals" },
      { id: "coverage-map",       label: "🗺️ Coverage Map" },
    ],
  },
  {
    label: "Customers",
    items: [
      { id: "dead-leads",       label: "♻️ Dead Leads" },
      { id: "contractor-leads", label: "🏗️ Contractor Leads" },
      { id: "contractor-onboarding", label: "🤝 New Contractor Setup" },
      { id: "ad-spend",         label: "💰 Ad Spend Tracker" },
      { id: "ad-optimizer",     label: "🤖 Ad Optimizer Log" },
      { id: "fielddesk",        label: "🛠️ FieldDesk Clients" },
      { id: "clients",          label: "👥 All Clients" },
      { id: "crm-dashboard",    label: "📇 CRM Dashboard" },
    ],
  },
  {
    label: "Outreach",
    items: [
      { id: "linkedin-blitz",   label: "💼 LinkedIn Blitz" },
      { id: "call-list",        label: "📞 Daily Call Sheet" },
      { id: "community-drop",   label: "💬 Community Drop" },
      { id: "referral-kickback",label: "🎁 Referral Kickback" },
      { id: "sms-inbox",        label: "💬 SMS Inbox" },
      { id: "sms-drafts",       label: "✍️ Pending Drafts" },
      { id: "ad-launcher",      label: "🚀 Ad Launcher" },
      { id: "postcards",        label: "📬 Postcards" },
      { id: "faxes",            label: "📠 Fax Campaigns" },
      { id: "targeting",        label: "🎯 Targeting" },
      { id: "outbox",           label: "📤 Global Outbox" },
      { id: "agency-outreach",  label: "📨 Agency Outreach" },
      { id: "supplier-outreach",label: "🏭 Supplier Outreach" },
      { id: "blocklist",        label: "🛡️ Outreach Blocklist" },
    ],
  },
  {
    label: "Intel",
    items: [
      { id: "visitor-intel", label: "👁️ Visitor Intel" },
      { id: "the-wire",      label: "📡 The Wire" },
      { id: "trojan-log",    label: "🐴 Trojan Horse Log" },
      { id: "field-stats",   label: "📊 Field Stats" },
      { id: "jobs",          label: "🧰 Jobs" },
    ],
  },
  {
    label: "Tools",
    items: [
      { id: "simulation",    label: "🧪 Simulation" },
      { id: "resilience",    label: "🛡️ Service Health" },
      { id: "cron-sentinel", label: "🛡️ Cron Sentinel" },
      { id: "cron-status", label: "🛡️ Cron Status" },
      { id: "compliance",  label: "🛡️ TCPA Compliance" },
      { id: "error-logs",  label: "🚨 Error Logs" },
      { id: "lara-health", label: "🏛️ LARA Health" },
      { id: "labs",        label: "⚗️ Labs" },
      { id: "assets",      label: "📦 Assets" },
      { id: "contracts",   label: "📄 Contracts" },
      { id: "import",      label: "⬆️ Import" },
      { id: "command",     label: "🎛️ Command Deck" },
      { id: "playbook",    label: "📖 Playbook" },
      { id: "strategy",    label: "🧭 Strategy" },
      { id: "sales-guide", label: "🎯 Sales Guide" },
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
          {/* One-tap install — Matt's command center on his phone home screen */}
          <InstallAppBanner app="dwa-admin" />

          {activeTab === "dwa-overview"     && <Suspense fallback={lazyFallback("overview")}><AdminDWAOverview /></Suspense>}
          {activeTab === "revenue"          && <Suspense fallback={lazyFallback("revenue")}><AdminDWARevenueDashboard /></Suspense>}
          {activeTab === "agent-toolkit"    && <Suspense fallback={lazyFallback("agent toolkit")}><AgentToolkit /></Suspense>}
          {activeTab === "dead-leads"       && <Suspense fallback={lazyFallback("dead leads")}><AdminDeadLeads /></Suspense>}
          {activeTab === "contractor-leads" && <Suspense fallback={lazyFallback("contractor leads")}><AdminContractorLeads /></Suspense>}
          {activeTab === "techalert"        && <Suspense fallback={lazyFallback("Talent Radar Hub")}><TalentRadarHub /></Suspense>}
          {activeTab === "fielddesk"        && <Suspense fallback={lazyFallback("FieldDesk clients")}><AdminFieldCRMClients /></Suspense>}
          {activeTab === "hvb"              && <Suspense fallback={lazyFallback("high-volume buyers")}><AdminHighVolumeBuyer /></Suspense>}
          {activeTab === "visitor-intel"    && <Suspense fallback={lazyFallback("visitor intel")}><VisitorIntelFeed /></Suspense>}
          {activeTab === "the-wire"         && <Suspense fallback={lazyFallback("The Wire")}><AdminTheWire /></Suspense>}
          {activeTab === "postcards"        && <Suspense fallback={lazyFallback("postcards")}><AdminPostcardCampaigns /></Suspense>}
          {activeTab === "faxes"            && <Suspense fallback={lazyFallback("fax campaigns")}><AdminFaxCampaigns /></Suspense>}
          {activeTab === "targeting"        && <Suspense fallback={lazyFallback("targeting brain")}><AdminCampaignTargeting /></Suspense>}
          {activeTab === "simulation"       && <Suspense fallback={lazyFallback("simulation")}><AdminSimulationSuite /></Suspense>}
          {activeTab === "resilience"       && <Suspense fallback={lazyFallback("service health")}><AdminServiceResilience /></Suspense>}
          {activeTab === "cron-sentinel"    && <Suspense fallback={lazyFallback("cron sentinel")}><AdminCronSentinel /></Suspense>}
          {activeTab === "cron-status"      && <Suspense fallback={lazyFallback("cron status")}><AdminCronStatus /></Suspense>}
          {activeTab === "compliance"       && <Suspense fallback={lazyFallback("compliance")}><AdminComplianceMonitor /></Suspense>}
          {activeTab === "outbox"           && <Suspense fallback={lazyFallback("outbox")}><AdminGlobalOutbox /></Suspense>}
          {activeTab === "agency-outreach"  && <Suspense fallback={lazyFallback("agency outreach")}><AdminAgencyOutreach /></Suspense>}
          {activeTab === "demand-radar"     && <Suspense fallback={lazyFallback("Demand Radar Hub")}><DemandRadarHub /></Suspense>}
          {activeTab === "supplier-outreach"&& <Suspense fallback={lazyFallback("supplier outreach")}><SupplierOutreachGenerator /></Suspense>}
          {activeTab === "medicare-intel"   && <Suspense fallback={lazyFallback("Medicare intel")}><AdminMedicareIntel /></Suspense>}
          {activeTab === "industrial-intel" && <Suspense fallback={lazyFallback("industrial intel")}><AdminIndustrialIntel /></Suspense>}
          {activeTab === "techalert-prospects" && <Suspense fallback={lazyFallback("TechAlert prospects")}><AdminTechAlertProspects /></Suspense>}
          {activeTab === "lara-health"      && <Suspense fallback={lazyFallback("LARA health")}><AdminLaraHealth /></Suspense>}
          {activeTab === "growth-signals"   && <Suspense fallback={lazyFallback("growth signals")}><AdminGrowthSignals /></Suspense>}
          {activeTab === "trojan-log"       && <Suspense fallback={lazyFallback("trojan horse log")}><AdminTrojanHorseLog /></Suspense>}
          {activeTab === "sms-inbox"        && <Suspense fallback={lazyFallback("SMS inbox")}><AdminSMSInbox /></Suspense>}
          {activeTab === "sms-drafts"       && <Suspense fallback={lazyFallback("pending drafts")}><AdminPendingSMSDrafts /></Suspense>}
          {activeTab === "ad-launcher"      && <Suspense fallback={lazyFallback("Ad Launcher")}><AdminAdLauncher /></Suspense>}
          {activeTab === "blocklist"        && <Suspense fallback={lazyFallback("blocklist")}><AdminOutreachBlocklist /></Suspense>}
          {activeTab === "error-logs"       && <Suspense fallback={lazyFallback("error logs")}><AdminErrorLogs /></Suspense>}
          
          {activeTab === "coverage-map"     && <Suspense fallback={lazyFallback("coverage map")}><AdminCoverageMap /></Suspense>}
          {activeTab === "crm-dashboard"    && <Suspense fallback={lazyFallback("CRM dashboard")}><AdminCRMDashboard /></Suspense>}
          {activeTab === "contractor-onboarding" && <Suspense fallback={lazyFallback("contractor onboarding")}><AdminContractorOnboarding /></Suspense>}
          {activeTab === "ad-spend"         && <Suspense fallback={lazyFallback("ad spend")}><AdminAdSpendTracker /></Suspense>}
          {activeTab === "ad-optimizer"     && <Suspense fallback={lazyFallback("ad optimizer")}><AdminAdOptimizerLog /></Suspense>}
          {activeTab === "leads-e2e"        && <Suspense fallback={lazyFallback("Leads E2E status")}><AdminContractorLeadsStatus /></Suspense>}
          {activeTab === "prospect-tracker" && <Suspense fallback={lazyFallback("prospect tracker")}><AdminProspectTracker /></Suspense>}
          {activeTab === "linkedin-blitz"   && <Suspense fallback={lazyFallback("LinkedIn blitz")}><AdminLinkedInBlitz /></Suspense>}
          {activeTab === "call-list"        && <Suspense fallback={lazyFallback("call sheet")}><AdminCallList /></Suspense>}
          {activeTab === "community-drop"   && <Suspense fallback={lazyFallback("community drop")}><AdminCommunityDrop /></Suspense>}
          {activeTab === "referral-kickback"&& <Suspense fallback={lazyFallback("referral kickback")}><AdminReferralKickback /></Suspense>}

          {activeTab === "field-stats" && (
            <div className="space-y-6">
              <DWAStats />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <h2 className="text-white/40 text-xs uppercase tracking-wide mb-3">Recent Jobs</h2>
                  <DWARecentJobs limit={20} />
                </div>
              </div>
            </div>
          )}
          {activeTab === "clients"   && <DWAClientRoster />}
          {activeTab === "jobs"      && <DWARecentJobs limit={50} />}
          {activeTab === "assets"    && <AssetManager />}
          {activeTab === "contracts" && <ContractManager />}
          {activeTab === "import"    && <DWADataImport />}
          {activeTab === "command"   && <DWACommandDeck />}
          {activeTab === "playbook"  && <Suspense fallback={lazyFallback("playbook")}><DWAPlaybook /></Suspense>}
          {activeTab === "strategy"  && <Suspense fallback={lazyFallback("strategy")}><DWAStrategy /></Suspense>}
          {activeTab === "labs"      && <Suspense fallback={lazyFallback("labs")}><DWALabs /></Suspense>}
          {activeTab === "sales-guide" && <Suspense fallback={lazyFallback("sales guide")}><DWASalesGuide /></Suspense>}
        </div>
      </main>
    </div>
  );
}
