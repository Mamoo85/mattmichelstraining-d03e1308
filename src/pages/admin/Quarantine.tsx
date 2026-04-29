import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface QuarantinedLead {
  id: string;
  full_name: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  signal_type: string | null;
  intent_score: number | null;
  verifier_grounded: boolean | null;
  pipeline_stage: string;
  updated_at: string;
}

export default function Quarantine() {
  const [rows, setRows] = useState<QuarantinedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from as any)("mortgage_radar_leads")
      .select("id, full_name, address, city, zip, signal_type, intent_score, verifier_grounded, pipeline_stage, updated_at")
      .eq("pipeline_stage", "quarantined")
      .order("updated_at", { ascending: false })
      .limit(200);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runScan = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("quarantine-daily-report");
      if (error) throw error;
      toast({ title: "Quarantine run complete", description: `Quarantined ${data?.quarantined ?? 0} leads.` });
      await load();
    } catch (e: any) {
      toast({ title: "Run failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <h1 className="text-2xl font-bold">Quarantine</h1>
        </div>
        <Button onClick={runScan} disabled={running} size="sm">
          <RefreshCw className={`w-4 h-4 mr-1 ${running ? "animate-spin" : ""}`} /> Run scan
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Leads flagged as ungrounded, low-intent, or unverifiable. Excluded from outreach.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No quarantined leads. ✨</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{r.full_name || "(unknown)"}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.address}{r.city ? `, ${r.city}` : ""} {r.zip || ""}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Signal: {r.signal_type || "—"} · Intent: {r.intent_score ?? 0}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="border-amber-500/40 text-amber-300">quarantined</Badge>
                  {r.verifier_grounded === false && <Badge variant="outline" className="text-xs">ungrounded</Badge>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
