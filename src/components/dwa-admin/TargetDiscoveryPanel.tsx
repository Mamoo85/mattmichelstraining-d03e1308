// Target Discovery Panel — autonomous prospecting UI
// Replaces CSV upload. Fires `outreach-target-discover` and shows recent runs.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Radar, Save, Play } from "lucide-react";

const VERTICALS = [
  "roofing", "plumbing", "hvac", "electrical", "landscaping", "arborist",
  "concrete", "painting", "flooring", "siding", "general_contractor", "garage_door",
];
const STATES = ["MI", "OH", "IN", "IL", "WI", "TX", "FL", "CA", "NY", "AZ", "TN", "GA", "NC", "PA"];

interface Run {
  id: string;
  status: string;
  discovered: number;
  enriched: number;
  inserted: number;
  skipped_dupe: number;
  skipped_compliance: number;
  cost_cents: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  criteria: any;
}

export default function TargetDiscoveryPanel() {
  const [verticals, setVerticals] = useState<string[]>(["roofing"]);
  const [states, setStates] = useState<string[]>(["MI"]);
  const [cities, setCities] = useState("");
  const [channel, setChannel] = useState<"email" | "fax" | "postcard">("email");
  const [limit, setLimit] = useState(50);
  const [minConfidence, setMinConfidence] = useState(40);
  const [recipeName, setRecipeName] = useState("");
  const [scheduleCron, setScheduleCron] = useState("");
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);

  async function loadRuns() {
    const { data } = await supabase
      .from("discovery_runs" as any)
      .select("*")
      .order("started_at", { ascending: false })
      .limit(15);
    setRuns((data as any) || []);
  }

  useEffect(() => { loadRuns(); }, []);

  function toggle(arr: string[], setArr: (a: string[]) => void, v: string) {
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  async function discover() {
    if (verticals.length === 0 || states.length === 0) {
      toast.error("Pick at least one vertical and state"); return;
    }
    setBusy(true);
    try {
      const cityList = cities.split(",").map((c) => c.trim()).filter(Boolean);
      const { data, error } = await supabase.functions.invoke("outreach-target-discover", {
        body: {
          verticals, states,
          cities: cityList.length ? cityList : undefined,
          channel_intent: channel,
          limit,
          min_confidence: minConfidence,
          exclude_existing: true,
          exclude_founders: true,
        },
      });
      if (error) throw error;
      toast.success(`Discovered ${data?.summary?.discovered ?? 0}, inserted ${data?.summary?.inserted ?? 0}`);
      loadRuns();
    } catch (e) {
      toast.error(`Discovery failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveRecipe() {
    if (!recipeName.trim()) { toast.error("Name the recipe"); return; }
    const cityList = cities.split(",").map((c) => c.trim()).filter(Boolean);
    const { error } = await supabase.from("outreach_target_recipes" as any).insert({
      name: recipeName.trim(),
      schedule_cron: scheduleCron.trim() || null,
      criteria: {
        verticals, states,
        cities: cityList.length ? cityList : undefined,
        channel_intent: channel,
        limit, min_confidence: minConfidence,
        exclude_existing: true, exclude_founders: true,
      },
    });
    if (error) toast.error(error.message);
    else { toast.success("Recipe saved"); setRecipeName(""); setScheduleCron(""); }
  }

  return (
    <div className="space-y-4">
      <div className="border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 to-slate-900/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Radar className="w-5 h-5 text-cyan-400" />
          <h3 className="font-bold text-white">Target Discovery Engine</h3>
          <span className="text-[10px] uppercase bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">autonomous</span>
        </div>
        <p className="text-xs text-white/60 mb-4">
          Chains Google Places + DataForSEO → email waterfall (Apollo/Hunter/Snov/Firecrawl) → fax/phone scrape →
          DNC + founder scrub → confidence score → insert. No CSV needed.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Verticals</label>
            <div className="flex flex-wrap gap-1.5">
              {VERTICALS.map((v) => (
                <button key={v} onClick={() => toggle(verticals, setVerticals, v)}
                  className={`text-xs px-2 py-1 rounded border ${verticals.includes(v) ? "bg-cyan-500 border-cyan-400 text-slate-900 font-bold" : "bg-slate-950 border-white/10 text-white/60"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">States</label>
            <div className="flex flex-wrap gap-1.5">
              {STATES.map((s) => (
                <button key={s} onClick={() => toggle(states, setStates, s)}
                  className={`text-xs px-2 py-1 rounded border ${states.includes(s) ? "bg-cyan-500 border-cyan-400 text-slate-900 font-bold" : "bg-slate-950 border-white/10 text-white/60"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Cities (comma-sep, optional)</label>
            <input value={cities} onChange={(e) => setCities(e.target.value)}
              placeholder="Detroit, Warren, Troy"
              className="w-full bg-slate-950 border border-white/10 text-white text-sm px-2 py-1.5 rounded" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Channel intent</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value as any)}
              className="w-full bg-slate-950 border border-white/10 text-white text-sm px-2 py-1.5 rounded">
              <option value="email">email</option><option value="fax">fax</option><option value="postcard">postcard</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Limit / vertical-city</label>
            <input type="number" value={limit} onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
              className="w-full bg-slate-950 border border-white/10 text-white text-sm px-2 py-1.5 rounded" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Min confidence (0-100)</label>
            <input type="number" value={minConfidence} onChange={(e) => setMinConfidence(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-white/10 text-white text-sm px-2 py-1.5 rounded" />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 mt-4 pt-4 border-t border-white/10">
          <button onClick={discover} disabled={busy}
            className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-slate-900 font-bold text-sm px-4 py-2 rounded flex items-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run discovery now
          </button>
          <div className="flex items-end gap-2 ml-auto">
            <input value={recipeName} onChange={(e) => setRecipeName(e.target.value)}
              placeholder="Recipe name"
              className="bg-slate-950 border border-white/10 text-white text-sm px-2 py-1.5 rounded" />
            <input value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)}
              placeholder="Cron (optional, e.g. 0 7 * * *)"
              className="bg-slate-950 border border-white/10 text-white text-xs px-2 py-1.5 rounded w-44 font-mono" />
            <button onClick={saveRecipe}
              className="bg-white/5 hover:bg-white/10 text-white/80 text-xs px-3 py-1.5 rounded flex items-center gap-1">
              <Save className="w-3 h-3" /> Save recipe
            </button>
          </div>
        </div>
      </div>

      <div className="border border-white/10 bg-slate-900/50 rounded-lg p-4">
        <h3 className="text-sm font-bold text-white mb-3">Recent discovery runs</h3>
        {runs.length === 0 ? (
          <div className="text-xs text-white/40">No runs yet. Fire one above.</div>
        ) : (
          <div className="space-y-1.5">
            {runs.map((r) => (
              <div key={r.id} className="text-xs grid grid-cols-12 gap-2 items-center bg-slate-950/40 border border-white/5 rounded px-2 py-1.5">
                <span className={`col-span-2 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-center ${
                  r.status === "completed" ? "bg-emerald-500/20 text-emerald-400"
                  : r.status === "running" ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-red-500/20 text-red-400"
                }`}>{r.status}</span>
                <span className="col-span-3 text-white/50 truncate">
                  {(r.criteria?.verticals || []).join(",")} · {(r.criteria?.states || []).join(",")}
                </span>
                <span className="col-span-1 text-white/70">D:{r.discovered}</span>
                <span className="col-span-1 text-white/70">E:{r.enriched}</span>
                <span className="col-span-1 text-emerald-400 font-bold">+{r.inserted}</span>
                <span className="col-span-1 text-white/40">d:{r.skipped_dupe}</span>
                <span className="col-span-1 text-white/40">c:{r.skipped_compliance}</span>
                <span className="col-span-2 text-white/40 text-right">{new Date(r.started_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
