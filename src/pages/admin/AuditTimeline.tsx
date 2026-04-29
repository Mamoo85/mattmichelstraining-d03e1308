import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

interface AuditRow {
  id: string;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  actor: string | null;
  details: any;
  created_at: string;
}

export default function AuditTimeline() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from as any)("admin_decision_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5" />
        <h1 className="text-2xl font-bold">Audit Timeline</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Budget-cap changes, quiet-hour suppressions, DLQ transitions, quarantine runs.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No audit entries yet.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.action_type}</Badge>
                  {r.entity_type && <span className="text-xs text-muted-foreground">{r.entity_type}</span>}
                  {r.entity_id && <code className="text-[10px] text-muted-foreground">{r.entity_id.slice(0, 8)}</code>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <div className="text-xs text-muted-foreground mb-1">actor: {r.actor || "system"}</div>
              <pre className="text-[10px] bg-muted/40 p-2 rounded overflow-x-auto">{JSON.stringify(r.details, null, 2)}</pre>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
