import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Sparkles, Filter, Users, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const VERTICAL_OPTIONS = ["", "trades", "healthcare", "manufacturing", "field-service", "real-estate", "professional-services"];
const SIGNAL_PRESETS = ["hiring", "permit", "expansion", "grant", "rfp", "competitor-mention", "leadership-change", "funding"];

export default function CohortCampaignBuilder() {
  const [campaignName, setCampaignName] = useState("");
  const [campaignBrief, setCampaignBrief] = useState("");
  const [vertical, setVertical] = useState("");
  const [state, setState] = useState("MI");
  const [minScore, setMinScore] = useState(60);
  const [limit, setLimit] = useState(25);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [signalTypes, setSignalTypes] = useState<string[]>([]);
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const toggleSignal = (s: string) => {
    setSignalTypes((arr) => arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]);
  };

  const submit = async () => {
    if (!campaignName.trim() || !campaignBrief.trim()) {
      toast.error("Campaign name + brief required");
      return;
    }
    setBusy(true);
    setLastResult(null);
    const { data, error } = await supabase.functions.invoke("cohort-campaign-builder", {
      body: {
        campaign_name: campaignName.trim().replace(/[^a-z0-9-]+/gi, "-").toLowerCase(),
        campaign_brief: campaignBrief.trim(),
        vertical: vertical || undefined,
        state: state || undefined,
        min_score: minScore,
        limit,
        channel,
        signal_types: signalTypes.length ? signalTypes : undefined,
        subject_template: subjectTemplate || undefined,
      },
    });
    setBusy(false);
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    setLastResult(data);
    toast.success(`Drafted ${data?.drafted || 0} into approval queue`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#00d4ff]" /> Cohort Campaign Builder
        </h2>
        <p className="text-white/50 text-sm">
          Pick a slice of high-intent accounts. AI personalizes one draft per account using their actual signals. All drafts land in the approval queue — nothing sends until you say so.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3 p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="text-xs uppercase tracking-wider text-white/50 font-bold flex items-center gap-2">
            <Send className="w-3 h-3" /> Campaign
          </div>
          <input
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="campaign-name (slug)"
            className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 text-white text-sm focus:border-[#00d4ff] outline-none"
          />
          <textarea
            value={campaignBrief}
            onChange={(e) => setCampaignBrief(e.target.value)}
            placeholder='Brief: "Pitch FieldDesk to trades hiring 3+ techs this month — emphasize 7-day onboarding."'
            rows={4}
            className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 text-white text-sm focus:border-[#00d4ff] outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setChannel("email")}
              className={`flex-1 px-3 py-2 rounded text-xs font-bold flex items-center justify-center gap-1 transition ${channel === "email" ? "bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40" : "bg-white/5 text-white/60 border border-white/10"}`}
            ><Mail className="w-3 h-3" /> Email</button>
            <button
              onClick={() => setChannel("sms")}
              className={`flex-1 px-3 py-2 rounded text-xs font-bold flex items-center justify-center gap-1 transition ${channel === "sms" ? "bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40" : "bg-white/5 text-white/60 border border-white/10"}`}
            ><MessageSquare className="w-3 h-3" /> SMS</button>
          </div>
          {channel === "email" && (
            <input
              value={subjectTemplate}
              onChange={(e) => setSubjectTemplate(e.target.value)}
              placeholder="Subject template (optional, use {{name}})"
              className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 text-white text-sm focus:border-[#00d4ff] outline-none"
            />
          )}
        </div>

        <div className="space-y-3 p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="text-xs uppercase tracking-wider text-white/50 font-bold flex items-center gap-2">
            <Filter className="w-3 h-3" /> Cohort Filters
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-white/60">
              Vertical
              <select value={vertical} onChange={(e) => setVertical(e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded bg-black/40 border border-white/10 text-white text-sm">
                {VERTICAL_OPTIONS.map((v) => <option key={v} value={v}>{v || "any"}</option>)}
              </select>
            </label>
            <label className="text-xs text-white/60">
              State
              <input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} className="mt-1 w-full px-2 py-1.5 rounded bg-black/40 border border-white/10 text-white text-sm" />
            </label>
            <label className="text-xs text-white/60">
              Min Score: <span className="text-[#00d4ff]">{minScore}</span>
              <input type="range" min={30} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="mt-1 w-full" />
            </label>
            <label className="text-xs text-white/60">
              Max accounts: <span className="text-[#00d4ff]">{limit}</span>
              <input type="range" min={5} max={200} step={5} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="mt-1 w-full" />
            </label>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Required signal types (any match)</div>
            <div className="flex flex-wrap gap-1">
              {SIGNAL_PRESETS.map((s) => (
                <button key={s} onClick={() => toggleSignal(s)}
                  className={`text-[10px] px-2 py-1 rounded font-mono transition ${signalTypes.includes(s) ? "bg-[#00d4ff]/30 text-[#00d4ff] border border-[#00d4ff]/50" : "bg-white/5 text-white/50 border border-white/10"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        disabled={busy}
        onClick={submit}
        className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-[#00d4ff] to-cyan-400 text-black font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 hover:brightness-110"
      >
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Drafting personalized {channel === "sms" ? "SMS" : "emails"}…</> : <><Users className="w-4 h-4" /> Build Cohort & Draft Outreach</>}
      </button>

      {lastResult && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm">
          <div className="font-bold text-emerald-300 mb-2">Cohort processed</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div><div className="text-white/50">Cohort size</div><div className="text-white font-bold text-lg">{lastResult.cohort_size}</div></div>
            <div><div className="text-white/50">Drafted</div><div className="text-emerald-300 font-bold text-lg">{lastResult.drafted}</div></div>
            <div><div className="text-white/50">Skipped (dup)</div><div className="text-amber-300 font-bold text-lg">{lastResult.skipped}</div></div>
            <div><div className="text-white/50">No contact</div><div className="text-rose-300 font-bold text-lg">{lastResult.no_contact}</div></div>
          </div>
          {lastResult.errors?.length > 0 && (
            <div className="mt-3 text-xs text-rose-300/80">
              <div className="font-bold mb-1">Errors:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {lastResult.errors.slice(0, 5).map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <div className="mt-3 text-white/60 text-xs">→ Review & approve in the Approval Queue tab.</div>
        </div>
      )}
    </div>
  );
}
