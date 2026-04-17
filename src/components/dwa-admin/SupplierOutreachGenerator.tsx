import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Copy, Mail } from "lucide-react";

interface Signal {
  id: string;
  company_name: string | null;
  location: string | null;
  vertical: string | null;
  expansion_type: string | null;
  predicted_needs: string | null;
  confidence: number | null;
}

const VERTICALS = [
  { key: "steel", label: "Steel (Ameristeel-style)" },
  { key: "plumbing_supply", label: "Plumbing Supply" },
  { key: "roofing_supply", label: "Roofing Supply" },
  { key: "hvac_supply", label: "HVAC Supply" },
  { key: "electrical_supply", label: "Electrical Supply" },
  { key: "concrete", label: "Concrete / Ready-Mix" },
  { key: "lumber", label: "Lumber / Building Materials" },
  { key: "industrial_general", label: "Industrial — Other" },
];

export default function SupplierOutreachGenerator() {
  const [supplier, setSupplier] = useState("Ameristeel");
  const [contact, setContact] = useState("");
  const [vertical, setVertical] = useState("steel");
  const [territory, setTerritory] = useState("Metro Detroit");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("industry_pulse_signals" as any)
        .select("id,company_name,location,vertical,expansion_type,predicted_needs,confidence")
        .eq("vertical", vertical)
        .gte("confidence", 6)
        .order("confidence", { ascending: false })
        .limit(15);
      setSignals((data as any) || []);
      setPicked([]);
    })();
  }, [vertical]);

  const toggle = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(0, 3)));
  };

  const generate = async () => {
    if (!supplier) return toast.error("Supplier name required");
    setGenerating(true);
    setDraft("");
    try {
      const recent = picked.length
        ? signals.filter((s) => picked.includes(s.id))
        : signals.slice(0, 3);
      const { data, error } = await supabase.functions.invoke("supplier-outreach-draft", {
        body: {
          supplier_name: supplier,
          contact_name: contact || undefined,
          vertical,
          territory,
          recent_signals: recent.map((r) => ({
            company_name: r.company_name,
            location: r.location,
            expansion_type: r.expansion_type,
            predicted_needs: r.predicted_needs,
            confidence: r.confidence,
          })),
          cherry_picked: picked.length > 0,
        },
      });
      if (error) throw error;
      setDraft(data?.draft || "");
      toast.success("Draft generated");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(draft);
    toast.success("Copied");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-lg font-bold flex items-center gap-2">
          <Mail size={20} className="text-[#00d4ff]" />
          Supplier Outreach Generator
        </h2>
        <p className="text-white/50 text-xs mt-1">
          Generate a Demand Radar pitch for any B2B supplier. Uses live signals matched to their vertical. Output is auto-scrubbed for client-safe language.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wide">Supplier</label>
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Ameristeel"
            className="w-full mt-1 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:border-[#00d4ff]/40 outline-none"
          />
        </div>
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wide">Contact (optional)</label>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Sales Manager"
            className="w-full mt-1 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:border-[#00d4ff]/40 outline-none"
          />
        </div>
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wide">Vertical</label>
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:border-[#00d4ff]/40 outline-none"
          >
            {VERTICALS.map((v) => (
              <option key={v.key} value={v.key} className="bg-[#0f1f35]">{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wide">Territory</label>
          <input
            value={territory}
            onChange={(e) => setTerritory(e.target.value)}
            placeholder="Metro Detroit"
            className="w-full mt-1 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:border-[#00d4ff]/40 outline-none"
          />
        </div>
      </div>

      <div>
        <p className="text-white/60 text-xs uppercase tracking-wide mb-2">
          Cherry-pick signals (max 3) — leave blank for top-3 auto
        </p>
        {signals.length === 0 ? (
          <div className="text-white/40 text-xs bg-[#0f1f35] border border-white/10 rounded-lg p-4">
            No signals (confidence ≥6) for this vertical yet. Run a manual enrich on the Demand Radar tab.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {signals.map((s) => {
              const on = picked.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-md border text-xs transition ${
                    on
                      ? "bg-[#00d4ff]/10 border-[#00d4ff]/40 text-white"
                      : "bg-white/5 border-white/10 text-white/70 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate">{s.company_name || "—"}</span>
                    <span className="text-[10px] text-emerald-300">{s.confidence}/10</span>
                  </div>
                  <div className="text-white/40 text-[11px] truncate">
                    {s.location} · {s.expansion_type}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={generate}
        disabled={generating}
        className="px-4 py-2 rounded-md bg-[#00d4ff]/15 border border-[#00d4ff]/40 hover:bg-[#00d4ff]/25 text-[#00d4ff] text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
      >
        {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        Generate Draft
      </button>

      {draft && (
        <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/40 text-xs uppercase tracking-wide">Draft</p>
            <button
              onClick={copy}
              className="px-2 py-1 rounded bg-white/5 border border-white/10 hover:border-[#00d4ff]/40 text-white/70 text-xs flex items-center gap-1"
            >
              <Copy size={12} /> Copy
            </button>
          </div>
          <pre className="text-white/80 text-xs whitespace-pre-wrap font-mono leading-relaxed">{draft}</pre>
        </div>
      )}
    </div>
  );
}
