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
const AdminMissedCall = lazy(() => import("@/components/admin/AdminMissedCall"));
const AdminMissedCallLeads = lazy(() => import("@/components/admin/AdminMissedCallLeads"));
const AdminFaxOutreach = lazy(() => import("@/components/admin/AdminFaxOutreach"));
const AdminPostcardOutreach = lazy(() => import("@/components/admin/AdminPostcardOutreach"));
const AdminSMSOutreach = lazy(() => import("@/components/admin/AdminSMSOutreach"));
const VisitorIntelFeed = lazy(() => import("@/components/admin/VisitorIntelFeed"));
const AdminSimulationSuite = lazy(() => import("@/components/admin/AdminSimulationSuite"));
const AdminTheWire = lazy(() => import("@/components/admin/AdminTheWire"));
const AdminGrowthSignals = lazy(() => import("@/components/admin/AdminGrowthSignals"));
const AdminGrowthSignalOutreach = lazy(() => import("@/components/admin/AdminGrowthSignalOutreach"));
const AdminCallList = lazy(() => import("@/components/admin/AdminCallList"));
const AdminSMSInbox = lazy(() => import("@/components/dwa-admin/AdminSMSInbox"));
const AdminPendingSMSDrafts = lazy(() => import("@/components/dwa-admin/AdminPendingSMSDrafts"));
const AdminAdLauncher = lazy(() => import("@/components/dwa-admin/AdminAdLauncher"));
const AdminDeadLeadAdStudio = lazy(() => import("@/components/dwa-admin/AdminDeadLeadAdStudio"));
const AdminCoverageMap = lazy(() => import("@/components/admin/AdminCoverageMap"));
const AdminCRMDashboard = lazy(() => import("@/components/admin/AdminCRMDashboard"));
const AdminContractorOnboarding = lazy(() => import("@/components/dwa-admin/AdminContractorOnboarding"));
const AdminContractorLeadsStatus = lazy(() => import("@/components/dwa-admin/AdminContractorLeadsStatus"));
const AdminProspectTracker = lazy(() => import("@/components/dwa-admin/AdminProspectTracker"));
const AdminCommandBar = lazy(() => import("@/components/dwa-admin/AdminCommandBar"));
const ProductSalesHub = lazy(() => import("@/components/dwa-admin/ProductSalesHub"));
const BuyerRadarQAChecklist = lazy(() => import("@/components/dwa-admin/BuyerRadarQAChecklist"));
const MortgageRadarHub = lazy(() => import("@/components/dwa-admin/MortgageRadarHub"));
const LeadSalesOutreachHub = lazy(() => import("@/components/dwa-admin/LeadSalesOutreachHub"));
const PipelineVelocityDashboard = lazy(() => import("@/components/dwa-admin/PipelineVelocityDashboard"));
const StrategyModeHub = lazy(() => import("@/components/dwa-admin/StrategyModeHub"));
const AdminEnrichmentAudit = lazy(() => import("@/components/admin/AdminEnrichmentAudit"));

type Tab =
  | "ai-command"
  | "dwa-overview" | "revenue" | "leads-e2e" | "prospect-tracker" | "agent-toolkit" | "pipeline-velocity"
  | "command-center" | "sms-inbox" | "sms-drafts" | "call-list" | "linkedin-blitz" | "ad-launcher" | "agency-outreach" | "dead-leads" | "fax-drip" | "postcard-drip" | "sms-sniper" | "dead-lead-ad-studio"
  | "contractor-leads" | "contractor-onboarding" | "contractor-market" | "fielddesk" | "techalert" | "missed-call" | "missed-call-leads" | "clients-all"
  | "lead-marketplace" | "demand-radar" | "hvb" | "growth-signals" | "visitor-intel" | "the-wire" | "coverage-map"
  | "health" | "simulation" | "playbook-hub" | "field-ops" | "command"
  | "sales-hub" | "buyer-radar-qa" | "mortgage-radar" | "strategy-mode" | "enrichment-audit";

