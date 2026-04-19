import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Mail, Phone, Linkedin, Building2, MapPin, Calendar, Hash, AlertCircle } from "lucide-react";

interface Props {
  candidateId: string;
  onClose: () => void;
}

export function CandidateDetailModal({ candidateId, onClose }: Props) {
  const [cand, setCand] = useState<any>(null);
  const [enrichmentLog, setEnrichmentLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: log }] = await Promise.all([
        (supabase as any).from("hire_alert_candidates").select("*").eq("id", candidateId).maybeSingle(),
        (supabase as any).from("candidate_enrichment_log").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: false }).limit(20),
      ]);
      setCand(c);
      setEnrichmentLog(log || []);
      setLoading(false);
    })();
  }, [candidateId]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0a0f1e] border border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-[#0a0f1e] z-10">
          <h3 className="text-white font-black text-lg">Candidate Detail</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-white/40">Loading…</div>
        ) : !cand ? (
          <div className="p-12 text-center text-white/40">Candidate not found</div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Header */}
            <div>
              <div className="text-white text-2xl font-black">{cand.full_name || cand.name}</div>
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                {cand.license_type && <span className="px-2 py-1 rounded bg-amber-500/15 text-amber-400">{cand.license_type}</span>}
                {cand.is_company_name && <span className="px-2 py-1 rounded bg-red-500/15 text-red-400">Company (hidden)</span>}
                {cand.is_demo_record && <span className="px-2 py-1 rounded bg-blue-500/15 text-blue-400">Demo</span>}
                <span className="px-2 py-1 rounded bg-white/5 text-white/60">Source: {cand.source}</span>
                <span className="px-2 py-1 rounded bg-white/5 text-white/60">Score: {cand.score ?? "—"}</span>
                <span className="px-2 py-1 rounded bg-white/5 text-white/60">Completeness: {cand.data_completeness ?? 0}%</span>
              </div>
            </div>

            {/* Contact */}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field icon={Mail} label="Email" value={cand.email} />
              <Field icon={Phone} label="Phone" value={cand.phone} sub={cand.phone_type} />
              <Field icon={Linkedin} label="LinkedIn" value={cand.linkedin_url} link />
              <Field icon={Building2} label="Current Employer" value={cand.current_employer} sub={cand.current_title} />
              <Field icon={MapPin} label="Location" value={[cand.city, cand.state, cand.zip].filter(Boolean).join(", ")} />
              <Field icon={Hash} label="License #" value={cand.license_number} sub={cand.license_expiry ? `Exp: ${cand.license_expiry}` : undefined} />
              <Field icon={Calendar} label="First Seen" value={cand.first_seen_at ? new Date(cand.first_seen_at).toLocaleString() : null} />
              <Field icon={Calendar} label="Last Seen" value={cand.last_seen_at ? new Date(cand.last_seen_at).toLocaleString() : null} />
            </div>

            {/* Reasoning */}
            {cand.score_reason && (
              <div className="rounded-lg bg-white/3 border border-white/10 p-3">
                <div className="text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1">Score Reason</div>
                <div className="text-white/80 text-sm whitespace-pre-wrap">{cand.score_reason}</div>
              </div>
            )}
            {cand.qualifications_summary && (
              <div className="rounded-lg bg-white/3 border border-white/10 p-3">
                <div className="text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1">Qualifications</div>
                <div className="text-white/80 text-sm whitespace-pre-wrap">{cand.qualifications_summary}</div>
              </div>
            )}

            {/* Enrichment log */}
            {enrichmentLog.length > 0 && (
              <div>
                <div className="text-white/40 text-[10px] uppercase font-bold tracking-wider mb-2">Enrichment History ({enrichmentLog.length})</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {enrichmentLog.map((log) => (
                    <div key={log.id} className="text-xs px-3 py-2 rounded bg-white/3 border border-white/5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={log.success ? "text-emerald-400" : "text-red-400"}>{log.success ? "✓" : "✗"}</span>
                        <span className="text-white/70 font-mono">{log.source}</span>
                        <span className="text-white/40">·</span>
                        <span className="text-white/50 truncate">{(log.hit_fields || []).join(", ") || log.error_message || "no hits"}</span>
                      </div>
                      <span className="text-white/30 shrink-0">{new Date(log.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw JSON */}
            <details className="text-xs">
              <summary className="text-white/40 cursor-pointer hover:text-white/60 font-semibold uppercase tracking-wider text-[10px]">
                Raw JSON
              </summary>
              <pre className="mt-2 p-3 rounded bg-black/40 border border-white/5 text-white/60 overflow-x-auto text-[10px] leading-relaxed">
{JSON.stringify(cand, null, 2)}
              </pre>
            </details>

            {!cand.email && !cand.phone && !cand.linkedin_url && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2 text-xs text-amber-300">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>No contact info yet. Use <strong>Quick PDL</strong> or <strong>Deep Enrich</strong> from the workbench to populate phone/email.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, sub, link }: { icon: any; label: string; value: any; sub?: string; link?: boolean }) {
  return (
    <div className="rounded-lg bg-white/3 border border-white/10 p-3">
      <div className="flex items-center gap-1.5 text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1">
        <Icon size={11} /> {label}
      </div>
      {value ? (
        link ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-sm break-all hover:underline">{value}</a>
        ) : (
          <div className="text-white text-sm break-words">{value}</div>
        )
      ) : (
        <div className="text-white/25 text-sm italic">—</div>
      )}
      {sub && <div className="text-white/40 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}
