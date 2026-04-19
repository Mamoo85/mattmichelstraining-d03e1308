import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Zap, Search, CheckCircle, XCircle, Phone, Mail, User } from "lucide-react";

interface EnrichmentStats {
  total: number;
  enriched: number;
  pending: number;
  no_data: number;
  by_source: Record<string, number>;
  apis_configured: Record<string, boolean>;
}

export default function AdminEnrichmentPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [batchRunning, setBatchRunning] = useState(false);

  const { data: stats, isLoading } = useQuery<EnrichmentStats>({
    queryKey: ["enrichment-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("lead-enrichment-waterfall", {
        body: { mode: "stats" },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: recentEnriched } = useQuery({
    queryKey: ["recent-enriched"],
    queryFn: async () => {
      const { data } = await supabase
        .from("prospect_businesses" as any)
        .select("id, business_name, email, enrichment_source, enrichment_status, verified_email, decision_maker_name, decision_maker_title, direct_phone, enriched_at")
        .eq("enrichment_status", "enriched")
        .order("enriched_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const batchEnrich = useMutation({
    mutationFn: async () => {
      setBatchRunning(true);
      const { data, error } = await supabase.functions.invoke("lead-enrichment-waterfall", {
        body: { mode: "batch", limit: 20 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setBatchRunning(false);
      toast({
        title: "Batch enrichment complete",
        description: `Enriched ${data?.enriched ?? 0} of ${data?.total ?? 0} prospects`,
      });
      queryClient.invalidateQueries({ queryKey: ["enrichment-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-enriched"] });
    },
    onError: (err) => {
      setBatchRunning(false);
      toast({ title: "Enrichment failed", description: String(err), variant: "destructive" });
    },
  });

  const singleEnrich = useMutation({
    mutationFn: async (prospect: any) => {
      const { data, error } = await supabase.functions.invoke("lead-enrichment-waterfall", {
        body: { prospect_id: prospect.id, website: prospect.website, business_name: prospect.business_name },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Prospect enriched" });
      queryClient.invalidateQueries({ queryKey: ["enrichment-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-enriched"] });
      queryClient.invalidateQueries({ queryKey: ["pending-enrich"] });
    },
  });

  const { data: pendingProspects } = useQuery({
    queryKey: ["pending-enrich"],
    queryFn: async () => {
      const { data } = await supabase
        .from("prospect_businesses" as any)
        .select("id, business_name, website, city, industry")
        .or("enrichment_status.eq.pending,enrichment_status.is.null")
        .not("website", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const sourceColors: Record<string, string> = {
    hunter: "bg-orange-500/20 text-orange-400",
    apollo: "bg-blue-500/20 text-blue-400",
    snov: "bg-purple-500/20 text-purple-400",
    lusha: "bg-green-500/20 text-green-400",
    clay: "bg-cyan-500/20 text-cyan-400",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="text-cyan-400" size={20} />
            Lead Enrichment Waterfall
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Hunter → Apollo → Snov → Lusha → Clay cascade enrichment
          </p>
        </div>
        <Button
          onClick={() => batchEnrich.mutate()}
          disabled={batchRunning}
          className="bg-cyan-500 hover:bg-cyan-600 text-black font-bold"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${batchRunning ? "animate-spin" : ""}`} />
          {batchRunning ? "Enriching..." : "Run Batch (20)"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-white">{stats?.total ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Total Prospects</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-green-400">{stats?.enriched ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Enriched</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-yellow-400">{stats?.pending ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-red-400">{stats?.no_data ?? "—"}</p>
            <p className="text-xs text-muted-foreground">No Data</p>
          </CardContent>
        </Card>
      </div>

      {/* Source Breakdown + API Status */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-white">Enrichment by Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats?.by_source && Object.entries(stats.by_source).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <Badge className={sourceColors[source] || "bg-white/10 text-white"}>
                  {source.charAt(0).toUpperCase() + source.slice(1)}
                </Badge>
                <span className="text-white font-mono text-sm">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-white">API Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats?.apis_configured && Object.entries(stats.apis_configured).map(([api, configured]) => (
              <div key={api} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground capitalize">{api}</span>
                {configured ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Pending Prospects */}
      {pendingProspects && pendingProspects.length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Search size={14} /> Pending Enrichment ({pendingProspects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingProspects.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded bg-white/5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{p.business_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.city} · {p.industry}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 ml-2 text-xs border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10"
                    onClick={() => singleEnrich.mutate(p)}
                  >
                    Enrich
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recently Enriched */}
      {recentEnriched && recentEnriched.length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle size={14} className="text-green-400" /> Recently Enriched
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentEnriched.map((p: any) => (
                <div key={p.id} className="p-3 rounded-lg bg-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-white">{p.business_name}</p>
                    <Badge className={sourceColors[p.enrichment_source] || "bg-white/10"}>
                      {p.enrichment_source}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {p.decision_maker_name && (
                      <span className="flex items-center gap-1">
                        <User size={10} /> {p.decision_maker_name}
                        {p.decision_maker_title && ` — ${p.decision_maker_title}`}
                      </span>
                    )}
                    {p.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={10} /> {p.email}
                        {p.verified_email && <CheckCircle size={10} className="text-green-400" />}
                      </span>
                    )}
                    {p.direct_phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={10} /> {p.direct_phone}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
