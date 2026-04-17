import { useState, lazy, Suspense } from "react";
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

// DWA Revenue + Client panels (pulled in from main /admin)
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

type Tab =
  | "dwa-overview" | "revenue" | "dead-leads" | "contractor-leads"
  | "techalert" | "fielddesk" | "visitor-intel" | "simulation"
  | "outbox" | "postcards"
  | "overview" | "clients" | "jobs" | "assets" | "contracts" | "import"
  | "command" | "playbook" | "strategy" | "labs" | "sales-guide"
  | "agency-outreach" | "demand-radar" | "supplier-outreach";

const TABS: { id: Tab; label: string }[] = [
  // DWA revenue/client panels (first — Matt's daily work)
  { id: "dwa-overview",     label: "📊 Overview" },
  { id: "revenue",          label: "💰 Revenue" },
  { id: "dead-leads",       label: "♻️ Dead Leads" },
  { id: "contractor-leads", label: "🏗️ Contractor Leads" },
  { id: "techalert",        label: "🔍 TechAlert Clients" },
  { id: "fielddesk",        label: "🛠️ FieldDesk Clients" },
  { id: "visitor-intel",    label: "👁️ Visitor Intel" },
  { id: "postcards",        label: "📬 Postcards" },
  { id: "simulation",       label: "🧪 Simulation" },
  { id: "outbox",           label: "📤 Global Outbox" },
  // Existing DWA-only tabs
  { id: "overview",         label: "Field Stats" },
  { id: "clients",          label: "Clients" },
  { id: "jobs",             label: "Jobs" },
  { id: "assets",           label: "Assets" },
  { id: "contracts",        label: "Contracts" },
  { id: "import",           label: "Import" },
  { id: "command",          label: "Command Deck" },
  { id: "playbook",         label: "📖 Playbook" },
  { id: "strategy",         label: "📊 Strategy" },
  { id: "labs",             label: "🧪 Labs" },
  { id: "sales-guide",      label: "🎯 Sales Guide" },
  { id: "agency-outreach",  label: "🎯 Agency Outreach" },
  { id: "demand-radar",     label: "📡 Demand Radar" },
  { id: "supplier-outreach",label: "📨 Supplier Outreach" },
];

