// Channel 5 — Daily call sheet for Matt's cold-call outreach.
// Pulls top high-confidence Growth Signals, generates 1-line opener per row.
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, RefreshCw, Loader2, Check, X, Clock, FileText } from "lucide-react";

interface Signal {
  id: string;
  company_name: string;
  location: string | null;
  industry: string | null;
  hiring_roles: string[];
  hiring_count: number;
  predicted_needs: string[];
  confidence: number;
}

interface CallLog {
  id: string;
  signal_id: string | null;
  target_company: string;
  outcome: string;
  created_at: string;
}

const OUTCOMES = [
  { key: "interested", label: "✅ Interested", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
  { key: "callback", label: "⏰ Callback", color: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
  { key: "no_answer", label: "📵 No Answer", color: "bg-white/5 text-white/40 border-white/10" },
  { key: "not_interested", label: "❌ Not Interested", color: "bg-red-500/20 text-red-400 border-red-500/40" },
];

export default function AdminCallList() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [logs, setLogs] = useState<Record<string, CallLog>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: sig }, { data: logData }] = await Promise.all([
      (supabase as any)
        .from("industry_pulse_signals")
        .select("id,company_name,location,industry,hiring_roles,hiring_count,predicted_needs,confidence")
        .gte("confidence", 7)
        .order("confidence", { ascending: false })
        .order("detected_at", { ascending: false })
        .limit(20),
      (supabase as any)
        .from("call_outreach_log")
        .select("*")
        .gte("call_date", today),
    ]);
    setSignals(sig || []);
    const byId: Record<string, CallLog> = {};
    (logData || []).forEach((l: CallLog) => { if (l.signal_id) byId[l.signal_id] = l; });
    setLogs(byId);
    setLoading(false);
  }

  function opener(s: Signal): string {
    return `Hey, this is Matt with Detroit Web Agency over in Grosse Pointe. Quick one — I track Metro Detroit manufacturers right when they start hiring, and ${s.company_name} just hit my list with ${s.hiring_count} ${s.hiring_roles[0] || "openings"}. Usually means a spend cycle is coming on ${s.predicted_needs[0] || "supplies"}. Would your branch want me to email that intel over? Free.`;
  }

  async function logOutcome(s: Signal, outcome: string) {
    setSavingId(s.id);
    try {
      const { data, error } = await (supabase as any).from("call_outreach_log").insert({
        signal_id: s.id,
        target_company: s.company_name,
        outcome,
        notes: `${s.industry || ""} · ${s.location || ""} · ${s.hiring_count}× ${s.hiring_roles.join(", ")}`,
      }).select().single();
      if (error) throw error;
      setLogs(prev => ({ ...prev, [s.id]: data as CallLog }));
      toast.success("Logged");
    } catch (e: any) {
      toast.error("Failed: " + (e.message || "unknown"));
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Phone className="h-5 w-5 text-[#00d4ff]" /> Daily Call Sheet
          </h2>
          <p className="text-white/40 text-xs mt-1">Top {signals.length} high-confidence signals · 1 opener each · log outcomes inline</p>
        </div>
        <Button size="sm" onClick={load} className="bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30">
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded p-3 text-[11px] text-amber-300/80">
        Use DWA work line: <strong className="text-amber-200">(313) 992-1219</strong> · 30-second pitch · always offer free dossier first
      </div>

      <div className="space-y-3">
        {signals.map(s => {
          const log = logs[s.id];
          return (
            <Card key={s.id} className={`bg-[#0f1f35] border-white/10 ${log ? "opacity-60" : ""}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-bold text-sm">{s.company_name}</p>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">{s.confidence}/10</Badge>
                      {log && <Badge className="bg-white/10 text-white/60 border-white/20 text-[10px]">{OUTCOMES.find(o => o.key === log.outcome)?.label || log.outcome}</Badge>}
                    </div>
                    <p className="text-white/40 text-xs mt-0.5">{s.location || "MI"} · {s.industry || "Industrial"} · {s.hiring_count}× {s.hiring_roles.slice(0, 2).join(", ")}</p>
                  </div>
                </div>
                <div className="bg-black/30 border-l-2 border-[#00d4ff]/40 px-3 py-2 text-white/70 text-xs leading-relaxed">
                  <FileText className="inline h-3 w-3 mr-1 text-[#00d4ff]" /> {opener(s)}
                </div>
                {!log && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white/30 text-[10px] uppercase tracking-wide">Outcome:</span>
                    {OUTCOMES.map(o => (
                      <Button
                        key={o.key}
                        size="sm"
                        disabled={savingId === s.id}
                        onClick={() => logOutcome(s, o.key)}
                        className={`text-xs border ${o.color} hover:opacity-80`}
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {signals.length === 0 && (
          <Card className="bg-[#0f1f35] border-white/10">
            <CardContent className="py-10 text-center text-white/40 text-sm">No high-confidence signals yet. Run the Pulse Scanner.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
