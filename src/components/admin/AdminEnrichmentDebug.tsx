import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface TraceRow {
  id: string;
  function_name: string;
  stage: string;
  provider: string;
  success: boolean;
  duration_ms: number;
  http_status: number | null;
  error_code: string | null;
  error_message: string | null;
  fields_added: string[] | null;
  cost_cents: number | null;
  created_at: string;
}

interface LeadMeta {
  company_name?: string | null;
  contact_email?: string | null;
  owner_email?: string | null;
  enrichment_status?: string | null;
  meta?: any;
}

export default function AdminEnrichmentDebug() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TraceRow[]>([]);
  const [lead, setLead] = useState<LeadMeta | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function resolveLeadId(q: string): Promise<string | null> {
    // If it's a uuid, use directly
    if (/^[0-9a-f-]{36}$/i.test(q)) return q;
    // Try common lead tables by company name / email
    const tables = [
      "techalert_prospect_targets",
      "marketplace_prospects",
      "outreach_leads",
      "hire_alert_candidates",
    ];
    for (const t of tables) {
      const { data } = await (supabase as any)
        .from(t)
        .select("id")
        .or(`company_name.ilike.%${q}%,contact_email.ilike.%${q}%,owner_email.ilike.%${q}%`)
        .limit(1);
      if (data && data[0]?.id) return data[0].id;
    }
    return null;
  }

  async function loadLeadMeta(id: string) {
    const tables = [
      "techalert_prospect_targets",
      "marketplace_prospects",
      "outreach_leads",
      "hire_alert_candidates",
    ];
    for (const t of tables) {
      const { data } = await (supabase as any).from(t).select("*").eq("id", id).maybeSingle();
      if (data) {
        setLead({
          company_name: data.company_name ?? data.name ?? null,
          contact_email: data.contact_email ?? null,
          owner_email: data.owner_email ?? null,
          enrichment_status: data.enrichment_status ?? null,
          meta: data.meta ?? data.enrichment_meta ?? null,
        });
        return;
      }
    }
    setLead(null);
  }

  async function search() {
    setErr(null);
    setRows([]);
    setLead(null);
    setResolvedId(null);
    if (!query.trim()) return;
    setLoading(true);
    try {
      const id = await resolveLeadId(query.trim());
      if (!id) {
        setErr("No lead found matching that ID, company, or email.");
        return;
      }
      setResolvedId(id);
      await loadLeadMeta(id);
      const { data, error } = await (supabase as any)
        .from("lead_enrichment_audit")
        .select("id,function_name,stage,provider,success,duration_ms,http_status,error_code,error_message,fields_added,cost_cents,created_at")
        .eq("lead_id", id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const totalCost = rows.reduce((s, r) => s + (r.cost_cents || 0), 0);
  const totalMs = rows.reduce((s, r) => s + (r.duration_ms || 0), 0);
  const successCount = rows.filter((r) => r.success).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Enrichment Debug</h2>
        <p className="text-sm text-slate-400">Trace every provider call for a specific lead. Paste a lead ID, company name, or email.</p>
      </div>

      <Card className="bg-[#162236] border-slate-700">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-2">
            <Input
              placeholder="Lead UUID, company name, or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              className="bg-slate-900 border-slate-700 text-white"
            />
            <Button onClick={search} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Trace</span>
            </Button>
          </div>
          {err && <p className="text-rose-400 text-sm mt-2">{err}</p>}
        </CardContent>
      </Card>

      {lead && (
        <Card className="bg-[#162236] border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Lead</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="text-white font-bold">{lead.company_name || "(no company)"}</div>
            <div className="text-slate-400">Contact: {lead.contact_email || lead.owner_email || "—"}</div>
            <div className="text-slate-400">Status: <Badge variant="outline" className="text-cyan-400 border-cyan-800">{lead.enrichment_status || "unknown"}</Badge></div>
            <div className="text-slate-500 font-mono text-[10px]">id: {resolvedId}</div>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Steps" value={`${successCount}/${rows.length}`} color="text-emerald-400" />
            <Stat label="Total time" value={`${(totalMs / 1000).toFixed(2)}s`} color="text-slate-300" />
            <Stat label="Cost" value={`$${(totalCost / 100).toFixed(2)}`} color="text-purple-400" />
          </div>

          <Card className="bg-[#162236] border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300">Provider Trace</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-slate-900/60 border border-slate-800">
                    {r.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                    <span className="font-mono text-slate-400 w-32 truncate">{r.function_name}</span>
                    <span className="font-mono text-cyan-300 w-28 truncate">{r.provider}</span>
                    <span className="text-slate-500 w-20 truncate">{r.stage}</span>
                    {r.fields_added && r.fields_added.length > 0 && (
                      <Badge variant="outline" className="text-emerald-300 border-emerald-800 text-[10px]">
                        +{r.fields_added.length} {r.fields_added.length === 1 ? "field" : "fields"}
                      </Badge>
                    )}
                    {r.http_status && <span className="text-slate-500 font-mono">{r.http_status}</span>}
                    <span className="text-slate-500 font-mono ml-auto">{r.duration_ms}ms</span>
                    {r.cost_cents ? <span className="text-purple-400 font-mono">${(r.cost_cents / 100).toFixed(3)}</span> : null}
                    {r.error_message && (
                      <span className="text-rose-400/80 truncate max-w-[200px]" title={r.error_message}>{r.error_code || r.error_message}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {lead?.meta?.enrichment_trace && (
            <Card className="bg-[#162236] border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">meta.enrichment_trace</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-[10px] text-slate-300 overflow-x-auto bg-slate-950 p-3 rounded">
                  {JSON.stringify(lead.meta.enrichment_trace, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!loading && rows.length === 0 && resolvedId && (
        <p className="text-slate-500 text-sm">No enrichment trace recorded for this lead.</p>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card className="bg-[#162236] border-slate-700">
      <CardContent className="pt-4 pb-4 text-center">
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-slate-400 mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}