const GROUPS: SidebarGroup[] = [
  {
    label: "Revenue",
    items: [
      { id: "sales-hub",         label: "💬 Sales Hub" },
      { id: "ai-command",        label: "🧠 AI Command" },
      { id: "dwa-overview",      label: "📊 Overview" },
      { id: "pipeline-velocity", label: "📈 Pipeline Velocity" },
      { id: "revenue",           label: "💰 Revenue" },
      { id: "leads-e2e",         label: "🟢 Leads E2E" },
      { id: "prospect-tracker",  label: "📍 Prospect Tracker" },
      { id: "agent-toolkit",     label: "🤖 Agent Toolkit" },
    ],
  },
  {
    label: "Outreach",
    items: [
      { id: "command-center",   label: "🎯 Command Center" },
      { id: "sms-inbox",        label: "💬 SMS Inbox" },
      { id: "sms-drafts",       label: "✍️ Pending Drafts" },
      { id: "call-list",        label: "📞 Daily Call Sheet" },
      { id: "linkedin-blitz",        label: "🎯 Growth Outreach" },
      { id: "ad-launcher",           label: "🚀 Ad Launcher" },
      { id: "dead-lead-ad-studio",   label: "🎯 Dead Lead Ad Studio" },
      { id: "agency-outreach",       label: "📨 Agency Outreach" },
      { id: "dead-leads",            label: "♻️ Dead Leads" },
      { id: "fax-drip",              label: "📠 Fax Drip" },
      { id: "postcard-drip",         label: "✉️ Postcard Drip" },
      { id: "sms-sniper",            label: "💬 SMS Sniper" },
    ],
  },
  {
    label: "Customers",
    items: [
      { id: "contractor-leads",      label: "🏗️ Contractor Leads" },
      { id: "contractor-onboarding", label: "🤝 Contractor Onboarding" },
      { id: "contractor-market",     label: "🏪 PPL Marketplace" },
      { id: "fielddesk",             label: "🛠️ FieldDesk Clients" },
      { id: "techalert",             label: "🎯 TechAlert Clients" },
      { id: "missed-call",           label: "📞 Missed-Call Catch" },
      { id: "missed-call-leads",     label: "📞 Missed Call Leads" },
      { id: "clients-all",           label: "👥 All Clients / CRM" },
    ],
  },
  {
    label: "Intel & Radars",
    items: [
      { id: "techalert",       label: "🎯 Talent Radar" },
      { id: "lead-marketplace", label: "🏪 Lead Marketplace" },
      { id: "demand-radar",    label: "📈 Demand Radar" },
      { id: "mortgage-radar",  label: "🏠 Mortgage Radar" },
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
      { id: "health",          label: "🛡️ Health & Compliance" },
      { id: "enrichment-audit", label: "🔬 Enrichment Audit" },
      { id: "buyer-radar-qa",  label: "🛡️ Buyer Radar QA" },
      { id: "simulation",      label: "🧪 Simulation Suite" },
      { id: "playbook-hub",  label: "📖 Playbook & Strategy" },
      { id: "strategy-mode", label: "🧠 Strategy Mode" },
      { id: "field-ops",     label: "⚙️ Field Ops" },
      { id: "command",       label: "🎛️ Command Deck" },
    ],
  },
];

const lazyFallback = (label: string) => <div className="text-white/40 text-sm p-6">Loading {label}…</div>;

