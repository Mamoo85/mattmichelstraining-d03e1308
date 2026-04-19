import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminHighVolumeBuyer() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);

  const { data: clients = [], refetch } = useQuery({
    queryKey: ["hvb-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("high_volume_buyer_clients" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: digests = [] } = useQuery({
    queryKey: ["hvb-digests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("high_volume_buyer_digests" as any)
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as any[];
    },
  });

  const activeCount = clients.filter((c) => c.active).length;
  const mrr = activeCount * 199;
  const totalDigests = clients.reduce((s, c) => s + (c.digest_count || 0), 0);

  const runDigest = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("high-volume-buyer-digest", { body: {} });
      if (error) throw error;
      toast({
        title: "Digest run complete",
        description: `Sent: ${data?.sent ?? 0} · Skipped: ${data?.skipped ?? 0}`,
      });
      refetch();
    } catch (e: any) {
      toast({ title: "Digest failed", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase
      .from("high_volume_buyer_clients" as any)
      .update({ active: !current })
      .eq("id", id);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight">📦 High-Volume Buyer Permit Package</h2>
        <p className="text-sm text-muted-foreground mt-1">
          $199/mo supply house product · weekly Monday 7am ET digest
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Active Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">${mrr.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total Digests Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{totalDigests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">All Subscribers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{clients.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Run Digest Now</CardTitle>
          <Button onClick={runDigest} disabled={running}>
            {running ? "Running…" : "▶ Trigger Weekly Digest"}
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Manually fires the weekly digest worker. Normally runs automatically every Monday at 7am ET.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscribers ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No subscribers yet.</p>
          ) : (
            <div className="space-y-3">
              {clients.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-start justify-between gap-3 p-4 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold">{c.business_name}</p>
                      {c.active ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Badge variant="secondary">Paused</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.email} · {c.phone || "no phone"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Trades: {(c.target_trades || []).join(", ") || "—"} · Counties: {(c.target_counties || []).join(", ") || "—"} · Min permits: {c.min_permit_count}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.digest_count || 0} digests sent
                      {c.last_digest_sent_at ? ` · last: ${new Date(c.last_digest_sent_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleActive(c.id, c.active)}
                  >
                    {c.active ? "Pause" : "Activate"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Digest Sends ({digests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {digests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No digests sent yet.</p>
          ) : (
            <div className="space-y-2">
              {digests.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(d.sent_at).toLocaleString()}
                    </span>
                    {" · "}
                    <span className="font-bold">{d.buyer_count} buyers</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Est. ${(d.total_permit_value || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
