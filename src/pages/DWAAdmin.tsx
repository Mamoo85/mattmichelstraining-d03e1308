import { useState, lazy, Suspense } from "react";
import DWASidebar, { type SidebarGroup } from "@/components/dwa-admin/DWASidebar";
import DWAStats from "@/components/dwa-admin/DWAStats";
import DWAClientRoster from "@/components/dwa-admin/DWAClientRoster";
import DWARecentJobs from "@/components/dwa-admin/DWARecentJobs";
import DWACommandDeck from "@/components/dwa-admin/DWACommandDeck";
import DWADataImport from "@/components/dwa-admin/DWADataImport";
import AssetManager from "@/components/field-service/AssetManager";
import ContractManager from "@/components/field-service/ContractManager";

const DWAPlaybook = lazy(() => import("@/components/dwa-admin/DWAPlaybook"));
const DWAStrategy = lazy(() => import("@/components/dwa-admin/DWAStrategy"));
const DWALabs = lazy(() => import("@/components/dwa-admin/DWALabs"));
const DWASalesGuide = lazy(() => import("@/components/dwa-admin/DWASalesGuide"));
const AdminAgencyOutreach = lazy(() => import("@/components/dwa-admin/AdminAgencyOutreach"));
const AdminDemandRadar = lazy(() => import("@/components/dwa-admin/AdminDemandRadar"));
const SupplierOutreachGenerator = lazy(() => import("@/components/dwa-admin/SupplierOutreachGenerator"));
const AgentToolkit = lazy(() => import("@/components/dwa-admin/AgentToolkit"));
const AdminServiceResilience = lazy(() => import("@/components/dwa-admin/AdminServiceResilience"));

const AdminDWAOverview = lazy(() => import("@/components/admin/AdminDWAOverview"));
const AdminDWARevenueDashboard = lazy(() => import("@/components/admin/AdminDWARevenueDashboard"));
const AdminDeadLeads = lazy(() => import("@/components/admin/AdminDeadLeads"));
const AdminContractorLeads = lazy(() => import("@/components/admin/AdminContractorLeads"));
const AdminHireAlertClients = lazy(() => import("@/components/admin/AdminHireAlertClients"));
const AdminFieldCRMClients = lazy(() => import("@/components/admin/AdminFieldCRMClients"));
const VisitorIntelFeed = lazy(() => import("@/components/admin/VisitorIntelFeed"));
const AdminSimulationSuite = lazy(() => import("@/components/admin/AdminSimulationSuite"));
const AdminGlobalOutbox = lazy(() => import("@/components/admin/AdminGlobalOutbox"));
const AdminPostcardCampaigns = lazy(() => import("@/components/admin/AdminPostcardCampaigns"));
const AdminFaxCampaigns = lazy(() => import("@/components/admin/AdminFaxCampaigns"));
const AdminCampaignTargeting = lazy(() => import("@/components/admin/AdminCampaignTargeting"));
const AdminTheWire = lazy(() => import("@/components/admin/AdminTheWire"));

type Tab =
  | "dwa-overview" | "revenue" | "agent-toolkit"
  | "dead-leads" | "contractor-leads" | "techalert" | "fielddesk"
  | "visitor-intel" | "the-wire"
  | "postcards" | "faxes" | "targeting" | "outbox"
  | "simulation" | "resilience"
  | "field-stats" | "clients" | "jobs" | "assets" | "contracts" | "import"
  | "command" | "playbook" | "strategy" | "labs" | "sales-guide"
  | "agency-outreach" | "demand-radar" | "supplier-outreach";