function QuickLinks() {
  return (
    <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
      <p className="text-white/30 text-xs uppercase tracking-wide mb-4">Quick Links</p>
      <div className="flex flex-col gap-2">
        <a href="/field-service" target="_blank" rel="noreferrer" className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-[#00d4ff]/40 hover:bg-[#00d4ff]/5 transition-colors group">
          <span className="text-white/70 text-sm group-hover:text-[#00d4ff]/80 transition-colors">Field Service Landing Page</span>
          <span className="text-white/30 text-xs group-hover:text-[#00d4ff]/60 transition-colors">→</span>
        </a>
        <a href="/field-service/dispatch" target="_blank" rel="noreferrer" className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-[#00d4ff]/40 hover:bg-[#00d4ff]/5 transition-colors group">
          <span className="text-white/70 text-sm group-hover:text-[#00d4ff]/80 transition-colors">Dispatcher Login</span>
          <span className="text-white/30 text-xs group-hover:text-[#00d4ff]/60 transition-colors">→</span>
        </a>
        <a href="/field-service/tech" target="_blank" rel="noreferrer" className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-[#00d4ff]/40 hover:bg-[#00d4ff]/5 transition-colors group">
          <span className="text-white/70 text-sm group-hover:text-[#00d4ff]/80 transition-colors">Tech App</span>
          <span className="text-white/30 text-xs group-hover:text-[#00d4ff]/60 transition-colors">→</span>
        </a>
        <a href="/admin" className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors group">
          <span className="text-white/50 text-sm group-hover:text-white/70 transition-colors">Main Admin (M2)</span>
          <span className="text-white/30 text-xs">→</span>
        </a>
      </div>
    </div>
  );
}

const lazyFallback = (label: string) => <div className="text-white/40 text-sm">Loading {label}…</div>;

export default function DWAAdmin() {
  const [activeTab, setActiveTab] = useState<Tab>("dwa-overview");

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#0a1628] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-base tracking-tight">
              <span className="text-white">DETROIT</span>{" "}
              <span className="text-[#00d4ff]">WEB AGENCY</span>
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30">Admin</span>
          </div>
          <span className="text-white/40 text-xs hidden sm:block">We Handle The Tech</span>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 pb-0 min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-[#00d4ff] text-[#00d4ff]"
                    : "border-transparent text-white/50 hover:text-white/70 hover:border-white/20"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-28 pb-12">
        {activeTab === "dwa-overview" && (
          <Suspense fallback={lazyFallback("overview")}><AdminDWAOverview /></Suspense>
        )}
        {activeTab === "revenue" && (
          <Suspense fallback={lazyFallback("revenue")}><AdminDWARevenueDashboard /></Suspense>
        )}
        {activeTab === "dead-leads" && (
          <Suspense fallback={lazyFallback("dead leads")}><AdminDeadLeads /></Suspense>
        )}
        {activeTab === "contractor-leads" && (
          <Suspense fallback={lazyFallback("contractor leads")}><AdminContractorLeads /></Suspense>
        )}
        {activeTab === "techalert" && (
          <Suspense fallback={lazyFallback("TechAlert clients")}><AdminHireAlertClients /></Suspense>
        )}
        {activeTab === "fielddesk" && (
          <Suspense fallback={lazyFallback("FieldDesk clients")}><AdminFieldCRMClients /></Suspense>
        )}
        {activeTab === "visitor-intel" && (
          <Suspense fallback={lazyFallback("visitor intel")}><VisitorIntelFeed /></Suspense>
        )}
        {activeTab === "postcards" && (
          <Suspense fallback={lazyFallback("postcard ops")}><AdminPostcardCampaigns /></Suspense>
        )}
        {activeTab === "simulation" && (
          <Suspense fallback={lazyFallback("simulation")}><AdminSimulationSuite /></Suspense>
        )}
        {activeTab === "outbox" && (
          <Suspense fallback={lazyFallback("outbox")}><AdminGlobalOutbox /></Suspense>
        )}

        {activeTab === "overview" && (
          <div className="space-y-6">
            <DWAStats />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <h2 className="text-white/40 text-xs uppercase tracking-wide mb-3">Recent Jobs</h2>
                <DWARecentJobs limit={20} />
              </div>
              <div>
                <h2 className="text-white/40 text-xs uppercase tracking-wide mb-3">Quick Links</h2>
                <QuickLinks />
              </div>
            </div>
          </div>
        )}
        {activeTab === "clients" && (
          <div>
            <h2 className="text-white/40 text-xs uppercase tracking-wide mb-4">Client Roster</h2>
            <DWAClientRoster />
          </div>
        )}
        {activeTab === "jobs" && (
          <div>
            <h2 className="text-white/40 text-xs uppercase tracking-wide mb-4">All Jobs</h2>
            <DWARecentJobs limit={50} />
          </div>
        )}
        {activeTab === "assets" && (
          <div>
            <h2 className="text-white/40 text-xs uppercase tracking-wide mb-4">All Assets</h2>
            <AssetManager />
          </div>
        )}
        {activeTab === "contracts" && (
          <div>
            <h2 className="text-white/40 text-xs uppercase tracking-wide mb-4">All Contracts</h2>
            <ContractManager />
          </div>
        )}
        {activeTab === "import" && (
          <div>
            <h2 className="text-white/40 text-xs uppercase tracking-wide mb-4">Data Import</h2>
            <DWADataImport />
          </div>
        )}
        {activeTab === "command" && (
          <div>
            <h2 className="text-white/40 text-xs uppercase tracking-wide mb-4">Command Deck</h2>
            <DWACommandDeck />
          </div>
        )}
        {activeTab === "playbook" && (
          <Suspense fallback={lazyFallback("playbook")}><DWAPlaybook /></Suspense>
        )}
        {activeTab === "strategy" && (
          <Suspense fallback={lazyFallback("strategy")}><DWAStrategy /></Suspense>
        )}
        {activeTab === "labs" && (
          <Suspense fallback={lazyFallback("labs")}><DWALabs /></Suspense>
        )}
        {activeTab === "sales-guide" && (
          <Suspense fallback={lazyFallback("sales guide")}><DWASalesGuide /></Suspense>
        )}
        {activeTab === "agency-outreach" && (
          <Suspense fallback={lazyFallback("agency outreach")}><AdminAgencyOutreach /></Suspense>
        )}
        {activeTab === "demand-radar" && (
          <Suspense fallback={lazyFallback("Demand Radar")}><AdminDemandRadar /></Suspense>
        )}
        {activeTab === "supplier-outreach" && (
          <Suspense fallback={lazyFallback("Supplier Outreach")}><SupplierOutreachGenerator /></Suspense>
        )}
      </main>
    </div>
  );
}
