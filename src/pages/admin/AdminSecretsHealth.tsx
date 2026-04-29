import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, KeyRound, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ProviderResult {
  provider: string;
  ok: boolean;
  status: number | null;
  latency_ms: number;
  secret_present: boolean;
  error: string | null;
  detail: string | null;
}

interface ValidationResponse {
  ok: boolean;
  timestamp: string;
  results: ProviderResult[];
}

export default function AdminSecretsHealth() {
  const [data, setData] = useState<ValidationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: invokeErr } = await supabase.functions.invoke("validate-osint-secrets", {
        method: "POST",
      });
      if (invokeErr) throw invokeErr;
      setData(result as ValidationResponse);
      const failed = (result as ValidationResponse).results.filter((r) => !r.ok).length;
      if (failed === 0) toast.success("All secrets validated successfully");
      else toast.error(`${failed} provider${failed > 1 ? "s" : ""} failed validation`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(`Validation failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
  }, []);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <KeyRound className="w-7 h-7" />
            OSINT Secrets Health
          </h1>
          <p className="text-muted-foreground mt-1">
            Live connectivity tests for SEC EDGAR, USPTO, and GitHub APIs
          </p>
        </div>
        <Button onClick={run} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Re-run tests
        </Button>
      </div>

      {error && (
        <Card className="p-4 mb-4 border-destructive bg-destructive/10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Validator could not run</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {data && (
        <div className="space-y-3">
          <Card className="p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Last checked: {new Date(data.timestamp).toLocaleString()}
            </span>
            <Badge variant={data.ok ? "default" : "destructive"}>
              {data.ok ? "All systems operational" : "Issues detected"}
            </Badge>
          </Card>

          {data.results.map((r) => (
            <Card key={r.provider} className={`p-5 border-l-4 ${r.ok ? "border-l-green-500" : "border-l-destructive"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {r.ok ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{r.provider}</h3>
                      {!r.secret_present && <Badge variant="outline">Secret missing</Badge>}
                      {r.status !== null && (
                        <Badge variant={r.ok ? "secondary" : "destructive"}>HTTP {r.status}</Badge>
                      )}
                      {r.latency_ms > 0 && (
                        <span className="text-xs text-muted-foreground">{r.latency_ms}ms</span>
                      )}
                    </div>
                    {r.error && (
                      <p className="text-sm text-destructive mt-1 font-mono">{r.error}</p>
                    )}
                    {r.detail && (
                      <p className="text-sm text-muted-foreground mt-1 break-words">{r.detail}</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!data && !error && loading && (
        <Card className="p-8 text-center text-muted-foreground">
          Running connectivity tests...
        </Card>
      )}
    </div>
  );
}