const GROUPS: SidebarGroup[] = [
  {
    label: "Revenue",
    items: [
      { id: "dwa-overview",   label: "📊 Overview" },
      { id: "revenue",        label: "💰 Revenue" },
      { id: "agent-toolkit",  label: "🤖 Agent Toolkit" },
    ],
  },
  {
    label: "Customers",
    items: [
      { id: "dead-leads",       label: "♻️ Dead Leads" },
      { id: "contractor-leads", label: "🏗️ Contractor Leads" },
      { id: "techalert",        label: "🔍 TechAlert Clients" },
      { id: "fielddesk",        label: "🛠️ FieldDesk Clients" },
      { id: "clients",          label: "👥 All Clients" },
    ],
  },
  {
    label: "Outreach",
    items: [
      { id: "postcards",        label: "📬 Postcards" },
      { id: "faxes",            label: "📠 Fax Campaigns" },
      { id: "targeting",        label: "🎯 Targeting" },
      { id: "outbox",           label: "📤 Global Outbox" },
      { id: "agency-outreach",  label: "📨 Agency Outreach" },
      { id: "supplier-outreach",label: "🏭 Supplier Outreach" },
    ],
  },
  {
    label: "Intel",
    items: [
      { id: "visitor-intel", label: "👁️ Visitor Intel" },
      { id: "the-wire",      label: "📡 The Wire" },
      { id: "demand-radar",  label: "📈 Demand Radar" },
      { id: "field-stats",   label: "📊 Field Stats" },
      { id: "jobs",          label: "🧰 Jobs" },
    ],
  },
  {
    label: "Tools",
    items: [
      { id: "simulation",  label: "🧪 Simulation" },
      { id: "resilience",  label: "🛡️ Service Health" },
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
          {activeTab === "dwa-overview"     && <Suspense fallback={lazyFallback("overview")}><AdminDWAOverview /></Suspense>}
          {activeTab === "revenue"          && <Suspense fallback={lazyFallback("revenue")}><AdminDWARevenueDashboard /></Suspense>}
          {activeTab === "agent-toolkit"    && <Suspense fallback={lazyFallback("agent toolkit")}><AgentToolkit /></Suspense>}
          {activeTab === "dead-leads"       && <Suspense fallback={lazyFallback("dead leads")}><AdminDeadLeads /></Suspense>}
          {activeTab === "contractor-leads" && <Suspense fallback={lazyFallback("contractor leads")}><AdminContractorLeads /></Suspense>}
          {activeTab === "techalert"        && <Suspense fallback={lazyFallback("TechAlert clients")}><AdminHireAlertClients /></Suspense>}
          {activeTab === "fielddesk"        && <Suspense fallback={lazyFallback("FieldDesk clients")}><AdminFieldCRMClients /></Suspense>}
          {activeTab === "visitor-intel"    && <Suspense fallback={lazyFallback("visitor intel")}><VisitorIntelFeed /></Suspense>}
          {activeTab === "the-wire"         && <Suspense fallback={lazyFallback("The Wire")}><AdminTheWire /></Suspense>}
          {activeTab === "postcards"        && <Suspense fallback={lazyFallback("postcards")}><AdminPostcardCampaigns /></Suspense>}
          {activeTab === "faxes"            && <Suspense fallback={lazyFallback("fax campaigns")}><AdminFaxCampaigns /></Suspense>}
          {activeTab === "targeting"        && <Suspense fallback={lazyFallback("targeting brain")}><AdminCampaignTargeting /></Suspense>}
          {activeTab === "simulation"       && <Suspense fallback={lazyFallback("simulation")}><AdminSimulationSuite /></Suspense>}
          {activeTab === "resilience"       && <Suspense fallback={lazyFallback("service health")}><AdminServiceResilience /></Suspense>}
          {activeTab === "outbox"           && <Suspense fallback={lazyFallback("outbox")}><AdminGlobalOutbox /></Suspense>}
          {activeTab === "agency-outreach"  && <Suspense fallback={lazyFallback("agency outreach")}><AdminAgencyOutreach /></Suspense>}
          {activeTab === "demand-radar"     && <Suspense fallback={lazyFallback("demand radar")}><AdminDemandRadar /></Suspense>}
          {activeTab === "supplier-outreach"&& <Suspense fallback={lazyFallback("supplier outreach")}><SupplierOutreachGenerator /></Suspense>}

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
