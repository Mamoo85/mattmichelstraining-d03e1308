import { useState } from "react";
import DWAStats from "@/components/dwa-admin/DWAStats";
import DWAClientRoster from "@/components/dwa-admin/DWAClientRoster";
import DWARecentJobs from "@/components/dwa-admin/DWARecentJobs";
import DWACommandDeck from "@/components/dwa-admin/DWACommandDeck";
import AssetManager from "@/components/field-service/AssetManager";
import ContractManager from "@/components/field-service/ContractManager";

type Tab = "overview" | "clients" | "jobs" | "assets" | "contracts" | "command";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "clients", label: "Clients" },
  { id: "jobs", label: "Jobs" },
  { id: "assets", label: "Assets" },
  { id: "contracts", label: "Contracts" },
  { id: "command", label: "Command Deck" },
];

function QuickLinks() {
  return (
    <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
      <p className="text-white/30 text-xs uppercase tracking-wide mb-4">Quick Links</p>
      <div className="flex flex-col gap-2">
        <a
          href="/field-service"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-[#00d4ff]/40 hover:bg-[#00d4ff]/5 transition-colors group"
        >
          <span className="text-white/70 text-sm group-hover:text-[#00d4ff]/80 transition-colors">
            Field Service Landing Page
          </span>
          <span className="text-white/30 text-xs group-hover:text-[#00d4ff]/60 transition-colors">→</span>
        </a>
        <a
          href="/field-service/dispatch"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-[#00d4ff]/40 hover:bg-[#00d4ff]/5 transition-colors group"
        >
          <span className="text-white/70 text-sm group-hover:text-[#00d4ff]/80 transition-colors">
            Dispatcher Login
          </span>
          <span className="text-white/30 text-xs group-hover:text-[#00d4ff]/60 transition-colors">→</span>
        </a>
        <a
          href="/field-service/tech"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-[#00d4ff]/40 hover:bg-[#00d4ff]/5 transition-colors group"
        >
          <span className="text-white/70 text-sm group-hover:text-[#00d4ff]/80 transition-colors">
            Tech App
          </span>
          <span className="text-white/30 text-xs group-hover:text-[#00d4ff]/60 transition-colors">→</span>
        </a>
        <a
          href="/admin"
          className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors group"
        >
          <span className="text-white/50 text-sm group-hover:text-white/70 transition-colors">
            Main Admin (M2)
          </span>
          <span className="text-white/30 text-xs">→</span>
        </a>
      </div>
    </div>
  );
}

export default function DWAAdmin() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      {/* Top Nav */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#0a1628] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-base tracking-tight">
              <span className="text-white">DETROIT</span>{" "}
              <span className="text-[#00d4ff]">WEB AGENCY</span>
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30">
              Admin
            </span>
          </div>
          <span className="text-white/40 text-xs hidden sm:block">We Handle The Tech</span>
        </div>

        {/* Tab Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#00d4ff] text-[#00d4ff]"
                  : "border-transparent text-white/50 hover:text-white/70 hover:border-white/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content — padded below fixed header (14 for nav + ~44px for tabs = ~96px) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-12">
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

        {activeTab === "command" && (
          <div>
            <h2 className="text-white/40 text-xs uppercase tracking-wide mb-4">Command Deck</h2>
            <DWACommandDeck />
          </div>
        )}
      </main>
    </div>
  );
}
