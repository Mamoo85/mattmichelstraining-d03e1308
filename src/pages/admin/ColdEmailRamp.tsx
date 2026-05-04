import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface RampState {
  id: number;
  ramp_start_date: string;
  base_cap: number;
  step_per_day: number;
  ceiling: number;
  bounce_threshold_pct: number;
  complaint_threshold_pct: number;
  paused: boolean;
  pause_reason: string | null;
  current_cap: number;
  last_evaluated_at: string | null;
}

interface HistoryRow {
  id: string; evaluated_at: string; day_index: number; sent_24h: number;
  bounce_pct: number; complaint_pct: number; prev_cap: number; new_cap: number;
  action: string; notes: string | null;
}

export default function ColdEmailRamp() {
  const [state, setState] = useState<RampState | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Partial<RampState>>({});

  const load = async () => {
    const [{ data: s }, { data: h }] = await Promise.all([
      supabase.from("cold_email_ramp_state" as any).select("*").eq("id", 1).maybeSingle(),
      supabase.from("cold_email_ramp_history" as any).select("*").order("evaluated_at", { ascending: false }).limit(30),
    ]);
    if (s) { setState(s as any); setDraft(s as any); }
    setHistory((h as any) || []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!state) return;
    setLoading(true);
    const { error } = await supabase.from("cold_email_ramp_state" as any).update({
      base_cap: Number(draft.base_cap ?? state.base_cap),
      step_per_day: Number(draft.step_per_day ?? state.step_per_day),
      ceiling: Number(draft.ceiling ?? state.ceiling),
      bounce_threshold_pct: Number(draft.bounce_threshold_pct ?? state.bounce_threshold_pct),
      complaint_threshold_pct: Number(draft.complaint_threshold_pct ?? state.complaint_threshold_pct),
      current_cap: Number(draft.current_cap ?? state.current_cap),
      paused: !!(draft.paused ?? state.paused),
      pause_reason: draft.pause_reason ?? state.pause_reason,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setLoading(false);
    if (error) toast.error(error.message); else { toast.success("Saved"); load(); }
  };

  const runDry = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("cold-email-ramp-scheduler", {
      body: {}, method: "POST",
    } as any);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success(`Dry preview: ${JSON.stringify(data)}`);
  };

  const runNow = async () => {
    setLoading(true);
    const projectRef = "eauvubfpanpeuxsrqesu";
    const res = await fetch(`https://${projectRef}.supabase.co/functions/v1/cold-email-ramp-scheduler`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) toast.error(data.error);
    else { toast.success(`Action: ${data.action} · cap ${data.prevCap}→${data.newCap}`); load(); }
  };

  if (!state) return <div className="p-6">Loading…</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cold Email Volume Ramp</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runDry} disabled={loading}>Dry Run</Button>
          <Button onClick={runNow} disabled={loading}>Run Now</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Current Cap</p>
          <p className="text-3xl font-bold">{state.current_cap}/day</p>
          <p className="text-xs mt-1">Ceiling {state.ceiling} · Step +{state.step_per_day}/day</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge variant={state.paused ? "destructive" : "default"}>
            {state.paused ? "PAUSED" : "ACTIVE"}
          </Badge>
          {state.pause_reason && <p className="text-xs mt-1 text-destructive">{state.pause_reason}</p>}
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Last Evaluated</p>
          <p className="text-sm">{state.last_evaluated_at ? new Date(state.last_evaluated_at).toLocaleString() : "Never"}</p>
          <p className="text-xs mt-1">Started {state.ramp_start_date}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Settings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            ["base_cap","Base Cap"],
            ["step_per_day","Step / Day"],
            ["ceiling","Ceiling"],
            ["current_cap","Current Cap"],
            ["bounce_threshold_pct","Bounce %"],
            ["complaint_threshold_pct","Complaint %"],
          ].map(([k,label]) => (
            <div key={k}>
              <label className="text-xs text-muted-foreground">{label}</label>
              <Input type="number" step="0.01"
                value={(draft as any)[k] ?? (state as any)[k]}
                onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })} />
            </div>
          ))}
          <div className="flex items-end gap-2">
            <Button size="sm" variant={draft.paused ? "destructive" : "outline"}
              onClick={() => setDraft({ ...draft, paused: !(draft.paused ?? state.paused) })}>
              {(draft.paused ?? state.paused) ? "Paused" : "Active"}
            </Button>
            <Button size="sm" onClick={save} disabled={loading}>Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Last 30 Evaluations</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-muted-foreground border-b">
                <th className="p-2">When</th><th className="p-2">Day</th><th className="p-2">Sent 24h</th>
                <th className="p-2">Bounce%</th><th className="p-2">Complaint%</th>
                <th className="p-2">Cap</th><th className="p-2">Action</th>
              </tr></thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">{new Date(r.evaluated_at).toLocaleString()}</td>
                    <td className="p-2">{r.day_index}</td>
                    <td className="p-2">{r.sent_24h}</td>
                    <td className="p-2">{r.bounce_pct}</td>
                    <td className="p-2">{r.complaint_pct}</td>
                    <td className="p-2">{r.prev_cap}→{r.new_cap}</td>
                    <td className="p-2">
                      <Badge variant={r.action.startsWith("halved") ? "destructive" : "secondary"}>
                        {r.action}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {!history.length && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No evaluations yet</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
