import { lazy, Suspense, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TalentRadarLiveLog from "./TalentRadarLiveLog";
import WaterfallDiagnostics from "./WaterfallDiagnostics";

const AdminHireAlertClients = lazy(() => import("@/components/admin/AdminHireAlertClients"));
const AdminTalentIngest = lazy(() => import("./AdminTalentIngest"));

export default function TalentRadarHub() {
  const [tab, setTab] = useState("clients");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          🎯 <span>Talent Radar Hub</span>
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Licensed-trade hiring intelligence — clients, candidate workbench, waterfall diagnostics, and the live error log.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 border border-white/10 h-auto flex-wrap">
          <TabsTrigger value="clients" className="data-[state=active]:bg-[#00d4ff]/20 data-[state=active]:text-[#00d4ff]">
            📋 Clients & Workbench
          </TabsTrigger>
          <TabsTrigger value="waterfall" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300">
            💧 Waterfall
          </TabsTrigger>
          <TabsTrigger value="ingest" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
            🔄 Ingest Pipeline
          </TabsTrigger>
          <TabsTrigger value="live-log" className="data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-300">
            🔴 Live Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-4">
          <Suspense fallback={<div className="text-white/40 p-6">Loading clients…</div>}>
            <AdminHireAlertClients />
          </Suspense>
        </TabsContent>

        <TabsContent value="waterfall" className="mt-4">
          <WaterfallDiagnostics scannerFilter={["hire-alert-scanner"]} />
        </TabsContent>

        <TabsContent value="ingest" className="mt-4">
          <Suspense fallback={<div className="text-white/40 p-6">Loading ingest…</div>}>
            <AdminTalentIngest />
          </Suspense>
        </TabsContent>

        <TabsContent value="live-log" className="mt-4">
          <TalentRadarLiveLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
