import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, CheckCircle2, XCircle, Loader2, Clock, Database } from "lucide-react";

interface AuditRow {
  id: string;
  function_name: string;
  stage: string;
  provider: string;
  success: boolean;
  duration_ms: number;
  fields_added: string[] | null;
  created_at: string;
  error_message: string | null;
}

interface Props {
  leadId: string;
  vertical?: string;
  /** When true, hide error details and provider names that look proprietary */
  redactSources?: boolean;
}

/**
 * Buyer-facing verification trail. Shows that we actually called real data
 * providers to enrich this lead — without exposing internal provider names
 * when redactSources=true (per TechAlert source-protection rules).
 */
export function EnrichmentProvenancePanel({ leadId, vertical, redactSources = false }: Props) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("lead_enrichment_audit")
          .select("id,function_name,stage,provider,success,duration_ms,fields_added,created_at,error_message")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: true })
          .limit(100);
        if (error) throw error;
        if (!cancelled) setRows(data || []);
      } catch (e) {
        console.error("[EnrichmentProvenancePanel]", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  const successCount = rows.filter((r) => r.success).length;
  const totalFields = rows.reduce((s, r) => s + (r.fields_added?.length || 0), 0);
  const totalMs = rows.reduce((s, r) => s + (r.duration_ms || 0), 0);

  const displayProvider = (p: string) => {
    if (!redactSources) return p;
    // Generic labels per source-protection rules
    const map: Record<string, string> = {
      hunter: "Verified email source",
      snov: "Verified email source",
      apollo: "B2B intelligence",
      pdl: "Identity graph",
      lusha: "Direct dial source",
      clay: "Enrichment partner",
      ninjapear: "Profile graph",
      proxycurl: "Profile graph",
      crustdata: "Workforce intel",
      sonar: "AI research",
      openrouter: "AI research",
      firecrawl_llm: "Site analysis",
      firecrawl: "Site analysis",
      npi: "Public registry",
    };
    const key = p.toLowerCase();
    return map[key] || "Data partner";
  };

  return (
    <div className="rounded-lg border border-white/10 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold">Verification Trail</h3>
        </div>
        {vertical && (
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">{vertical}</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-white/40 py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading verification data…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-white/40 py-2">No enrichment trace recorded for this lead yet.</div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <SummaryStat icon={<CheckCircle2 className="w-3 h-3" />} label="Sources checked" value={`${successCount}/${rows.length}`} />
            <SummaryStat icon={<Database className="w-3 h-3" />} label="Data points added" value={String(totalFields)} />
            <SummaryStat icon={<Clock className="w-3 h-3" />} label="Total time" value={`${(totalMs / 1000).toFixed(1)}s`} />
          </div>

          {/* Steps */}
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded bg-white/5 border border-white/5"
              >
                {r.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400/70 shrink-0" />
                )}
                <span className="font-mono text-white/80 truncate flex-1">{displayProvider(r.provider)}</span>
                {r.fields_added && r.fields_added.length > 0 && (
                  <span className="text-emerald-300/80 font-mono whitespace-nowrap">
                    +{r.fields_added.length} {r.fields_added.length === 1 ? "field" : "fields"}
                  </span>
                )}
                <span className="text-white/40 font-mono whitespace-nowrap">{r.duration_ms}ms</span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[10px] text-white/40 leading-relaxed">
            Every lead is enriched through multiple verified data sources. This trail confirms what was checked and when.
            {!redactSources && " Provider names are shown for transparency."}
          </p>
        </>
      )}
    </div>
  );
}

function SummaryStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
      <div className="flex items-center gap-1 text-white/40 text-[9px] uppercase tracking-wider">
        {icon} {label}
      </div>
      <div className="text-sm font-bold text-white mt-0.5">{value}</div>
    </div>
  );
}

export default EnrichmentProvenancePanel;
