import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, ChevronDown } from "lucide-react";

interface AuditRow {
  id: string;
  function_name: string;
  stage: string;
  provider: string;
  finished_at: string;
  success: boolean;
}

interface Props {
  leadId: string;
  className?: string;
}

/**
 * Buyer-safe provenance panel — reads the redacted view (no costs, no raw payloads).
 * Shows how many sources were checked and last-verified timestamp.
 */
export function EnrichmentProvenancePanel({ leadId, className }: Props) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("lead_enrichment_audit_buyer_view")
        .select("id, function_name, stage, provider, finished_at, success")
        .eq("lead_id", leadId)
        .order("finished_at", { ascending: false })
        .limit(50);
      if (!cancelled) setRows(data || []);
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  if (rows === null) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className || ""}`}>
        <Loader2 className="w-3 h-3 animate-spin" /> Loading verification trail…
      </div>
    );
  }

  if (rows.length === 0) return null;

  const succeeded = rows.filter((r) => r.success).length;
  const lastVerified = rows[0]?.finished_at;
  const lastTxt = lastVerified ? timeAgo(lastVerified) : "never";

  return (
    <div className={`rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 ${className || ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-bold text-emerald-100">
            Enrichment trail: {rows.length} sources checked, {succeeded} succeeded
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-emerald-200/70 font-mono">
          last verified {lastTxt}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <ul className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-[11px] font-mono">
              {r.success ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-3 h-3 text-rose-400 flex-shrink-0" />
              )}
              <span className="text-foreground/90 truncate">{r.function_name}</span>
              <span className="text-muted-foreground">· {r.stage}</span>
              <span className="ml-auto text-muted-foreground/70">{timeAgo(r.finished_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default EnrichmentProvenancePanel;
