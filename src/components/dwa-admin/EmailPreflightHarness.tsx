// Email Preflight Harness
// Renders trial-invite email previews for sampled queue rows AND verifies
// every CTA link returns 200 from the live site. Used to gate cohorts before
// `resend-trial-invites` is fired. Read-only — never sends mail.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, ExternalLink, Eye, AlertTriangle, Mail } from "lucide-react";
import { toast } from "sonner";

type Preview = {
  email: string;
  business_name: string | null;
  product_key: string;
  queue_id: string | null;
  queue_status: string | null;
  html: string;
  subject: string;
  ctaUrl: string;
};

type LinkCheck = {
  url: string;
  status: number;
  ok: boolean;
  final_url: string;
  ms: number;
  error?: string;
};

type Result = {
  ok: boolean;
  site_url: string;
  sample_size: number;
  previews: Preview[];
  link_checks: LinkCheck[];
  suppressed_emails: string[];
  product_keys_known: string[];
  generated_at: string;
};

export default function EmailPreflightHarness() {
  const [productKey, setProductKey] = useState<string>("");
  const [sampleSize, setSampleSize] = useState<number>(5);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [activePreviewIdx, setActivePreviewIdx] = useState(0);
  const [knownProducts, setKnownProducts] = useState<string[]>([]);

  // Prime known product keys with a fast no-op call.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.functions.invoke("email-preflight-check", {
        body: { sample_size: 1, verify_links: false },
      });
      const r = data as Result | null;
      if (r?.product_keys_known) setKnownProducts(r.product_keys_known);
    })();
  }, []);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("email-preflight-check", {
        body: {
          sample_size: sampleSize,
          product_key: productKey || undefined,
          verify_links: true,
        },
      });
      if (error) throw error;
      const r = data as Result;
      setResult(r);
      setActivePreviewIdx(0);
      const broken = r.link_checks.filter((c) => !c.ok).length;
      if (broken > 0) {
        toast.error(`${broken} broken link${broken > 1 ? "s" : ""} found`);
      } else {
        toast.success(`All ${r.link_checks.length} link${r.link_checks.length > 1 ? "s" : ""} return 200`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Preflight failed");
    } finally {
      setRunning(false);
    }
  }

  const activePreview = result?.previews[activePreviewIdx];
  const linkByProduct = useMemo(() => {
    const map: Record<string, LinkCheck> = {};
    for (const lc of result?.link_checks ?? []) {
      try {
        const u = new URL(lc.url);
        const k = u.searchParams.get("product") || "";
        map[k] = lc;
      } catch {/* ignore */}
    }
    return map;
  }, [result]);

  const allLinksOk = (result?.link_checks ?? []).every((c) => c.ok);
  const suppressed = new Set(result?.suppressed_emails ?? []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">📧 Email Preflight Harness</h2>
          <p className="text-sm text-muted-foreground">
            Preview the trial-invite email and verify every CTA link before draining the queue. Read-only.
          </p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm space-y-1.5">
            <span className="font-semibold">Product (optional)</span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={productKey}
              onChange={(e) => setProductKey(e.target.value)}
            >
              <option value="">All products in queue</option>
              {knownProducts.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1.5">
            <span className="font-semibold">Sample size</span>
            <input
              type="number"
              min={1}
              max={25}
              value={sampleSize}
              onChange={(e) => setSampleSize(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-end">
            <Button onClick={run} disabled={running} className="w-full">
              {running ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running…</> : <><Eye className="w-4 h-4 mr-2" /> Preview & Verify Links</>}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Pulls sample rows from <code>trial_resend_queue</code> (status=pending). If empty, falls back to a synthetic test recipient so you can still preview a product.
        </p>
      </Card>

      {result && (
        <>
          {/* Summary banner */}
          <Card className={`p-4 border-l-4 ${allLinksOk ? "border-l-green-500" : "border-l-red-500"}`}>
            <div className="flex items-start gap-3">
              {allLinksOk
                ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                : <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
              <div className="space-y-1 flex-1">
                <p className="font-semibold">
                  {allLinksOk
                    ? `All links healthy — safe to send (${result.sample_size} sample row${result.sample_size > 1 ? "s" : ""})`
                    : `Broken links detected — DO NOT send`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Site: <code>{result.site_url}</code> · Generated {new Date(result.generated_at).toLocaleTimeString()}
                  {suppressed.size > 0 && ` · ${suppressed.size} sampled recipient(s) on suppression list`}
                </p>
              </div>
            </div>
          </Card>

          {/* Link verification table */}
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold">Link Verification ({result.link_checks.length})</h3>
            <div className="space-y-1.5">
              {result.link_checks.map((c) => (
                <div key={c.url} className="flex items-center gap-2 text-sm font-mono p-2 rounded bg-muted/30">
                  {c.ok ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                  <span className={`text-xs px-1.5 rounded ${c.ok ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600"}`}>
                    {c.status || "ERR"}
                  </span>
                  <span className="text-xs text-muted-foreground">{c.ms}ms</span>
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-xs truncate flex-1 hover:underline">{c.url}</a>
                  <a href={c.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </a>
                  {c.error && <span className="text-xs text-red-500 truncate">{c.error}</span>}
                </div>
              ))}
            </div>
          </Card>

          {/* Sample list + email preview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-4 space-y-2 lg:col-span-1">
              <h3 className="font-semibold flex items-center gap-2"><Mail className="w-4 h-4" /> Sample ({result.previews.length})</h3>
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                {result.previews.map((p, i) => {
                  const isActive = i === activePreviewIdx;
                  const lc = linkByProduct[p.product_key];
                  const isSuppressed = suppressed.has(p.email);
                  return (
                    <button
                      key={`${p.email}-${i}`}
                      onClick={() => setActivePreviewIdx(i)}
                      className={`w-full text-left p-2 rounded border text-xs transition ${isActive ? "bg-primary/10 border-primary" : "bg-background hover:bg-muted/50 border-border"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono truncate">{p.email}</span>
                        {lc && (lc.ok
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />)}
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        {p.product_key}{p.business_name ? ` · ${p.business_name}` : ""}
                      </div>
                      {isSuppressed && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-2.5 h-2.5" /> SUPPRESSED — will be skipped
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="p-4 space-y-3 lg:col-span-2">
              {activePreview ? (
                <>
                  <div className="space-y-1">
                    <div className="text-xs uppercase text-muted-foreground tracking-wider">Subject</div>
                    <div className="font-semibold">{activePreview.subject}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase text-muted-foreground tracking-wider">CTA URL</div>
                    <a href={activePreview.ctaUrl} target="_blank" rel="noreferrer" className="text-xs font-mono break-all hover:underline text-primary">
                      {activePreview.ctaUrl}
                    </a>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase text-muted-foreground tracking-wider">Rendered HTML</div>
                    <div className="rounded border bg-white">
                      <iframe
                        title="Email preview"
                        sandbox=""
                        srcDoc={activePreview.html}
                        className="w-full h-[520px] rounded"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Run preflight to see a preview.</div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
