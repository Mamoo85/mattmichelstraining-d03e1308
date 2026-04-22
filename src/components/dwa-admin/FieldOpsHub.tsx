import { useState } from "react";
import { cn } from "@/lib/utils";
import DWAStats from "@/components/dwa-admin/DWAStats";
import DWARecentJobs from "@/components/dwa-admin/DWARecentJobs";
import DWADataImport from "@/components/dwa-admin/DWADataImport";
import AssetManager from "@/components/field-service/AssetManager";
import ContractManager from "@/components/field-service/ContractManager";

type Sub = "stats" | "jobs" | "assets" | "contracts" | "import";

const TABS: { id: Sub; label: string }[] = [
  { id: "stats",     label: "📊 Field Stats" },
  { id: "jobs",      label: "🧰 Jobs" },
  { id: "assets",    label: "📦 Assets" },
  { id: "contracts", label: "📄 Contracts" },
  { id: "import",    label: "⬆️ Import" },
];

export default function FieldOpsHub() {
  const [sub, setSub] = useState<Sub>("stats");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-semibold transition-colors",
              sub === t.id
                ? "bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-transparent"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sub === "stats" && (
        <div className="space-y-6">
          <DWAStats />
          <div>
            <h2 className="text-white/40 text-xs uppercase tracking-wide mb-3">Recent Jobs</h2>
            <DWARecentJobs limit={20} />
          </div>
        </div>
      )}
      {sub === "jobs"      && <DWARecentJobs limit={50} />}
      {sub === "assets"    && <AssetManager />}
      {sub === "contracts" && <ContractManager />}
      {sub === "import"    && <DWADataImport />}
    </div>
  );
}
