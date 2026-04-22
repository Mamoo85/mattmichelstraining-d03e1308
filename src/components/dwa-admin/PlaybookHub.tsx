import { lazy, Suspense, useState } from "react";
import { cn } from "@/lib/utils";

const DWAPlaybook = lazy(() => import("@/components/dwa-admin/DWAPlaybook"));
const DWAStrategy = lazy(() => import("@/components/dwa-admin/DWAStrategy"));
const DWASalesGuide = lazy(() => import("@/components/dwa-admin/DWASalesGuide"));

type Sub = "playbook" | "strategy" | "sales";

const TABS: { id: Sub; label: string }[] = [
  { id: "playbook", label: "📖 Playbook" },
  { id: "strategy", label: "🧭 Strategy" },
  { id: "sales",    label: "🎯 Sales Guide" },
];

const fb = (l: string) => <div className="text-white/40 text-sm p-6">Loading {l}…</div>;

export default function PlaybookHub() {
  const [sub, setSub] = useState<Sub>("playbook");
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
      {sub === "playbook" && <Suspense fallback={fb("playbook")}><DWAPlaybook /></Suspense>}
      {sub === "strategy" && <Suspense fallback={fb("strategy")}><DWAStrategy /></Suspense>}
      {sub === "sales"    && <Suspense fallback={fb("sales guide")}><DWASalesGuide /></Suspense>}
    </div>
  );
}
