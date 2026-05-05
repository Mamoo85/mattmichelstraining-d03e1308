import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

interface Row {
  id: string;
  product_key: string;
  channel: string;
  url: string;
  status_code: number | null;
  ok: boolean;
  response_ms: number | null;
  error: string | null;
  checked_at: string;
}

export default function LinkHealth() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("link_audit_results")
      .select("*")
      .order("checked_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => {
    load();
  }, []);

  const runAudit = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("e2e-link-auditor", { body: {} });
    setRunning(false);
    if (error) {
      toast({ title: "Audit failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Audit complete",
      description: `Checked ${data?.checked} · ${data?.failures} failures`,
    });
    load();
  };

  // Group latest per product+channel+url
  const latest = new Map<string, Row>();
  for (const r of rows) {
    const k = `${r.product_key}|${r.channel}|${r.url}`;
    if (!latest.has(k)) latest.set(k, r);
  }
  const list = Array.from(latest.values());
  const failures = list.filter((r) => !r.ok);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Link Health</h1>
          <p className="text-sm text-muted-foreground">
            Content-aware conversion check — fails on "Unknown product", invalid trial text, 4xx/5xx, or non-200 redirects.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button onClick={runAudit} disabled={running}>
            {running ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Running…</> : "Run audit now"}
          </Button>
        </div>
      </div>

      {failures.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> {failures.length} failing URLs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {failures.map((r) => (
              <div key={r.id} className="text-sm border-l-2 border-destructive pl-3">
                <div className="font-mono text-xs">{r.url}</div>
                <div className="text-muted-foreground">
                  {r.product_key} · {r.channel} · {r.status_code ?? "ERR"} · {r.error ?? ""}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All checks ({list.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {list.map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-sm py-1 border-b last:border-0">
                {r.ok ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <Badge variant="outline" className="shrink-0">{r.product_key}</Badge>
                <Badge variant="secondary" className="shrink-0">{r.channel}</Badge>
                <span className="font-mono text-xs truncate flex-1">{r.url}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {r.status_code ?? "—"} · {r.response_ms ?? "—"}ms
                </span>
              </div>
            ))}
            {list.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No results yet. Click "Run audit now" to start.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
