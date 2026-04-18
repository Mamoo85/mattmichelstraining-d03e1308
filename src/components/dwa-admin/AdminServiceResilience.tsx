/**
 * AdminServiceResilience — visual health dashboard for all external services.
 * Never shows raw HTTP codes — only Operational / Degraded / Offline.
 * Includes manual override controls and endpoint drift history.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, ShieldCheck, ShieldAlert, ShieldX, Play, RotateCcw } from "lucide-react";

type ServiceStatus = "operational" | "degraded" | "offline";

interface ServiceHealth {
  id: string;
  service_name: string;
  status: string;
  disabled_until: string | null;
  last_failure_at: string | null;
  last_success_at: string | null;
  failure_count: number;
  last_failure_reason: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
}

interface DataSourceEndpoint {
  id: string;
  source_name: string;
  primary_url: string;
  backup_url: string | null;
  status: string;
  last_verified_at: string | null;
  last_drift_at: string | null;
  notes: string | null;
}

const SERVICE_LABELS: Record<string, string> = {
  pdl_api: "Phone Enrichment",
  firecrawl_api: "Website Scraper",
  lovable_ai_gateway: "AI Gateway (Primary)",
  anthropic_api: "AI Gateway (Backup)",
  openai_api: "AI Gateway (Backup-2)",
  apollo_api: "Apollo Lookup",
  michigan_lara: "Michigan LARA",
  michigan_open_data: "Michigan Open Data",
  nursys_api: "Nursys e-Notify",
  npi_registry: "NPI Registry",
};

function deriveStatus(s: ServiceHealth): ServiceStatus {
  if (s.disabled_until && new Date(s.disabled_until).getTime() > Date.now()) return "offline";
  if (s.status === "degraded" || s.failure_count >= 3) return "degraded";
  return "operational";
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  const map = {
    operational: { icon: ShieldCheck, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "🟢 Operational" },
    degraded: { icon: ShieldAlert, cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "🟡 Degraded — backup active" },
    offline: { icon: ShieldX, cls: "bg-rose-500/15 text-rose-400 border-rose-500/30", label: "🔴 Offline — manual review" },
  };
  const Icon = map[status].icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${map[status].cls}`}>
      <Icon className="w-3.5 h-3.5" /> {map[status].label}
    </span>
  );
}

export default function AdminServiceResilience() {
  const qc = useQueryClient();
  const [running, setRunning] = useState<string | null>(null);

  const services = useQuery({
    queryKey: ["service_health"],
    queryFn: async (): Promise<ServiceHealth[]> => {
      const { data, error } = await (supabase.from as any)("service_health")
        .select("*").order("service_name");
      if (error) throw error;
      return data as ServiceHealth[];
    },
    refetchInterval: 30_000,
  });

  const endpoints = useQuery({
    queryKey: ["data_source_endpoints"],
    queryFn: async (): Promise<DataSourceEndpoint[]> => {
      const { data, error } = await (supabase.from as any)("data_source_endpoints")
        .select("*").order("source_name");
      if (error) throw error;
      return data as DataSourceEndpoint[];
    },
    refetchInterval: 60_000,
  });

  const reset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("service_health").update({
        status: "operational",
        disabled_until: null,
        failure_count: 0,
        last_failure_reason: null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_health"] });
      toast({ title: "Reset", description: "Service marked operational. Will re-verify on next probe." });
    },
  });

  const runProbe = async () => {
    setRunning("probe");
    try {
      const { error } = await supabase.functions.invoke("service-health-monitor", { body: {} });
      if (error) throw error;
      toast({ title: "Probe complete", description: "All services checked." });
      qc.invalidateQueries({ queryKey: ["service_health"] });
    } catch (e) {
      toast({ title: "Probe failed", description: String(e), variant: "destructive" });
    } finally {
      setRunning(null);
    }
  };

  const runDrift = async () => {
    setRunning("drift");
    try {
      const { error } = await supabase.functions.invoke("endpoint-drift-detector", { body: {} });
      if (error) throw error;
      toast({ title: "Drift check complete", description: "Endpoint URLs verified." });
      qc.invalidateQueries({ queryKey: ["data_source_endpoints"] });
    } catch (e) {
      toast({ title: "Drift check failed", description: String(e), variant: "destructive" });
    } finally {
      setRunning(null);
    }
  };

  const operational = services.data?.filter(s => deriveStatus(s) === "operational").length || 0;
  const degraded = services.data?.filter(s => deriveStatus(s) === "degraded").length || 0;
  const offline = services.data?.filter(s => deriveStatus(s) === "offline").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-white">🛡️ Service Resilience</h2>
          <p className="text-white/60 text-sm">Triple-redundancy monitoring across all external APIs and data sources.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={runProbe} disabled={running !== null} size="sm" variant="outline" className="gap-1.5" title="Pings every external API (Lovable AI, Anthropic, Apollo, PDL, Firecrawl, etc.) to confirm they respond. Updates the status badges below.">
            <Play className="w-3.5 h-3.5" /> {running === "probe" ? "Probing…" : "Run Health Probe"}
          </Button>
          <Button onClick={runDrift} disabled={running !== null} size="sm" variant="outline" className="gap-1.5" title="Verifies each data-source URL still returns valid data (catches when state portals change their URLs).">
            <RefreshCw className="w-3.5 h-3.5" /> {running === "drift" ? "Checking…" : "Check Endpoint Drift"}
          </Button>
        </div>
      </div>

      <div className="bg-[#0a1628]/60 border border-white/10 rounded-md p-3 text-xs text-white/60 leading-relaxed">
        <strong className="text-white/80">What this does:</strong> The Health Probe sends a tiny test request to each connected external service (AI gateways, enrichment APIs, scrapers) and marks them 🟢 Operational, 🟡 Degraded, or 🔴 Offline. The Endpoint Drift check confirms public data sources (LARA, Michigan Open Data, NPI Registry) haven't moved or changed their URL structure. Both are safe to run anytime — they make no changes.
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="text-emerald-400 text-3xl font-black">{operational}</div>
            <div className="text-emerald-400/70 text-xs uppercase tracking-wide font-semibold">Operational</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="text-amber-400 text-3xl font-black">{degraded}</div>
            <div className="text-amber-400/70 text-xs uppercase tracking-wide font-semibold">Degraded</div>
          </CardContent>
        </Card>
        <Card className="bg-rose-500/5 border-rose-500/20">
          <CardContent className="p-4">
            <div className="text-rose-400 text-3xl font-black">{offline}</div>
            <div className="text-rose-400/70 text-xs uppercase tracking-wide font-semibold">Offline</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#0f2342] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">External Services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {services.isLoading && <p className="text-white/50 text-sm">Loading…</p>}
          {services.data?.map(s => {
            const status = deriveStatus(s);
            const credits = (s.metadata as any)?.credits_remaining;
            const limit = (s.metadata as any)?.credits_limit;
            return (
              <div key={s.id} className="flex items-center justify-between p-3 bg-[#0a1628] rounded-md border border-white/5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-semibold">{SERVICE_LABELS[s.service_name] || s.service_name}</span>
                    <StatusBadge status={status} />
                    {typeof credits === "number" && (
                      <Badge variant="outline" className="text-xs">
                        {credits}{typeof limit === "number" ? `/${limit}` : ""} credits
                      </Badge>
                    )}
                  </div>
                  {status !== "operational" && s.last_failure_reason && (
                    <p className="text-white/50 text-xs mt-1 truncate">Last issue: {s.last_failure_reason}</p>
                  )}
                  {s.disabled_until && new Date(s.disabled_until).getTime() > Date.now() && (
                    <p className="text-amber-400/80 text-xs mt-1">Disabled until: {new Date(s.disabled_until).toLocaleString()}</p>
                  )}
                </div>
                {status !== "operational" && (
                  <Button size="sm" variant="ghost" onClick={() => reset.mutate(s.id)} className="text-white/70 hover:text-white">
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="bg-[#0f2342] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Data Source Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {endpoints.isLoading && <p className="text-white/50 text-sm">Loading…</p>}
          {endpoints.data?.map(e => (
            <div key={e.id} className="p-3 bg-[#0a1628] rounded-md border border-white/5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-white text-sm font-semibold">{e.source_name}</span>
                <Badge variant={e.status === "active" ? "default" : "destructive"} className="text-xs">
                  {e.status}
                </Badge>
              </div>
              <p className="text-white/40 text-xs mt-1 truncate">→ {e.primary_url}</p>
              {e.backup_url && <p className="text-white/30 text-xs truncate">↳ backup: {e.backup_url}</p>}
              {e.last_drift_at && (
                <p className="text-amber-400/70 text-xs mt-1">⚠️ Last drift detected: {new Date(e.last_drift_at).toLocaleDateString()}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