export default function DWAAdmin() {
  const [activeTab, setActiveTab] = useState<Tab>("ai-command");
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

          {activeTab === "sales-hub"        && <Suspense fallback={lazyFallback("Sales Hub")}><ProductSalesHub /></Suspense>}
          {activeTab === "ai-command"       && <Suspense fallback={lazyFallback("AI Command")}><AdminCommandBar /></Suspense>}
          {activeTab === "dwa-overview"      && <Suspense fallback={lazyFallback("overview")}><AdminDWAOverview /></Suspense>}
          {activeTab === "pipeline-velocity" && <Suspense fallback={lazyFallback("pipeline velocity")}><PipelineVelocityDashboard /></Suspense>}
          {activeTab === "revenue"           && <Suspense fallback={lazyFallback("revenue")}><AdminDWARevenueDashboard /></Suspense>}
          {activeTab === "leads-e2e"        && <Suspense fallback={lazyFallback("Leads E2E")}><AdminContractorLeadsStatus /></Suspense>}
          {activeTab === "prospect-tracker" && <Suspense fallback={lazyFallback("prospect tracker")}><AdminProspectTracker /></Suspense>}
          {activeTab === "agent-toolkit"    && <Suspense fallback={lazyFallback("agent toolkit")}><AgentToolkit /></Suspense>}

          {activeTab === "command-center"   && <Suspense fallback={lazyFallback("Command Center")}><OutreachCommandCenter /></Suspense>}
          {activeTab === "sms-inbox"        && <Suspense fallback={lazyFallback("SMS inbox")}><AdminSMSInbox /></Suspense>}
          {activeTab === "sms-drafts"       && <Suspense fallback={lazyFallback("pending drafts")}><AdminPendingSMSDrafts /></Suspense>}
          {activeTab === "call-list"        && <Suspense fallback={lazyFallback("call sheet")}><AdminCallList /></Suspense>}
          {activeTab === "linkedin-blitz"   && <Suspense fallback={lazyFallback("Growth Outreach")}><AdminGrowthSignalOutreach /></Suspense>}
          {activeTab === "ad-launcher"        && <Suspense fallback={lazyFallback("Ad Launcher")}><AdminAdLauncher /></Suspense>}
          {activeTab === "dead-lead-ad-studio" && <Suspense fallback={lazyFallback("Dead Lead Ad Studio")}><AdminDeadLeadAdStudio /></Suspense>}
          {activeTab === "agency-outreach"  && <Suspense fallback={lazyFallback("agency outreach")}><AdminAgencyOutreach /></Suspense>}

          {activeTab === "contractor-leads"      && <Suspense fallback={lazyFallback("contractor leads")}><AdminContractorLeads /></Suspense>}
          {activeTab === "contractor-onboarding" && <Suspense fallback={lazyFallback("onboarding")}><AdminContractorOnboarding /></Suspense>}
          {activeTab === "contractor-market"     && <Suspense fallback={lazyFallback("PPL marketplace")}><AdminContractorLeadsStatus /></Suspense>}
          {activeTab === "dead-leads"            && <Suspense fallback={lazyFallback("dead leads")}><AdminDeadLeads /></Suspense>}
          {activeTab === "fax-drip"              && <Suspense fallback={lazyFallback("fax outreach")}><AdminFaxOutreach /></Suspense>}
          {activeTab === "postcard-drip"         && <Suspense fallback={lazyFallback("postcard outreach")}><AdminPostcardOutreach /></Suspense>}
          {activeTab === "sms-sniper"            && <Suspense fallback={lazyFallback("sms outreach")}><AdminSMSOutreach /></Suspense>}
          {activeTab === "fielddesk"             && <Suspense fallback={lazyFallback("FieldDesk")}><AdminFieldCRMClients /></Suspense>}
          {activeTab === "techalert"             && <Suspense fallback={lazyFallback("Talent Radar")}><TalentRadarHub /></Suspense>}
          {activeTab === "missed-call"           && <Suspense fallback={lazyFallback("Missed-Call")}><AdminMissedCall /></Suspense>}
          {activeTab === "missed-call-leads"     && <Suspense fallback={lazyFallback("Missed Call Leads")}><AdminMissedCallLeads /></Suspense>}
          {activeTab === "clients-all"           && (
            <div className="space-y-6">
              <DWAClientRoster />
              <Suspense fallback={lazyFallback("CRM")}><AdminCRMDashboard /></Suspense>
            </div>
          )}

          {activeTab === "lead-marketplace" && <Suspense fallback={lazyFallback("Lead Marketplace")}><LeadSalesOutreachHub /></Suspense>}
          {activeTab === "demand-radar"    && <Suspense fallback={lazyFallback("Demand Radar")}><DemandRadarHub /></Suspense>}
          {activeTab === "mortgage-radar"  && <Suspense fallback={lazyFallback("Mortgage Radar")}><MortgageRadarHub /></Suspense>}
          {activeTab === "hvb"             && <Suspense fallback={lazyFallback("HVB")}><AdminHighVolumeBuyer /></Suspense>}
          {activeTab === "growth-signals"  && <Suspense fallback={lazyFallback("growth signals")}><AdminGrowthSignals /></Suspense>}
          {activeTab === "visitor-intel"   && <Suspense fallback={lazyFallback("visitor intel")}><VisitorIntelFeed /></Suspense>}
          {activeTab === "the-wire"        && <Suspense fallback={lazyFallback("The Wire")}><AdminTheWire /></Suspense>}
          {activeTab === "coverage-map"    && <Suspense fallback={lazyFallback("coverage map")}><AdminCoverageMap /></Suspense>}

          {activeTab === "health"          && <Suspense fallback={lazyFallback("health")}><HealthComplianceHub /></Suspense>}
          {activeTab === "enrichment-audit" && <Suspense fallback={lazyFallback("enrichment audit")}><AdminEnrichmentAudit /></Suspense>}
          {activeTab === "buyer-radar-qa"  && <Suspense fallback={lazyFallback("Buyer Radar QA")}><BuyerRadarQAChecklist /></Suspense>}
          {activeTab === "simulation"      && <Suspense fallback={lazyFallback("simulation")}><AdminSimulationSuite /></Suspense>}
          {activeTab === "playbook-hub"  && <Suspense fallback={lazyFallback("playbook")}><PlaybookHub /></Suspense>}
          {activeTab === "strategy-mode" && <Suspense fallback={lazyFallback("strategy mode")}><StrategyModeHub /></Suspense>}
          {activeTab === "field-ops"     && <Suspense fallback={lazyFallback("field ops")}><FieldOpsHub /></Suspense>}
          {activeTab === "command"       && <DWACommandDeck />}
        </div>
      </main>
    </div>
  );
}
