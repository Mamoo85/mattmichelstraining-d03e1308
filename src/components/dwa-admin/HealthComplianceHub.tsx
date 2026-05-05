import { lazy, Suspense, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import ErrorBoundary from "@/components/layout/ErrorBoundary";

const AdminServiceResilience = lazy(() => import("@/components/dwa-admin/AdminServiceResilience"));
const AdminCronSentinel = lazy(() => import("@/components/dwa-admin/AdminCronSentinel"));
const AdminCronStatus = lazy(() => import("@/components/dwa-admin/AdminCronStatus"));
const AdminComplianceMonitor = lazy(() => import("@/components/dwa-admin/AdminComplianceMonitor"));
const AdminLaraHealth = lazy(() => import("@/components/admin/AdminLaraHealth"));
const AdminErrorLogs = lazy(() => import("@/components/dwa-admin/AdminErrorLogs"));
const AdminTrialHealth = lazy(() => import("@/components/dwa-admin/AdminTrialHealth"));

const safe = (label: string, node: ReactNode) => (
  <ErrorBoundary>
    <Suspense fallback={<div className="text-white/40 text-sm p-6">Loading {label}…</div>}>{node}</Suspense>
  </ErrorBoundary>
);

type Sub = "resilience" | "cron" | "tcpa" | "lara" | "errors";

const TABS: { id: Sub; label: string }[] = [
  { id: "resilience", label: "🛡️ Service Resilience" },
  { id: "cron",       label: "⏱️ Cron Sentinel + Status" },
  { id: "tcpa",       label: "📵 TCPA Compliance" },
  { id: "lara",       label: "🏛️ LARA Health" },
  { id: "errors",     label: "🚨 Error Logs" },
];

export default function HealthComplianceHub() {
  const [sub, setSub] = useState<Sub>("resilience");
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
      {sub === "resilience" && safe("resilience", <AdminServiceResilience />)}
      {sub === "cron" && (
        <div className="space-y-6">
          {safe("cron sentinel", <AdminCronSentinel />)}
          {safe("cron status", <AdminCronStatus />)}
        </div>
      )}
      {sub === "tcpa"   && safe("TCPA", <AdminComplianceMonitor />)}
      {sub === "lara"   && safe("LARA", <AdminLaraHealth />)}
      {sub === "errors" && safe("error logs", <AdminErrorLogs />)}
    </div>
  );
}
