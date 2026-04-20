import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ExternalLink } from "lucide-react";
import DemandThroughputKPIs from "./DemandThroughputKPIs";
import DemandRadarLiveLog from "./DemandRadarLiveLog";

const AdminDemandRadar = lazy(() => import("./AdminDemandRadar"));

interface Signal {
  id: string;
  company_name: string | null;
  location: string | null;
  vertical: string | null;
  signal_type: string | null;
  expansion_type: string | null;
  predicted_needs: string | null;
  confidence: number | null;
  detected_at: string;
  source_url: string | null;
}

const GROWTH_TYPES = ["expansion", "rd_grant", "sba_loan", "new_business_entity", "investment", "permit_new"];
const PULSE_TYPES = ["hiring", "permit_surge", "school_rfp", "contract_award", "rfp"];

function FilteredSignalList({ types, label }: { types: string[]; label: string }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("industry_pulse_signals" as any)
        .select("id, company_name, location, vertical, signal_type, expansion_type, predicted_needs, confidence, detected_at, source_url")
        .in("signal_type", types)
        .order("detected_at", { ascending: false })
        .limit(80);
      setSignals(((data as any) || []) as Signal[]);
      setLoading(false);
    })();
  }, [types]);

  if (loading) return <div className="flex items-center gap-2 text-white/50 p-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading {label}…</div>;
  if (signals.length === 0) return <div className="text-white/40 text-sm p-6 text-center">No {label} signals found yet. Scanners will populate this view.</div>;

  return (
    <div className="space-y-2">
      <div className="text-xs text-white/50">
        Showing <span className="text-white font-bold">{signals.length}</span> {label} signals · types: <span className="font-mono text-[#00d4ff]">{types.join(", ")}</span>
      </div>
      {signals.map((s) => (
        <div key={s.id} className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 p-3 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white truncate">{s.company_name || "Unknown company"}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00d4ff]/20 text-[#00d4ff] font-mono">{s.signal_type}</span>
                {s.vertical && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-mono">{s.vertical}</span>}
                {s.confidence != null && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">conf {s.confidence}</span>}
              </div>
              {s.location && <div className="text-xs text-white/50 mt-0.5">{s.location}</div>}
              {s.predicted_needs && <div className="text-xs text-white/70 mt-1">{s.predicted_needs}</div>}
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-white/40">{new Date(s.detected_at).toLocaleDateString()}</div>
              {s.source_url && (
                <a href={s.source_url} target="_blank" rel="noreferrer" className="text-[#00d4ff] hover:underline text-xs inline-flex items-center gap-1 mt-1">
                  source <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DemandRadarHub() {
  const [tab, setTab] = useState("throughput");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          📈 <span>Demand Radar Hub</span>
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Buying-intent intelligence — throughput math, full signals feed, Growth Radar (expansion/grants), Industry Pulse (hiring/permits/RFPs), and the live error log.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 border border-white/10 h-auto flex-wrap">
          <TabsTrigger value="throughput" className="data-[state=active]:bg-[#00d4ff]/20 data-[state=active]:text-[#00d4ff]">
            📊 Throughput
          </TabsTrigger>
          <TabsTrigger value="signals" className="data-[state=active]:bg-[#00d4ff]/20 data-[state=active]:text-[#00d4ff]">
            📡 All Signals
          </TabsTrigger>
          <TabsTrigger value="growth" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300">
            🌱 Growth Radar
          </TabsTrigger>
          <TabsTrigger value="pulse" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
            🏭 Industry Pulse
          </TabsTrigger>
          <TabsTrigger value="live-log" className="data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-300">
            🔴 Live Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="throughput" className="mt-4">
          <DemandThroughputKPIs />
        </TabsContent>

        <TabsContent value="signals" className="mt-4">
          <Suspense fallback={<div className="text-white/40 p-6">Loading signals…</div>}>
            <AdminDemandRadar />
          </Suspense>
        </TabsContent>

        <TabsContent value="growth" className="mt-4">
          <FilteredSignalList types={GROWTH_TYPES} label="Growth Radar" />
        </TabsContent>

        <TabsContent value="pulse" className="mt-4">
          <FilteredSignalList types={PULSE_TYPES} label="Industry Pulse" />
        </TabsContent>

        <TabsContent value="live-log" className="mt-4">
          <DemandRadarLiveLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
