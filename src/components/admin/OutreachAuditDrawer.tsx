import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Activity } from "lucide-react";

interface AuditRow {
  id: string;
  channel: string;
  event: string;
  reason: string | null;
  created_at: string;
  actor: string;
  metadata: Record<string, unknown> | null;
}

const EVENT_COLORS: Record<string, string> = {
  sent: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  opened: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",
  clicked: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",
  replied: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",
  unsubscribed: "text-red-300 bg-red-500/10 border-red-500/30",
  suppressed: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  consent_granted: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  consent_revoked: "text-red-300 bg-red-500/10 border-red-500/30",
  quiet_hours_blocked: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  daily_cap_blocked: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  bounce: "text-red-300 bg-red-500/10 border-red-500/30",
};

interface Props {
  prospectId: string | null;
  prospectName?: string;
  onClose: () => void;
}

export default function OutreachAuditDrawer({ prospectId, prospectName, onClose }: Props) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!prospectId) return;
    setLoading(true);
    supabase
      .from("contractor_outreach_audit_log" as never)
      .select("*")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        setLoading(false);
        if (!error) setRows(((data as any[]) || []) as AuditRow[]);
      });
  }, [prospectId]);

  if (!prospectId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-slate-950 border-l border-border overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-slate-950 border-b border-border p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Outreach Audit</p>
            <h3 className="text-sm font-bold text-foreground truncate">{prospectName || "Prospect"}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Activity size={18} className="animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No outreach events yet for this prospect.</p>
          ) : rows.map(r => (
            <div key={r.id} className={`border rounded p-3 ${EVENT_COLORS[r.event] || "border-border"}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider">{r.channel}</span>
                  <span className="text-xs font-bold">{r.event}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
              {r.reason && <p className="text-[11px] text-foreground/80 break-words">{r.reason}</p>}
              {r.metadata && Object.keys(r.metadata).length > 0 && (
                <details className="mt-1.5">
                  <summary className="text-[10px] text-muted-foreground cursor-pointer">metadata</summary>
                  <pre className="text-[10px] mt-1 bg-black/40 p-2 rounded overflow-x-auto">{JSON.stringify(r.metadata, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
