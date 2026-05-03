import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Prospect = {
  id: string;
  company_name: string;
  city: string | null;
  role: string | null;
  status: string | null;
  source_label: string | null;
  source_url: string | null;
  score: number | null;
  days_posted: number | null;
  open_roles_count: number | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  enriched_at: string | null;
  outreach_sent_at: string | null;
  outreach_status: string | null;
  created_at: string;
  updated_at: string | null;
};

type Run = {
  id: string;
  ran_at: string;
  scanned: number;
  inserted: number;
  updated: number;
  duration_ms: number | null;
  alert_sent: boolean;
  signals: any;
  notes: string | null;
};

function rel(iso: string | null) {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default function AdminTechAlertProspects() {
  const [rows, setRows] = useState<Prospect[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "enriched" | "contacted" | "no_email">("all");
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: pData, error: pErr }, { data: rData }] = await Promise.all([
      supabase.from("techalert_prospect_targets" as any)
        .select("id, company_name, city, role, status, source_label, source_url, score, days_posted, open_roles_count, owner_name, owner_email, owner_phone, enriched_at, outreach_sent_at, outreach_status, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("techalert_hunter_runs" as any)
        .select("*")
        .order("ran_at", { ascending: false })
        .limit(14),
    ]);
    if (pErr) toast.error(`Load failed: ${pErr.message}`);
    setRows((pData as any[]) || []);
    setRuns((rData as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.company_name} ${r.city ?? ""} ${r.source_label ?? ""}`.toLowerCase().includes(q)) return false;
      if (filter === "new") return !r.enriched_at;
      if (filter === "enriched") return r.enriched_at && !r.outreach_sent_at;
      if (filter === "contacted") return !!r.outreach_sent_at;
      if (filter === "no_email") return r.enriched_at && !r.owner_email;
      return true;
    });
  }, [rows, search, filter]);

  const stats = useMemo(() => ({
    total: rows.length,
    enriched: rows.filter((r) => !!r.enriched_at).length,
    withEmail: rows.filter((r) => !!r.owner_email).length,
    contacted: rows.filter((r) => !!r.outreach_sent_at).length,
    today: rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < 86400000).length,
  }), [rows]);

  const lastRun = runs[0];
  const lowYield = lastRun && lastRun.inserted < 5;

  const triggerRun = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("techalert-prospect-hunter", { body: {} });
      if (error) throw error;
      toast.success(`Hunter complete: ${(data as any)?.inserted ?? 0} new, ${(data as any)?.updated ?? 0} updated`);
      await load();
    } catch (e: any) {
      toast.error(`Run failed: ${e?.message ?? e}`);
    } finally { setRunning(false); }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/dwa-admin" className="text-sm text-muted-foreground inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> DWA Admin
          </Link>
          <h1 className="text-2xl font-bold mt-1">TechAlert Prospect Hunter</h1>
        </div>
        <Button onClick={triggerRun} disabled={running}>
          <RefreshCw className={`w-4 h-4 mr-2 ${running ? "animate-spin" : ""}`} />
          Run Now
        </Button>
      </div>

      {lowYield && (
        <Card className="p-4 mb-4 border-destructive/40 bg-destructive/5 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
          <div>
            <p className="font-semibold">Low yield in last run: {lastRun.inserted} new prospects</p>
            <p className="text-sm text-muted-foreground">
              {lastRun.notes ?? "Check Sonar credits, USPTO endpoint, or source API outages."}
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { k: "Total", v: stats.total },
          { k: "Today", v: stats.today },
          { k: "Enriched", v: stats.enriched },
          { k: "With Email", v: stats.withEmail },
          { k: "Contacted", v: stats.contacted },
        ].map((s) => (
          <Card key={s.k} className="p-3">
            <p className="text-xs text-muted-foreground">{s.k}</p>
            <p className="text-2xl font-bold">{s.v}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4 mb-6">
        <h2 className="font-semibold mb-3">Recent Hunter Runs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="text-left py-1">When</th><th>Scanned</th><th>New</th><th>Updated</th><th>Duration</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-1">{new Date(r.ran_at).toLocaleString()}</td>
                  <td className="text-center">{r.scanned}</td>
                  <td className="text-center font-semibold">{r.inserted}</td>
                  <td className="text-center">{r.updated}</td>
                  <td className="text-center">{r.duration_ms ? `${Math.round(r.duration_ms / 1000)}s` : "—"}</td>
                  <td className="text-xs text-muted-foreground">{r.alert_sent ? "🚨 Alert sent" : ""} {r.notes ?? ""}</td>
                </tr>
              ))}
              {runs.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">No runs yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 mb-3">
        <Input placeholder="Search company / city / source..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {(["all", "new", "enriched", "no_email", "contacted"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f.replace("_", " ")}
          </Button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="text-left p-2">Company</th>
                <th className="text-left p-2">Source</th>
                <th className="text-left p-2">Role</th>
                <th className="text-center p-2">Score</th>
                <th className="text-left p-2">Owner</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Found</th>
                <th className="text-left p-2">Enriched</th>
                <th className="text-left p-2">Outreach</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No prospects match</td></tr>}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-2">
                    <div className="font-medium">{r.company_name}</div>
                    <div className="text-xs text-muted-foreground">{r.city ?? "—"}</div>
                  </td>
                  <td className="p-2">
                    {r.source_url ? (
                      <a href={r.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{r.source_label ?? "link"}</a>
                    ) : (
                      <span className="text-xs">{r.source_label ?? "—"}</span>
                    )}
                  </td>
                  <td className="p-2 text-xs">{r.role ?? "—"}</td>
                  <td className="p-2 text-center"><Badge variant={r.score && r.score >= 5 ? "default" : "secondary"}>{r.score ?? "—"}</Badge></td>
                  <td className="p-2 text-xs">
                    {r.owner_name && <div>{r.owner_name}</div>}
                    {r.owner_email && <div className="text-muted-foreground">{r.owner_email}</div>}
                    {!r.owner_name && !r.owner_email && <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-2"><Badge variant="outline" className="text-xs">{r.status ?? "new"}</Badge></td>
                  <td className="p-2 text-xs text-muted-foreground">{rel(r.created_at)}</td>
                  <td className="p-2 text-xs text-muted-foreground">{rel(r.enriched_at)}</td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {r.outreach_sent_at ? rel(r.outreach_sent_at) : "—"}
                    {r.outreach_status && <div className="text-muted-foreground">{r.outreach_status}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
