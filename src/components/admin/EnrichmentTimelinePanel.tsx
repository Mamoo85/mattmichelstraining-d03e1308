import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

type TraceStep = {
  source: string;
  ok: boolean;
  error?: string;
  latency_ms?: number;
  ts?: string;
};

type ProspectRow = {
  id: string;
  business_name: string | null;
  owner_name: string | null;
  city: string | null;
  email: string | null;
  email_verified: boolean | null;
  enrichment_confidence: number | null;
  enrichment_trace: unknown;
  updated_at: string | null;
};

function asTrace(raw: unknown): TraceStep[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as TraceStep[];
  if (typeof raw === "object" && raw && Array.isArray((raw as any).steps)) {
    return (raw as any).steps as TraceStep[];
  }
  return [];
}

export default function EnrichmentTimelinePanel() {
  const [rows, setRows] = useState<ProspectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "failed" | "partial">("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    let q = supabase
      .from("contractor_outreach_prospects")
      .select("id,business_name,owner_name,city,email,email_verified,enrichment_confidence,enrichment_trace,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (filter === "failed") q = q.is("email", null);
    if (filter === "partial") q = q.lt("enrichment_confidence", 60);

    if (search.trim()) {
      q = q.or(`business_name.ilike.%${search}%,city.ilike.%${search}%,owner_name.ilike.%${search}%`);
    }

    const { data, error } = await q;
    if (!error) setRows((data ?? []) as ProspectRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Enrichment timeline</CardTitle>
          <p className="text-sm text-muted-foreground">
            Per-prospect waterfall trace: which providers fired, latency, errors.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder="Search business / contact / city"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              className="max-w-sm"
            />
            <Button size="sm" variant="outline" onClick={load}>Search</Button>
            <div className="flex gap-1 ml-auto">
              {(["all", "failed", "partial"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>

          <ScrollArea className="h-[600px] pr-3">
            {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {!loading && rows.length === 0 && (
              <div className="text-sm text-muted-foreground">No prospects match.</div>
            )}
            <div className="space-y-3">
              {rows.map((r) => {
                const trace = asTrace(r.enrichment_trace);
                const name =
                  r.business_name ||
                  r.owner_name ||
                  "(unnamed)";
                return (
                  <div key={r.id} className="border rounded-md p-3 bg-card">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.city ?? "—"} · {r.email ?? <span className="italic">no email</span>}
                          {r.email_verified && <Badge className="ml-2" variant="secondary">verified</Badge>}
                          {typeof r.enrichment_confidence === "number" && (
                            <Badge className="ml-2" variant="outline">conf {r.enrichment_confidence}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}
                      </div>
                    </div>

                    {trace.length === 0 ? (
                      <div className="text-xs italic text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> No trace recorded
                      </div>
                    ) : (
                      <ol className="space-y-1">
                        {trace.map((s, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            {s.ok ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                            )}
                            <span className="font-mono text-xs w-32">{s.source}</span>
                            {typeof s.latency_ms === "number" && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {Math.round(s.latency_ms)}ms
                              </span>
                            )}
                            {s.error && (
                              <span className="text-xs text-red-500 truncate" title={s.error}>
                                {s.error}
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
