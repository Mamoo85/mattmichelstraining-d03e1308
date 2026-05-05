import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Stage = "new" | "enriched" | "emailed" | "replied" | "demo_booked" | "won" | "lost";

interface Lead {
  id: string;
  business_name: string;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  city: string | null;
  industry: string | null;
  source: string | null;
  pipeline_stage: Stage;
  enriched_at: string | null;
  created_at: string;
}

const STAGES: { id: Stage; label: string; color: string; mrr: number }[] = [
  { id: "new",        label: "New Lead",    color: "border-slate-600",   mrr: 0 },
  { id: "enriched",   label: "Enriched",    color: "border-blue-600",    mrr: 0 },
  { id: "emailed",    label: "Emailed",     color: "border-yellow-600",  mrr: 0 },
  { id: "replied",    label: "Replied",     color: "border-orange-500",  mrr: 0 },
  { id: "demo_booked",label: "Demo Booked", color: "border-purple-500",  mrr: 149 },
  { id: "won",        label: "Won ✅",      color: "border-green-500",   mrr: 149 },
  { id: "lost",       label: "Lost",        color: "border-red-700",     mrr: 0 },
];

const STAGE_LABELS: Record<Stage, string> = Object.fromEntries(
  STAGES.map((s) => [s.id, s.label])
) as Record<Stage, string>;

export default function MattSalesPipeline() {
  const qc = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);

  const { data: leads, isLoading } = useQuery({
    queryKey: ["sales_pipeline_leads"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("outreach_leads")
        .select("id, business_name, owner_name, owner_email, owner_phone, city, industry, source, pipeline_stage, enriched_at, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Lead[];
    },
    refetchInterval: 60000,
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      await (supabase as any)
        .from("outreach_leads")
        .update({ pipeline_stage: stage, pipeline_updated_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales_pipeline_leads"] }),
  });

  const byStage = (stage: Stage) => (leads || []).filter((l) => l.pipeline_stage === stage);

  const pipelineValue = (leads || [])
    .filter((l) => l.pipeline_stage === "demo_booked")
    .length * 149;

  const wonMrr = (leads || [])
    .filter((l) => l.pipeline_stage === "won")
    .length * 149;

  const handleDrop = (e: React.DragEvent, targetStage: Stage) => {
    e.preventDefault();
    if (dragging) moveStage.mutate({ id: dragging, stage: targetStage });
    setDragging(null);
  };

  if (isLoading) return <div className="p-8 text-slate-400">Loading pipeline…</div>;

  return (
    <div className="min-h-screen bg-[#0a1628] p-6">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Matt's Sales Pipeline</h1>
          <p className="text-slate-400 text-sm mt-1">{leads?.length ?? 0} total leads</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-[#162236] rounded-lg px-4 py-2 text-center">
            <div className="text-xl font-bold text-purple-400">${pipelineValue.toLocaleString()}/mo</div>
            <div className="text-xs text-slate-400">Pipeline Value</div>
          </div>
          <div className="bg-[#162236] rounded-lg px-4 py-2 text-center">
            <div className="text-xl font-bold text-green-400">${wonMrr.toLocaleString()}/mo</div>
            <div className="text-xs text-slate-400">Won MRR</div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageLeads = byStage(stage.id);
          return (
            <div
              key={stage.id}
              className={`flex-shrink-0 w-64 rounded-xl border-2 ${stage.color} bg-[#111d30] p-3`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-200">{stage.label}</span>
                <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                  {stageLeads.length}
                </Badge>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragging(lead.id)}
                    onDragEnd={() => setDragging(null)}
                    className={`bg-[#1a2a40] rounded-lg p-3 cursor-grab active:cursor-grabbing border border-slate-700 hover:border-slate-500 transition-colors ${dragging === lead.id ? "opacity-50" : ""}`}
                  >
                    <p className="text-white text-sm font-medium truncate">{lead.business_name}</p>
                    {lead.city && <p className="text-slate-400 text-xs">{lead.city}</p>}
                    {lead.owner_email && (
                      <p className="text-cyan-400 text-xs truncate mt-1">{lead.owner_email}</p>
                    )}
                    {lead.source && (
                      <span className="inline-block mt-1 text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                        {lead.source}
                      </span>
                    )}
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {STAGES.filter((s) => s.id !== stage.id && s.id !== "lost").slice(0, 3).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => moveStage.mutate({ id: lead.id, stage: s.id })}
                          className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded transition-colors"
                        >
                          → {STAGE_LABELS[s.id].split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {stageLeads.length === 0 && (
                  <p className="text-slate-600 text-xs text-center py-4">Drop leads here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
