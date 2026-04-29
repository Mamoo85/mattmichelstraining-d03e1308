import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GripVertical } from "lucide-react";
import LeadVerificationBadges from "@/components/admin/LeadVerificationBadges";

type Lead = {
  id: string;
  full_name: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  score: number;
  signal_type: string;
  pipeline_stage?: string | null;
  verifier_grounded?: boolean | null;
  verifier_citation_match?: boolean | null;
  verification_method?: string | null;
  lat?: number | null;
  lng?: number | null;
};

const STAGES: { key: string; label: string; color: string }[] = [
  { key: "new", label: "New", color: "#64748b" },
  { key: "contacted", label: "Contacted", color: "#3b82f6" },
  { key: "appointment", label: "Appointment", color: "#fbbf24" },
  { key: "closed", label: "Closed", color: "#22c55e" },
];

export default function MortgageRadarPipeline({
  leads,
  onChange,
}: {
  leads: Lead[];
  onChange: (id: string, stage: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);

  const stageOf = (l: Lead) => l.pipeline_stage || "new";

  async function moveTo(id: string, stage: string) {
    onChange(id, stage); // optimistic
    const { error } = await (supabase.from as any)("mortgage_radar_leads")
      .update({ pipeline_stage: stage, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Couldn't save — reverting");
      onChange(id, "new");
    } else {
      toast.success(`Moved to ${stage}`);
    }
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {STAGES.map((stage) => {
        const items = leads.filter((l) => stageOf(l) === stage.key);
        return (
          <div
            key={stage.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) {
                moveTo(dragId, stage.key);
                setDragId(null);
              }
            }}
            className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-2 min-h-[300px]"
          >
            <div className="flex items-center justify-between px-1 py-2 mb-2 border-b border-[#1e3a5f]">
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: stage.color }}
              >
                ● {stage.label}
              </span>
              <span className="text-[10px] text-[#64748b] font-mono">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 && (
                <p className="text-[10px] text-[#475569] text-center py-4">Drop leads here</p>
              )}
              {items.map((l) => (
                <div
                  key={l.id}
                  draggable
                  onDragStart={() => setDragId(l.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`bg-[#030711] border rounded p-2 cursor-grab active:cursor-grabbing transition-colors ${
                    l.score >= 9 ? "border-[#00d4ff]/60" : "border-[#1e3a5f] hover:border-[#1e3a5f]/80"
                  }`}
                >
                  <div className="flex items-start gap-1">
                    <GripVertical className="w-3 h-3 text-[#475569] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">
                        {l.full_name || "Lead"}
                      </p>
                      <p className="text-[10px] text-[#94a3b8] truncate">{l.address}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] text-[#64748b] uppercase">
                          {l.signal_type.replace(/_/g, " ")}
                        </span>
                        <span
                          className={`text-[10px] font-black ${
                            l.score >= 9 ? "text-[#00d4ff]" : "text-[#94a3b8]"
                          }`}
                        >
                          {l.score}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <LeadVerificationBadges
                          verifier_grounded={l.verifier_grounded}
                          verifier_citation_match={l.verifier_citation_match}
                          verification_method={l.verification_method}
                          has_coordinates={l.lat != null && l.lng != null}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Mobile fallback — quick stage select */}
                  <select
                    value={stage.key}
                    onChange={(e) => moveTo(l.id, e.target.value)}
                    className="lg:hidden mt-1.5 w-full bg-[#0a1628] border border-[#1e3a5f] rounded text-[10px] text-white px-1 py-0.5"
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
