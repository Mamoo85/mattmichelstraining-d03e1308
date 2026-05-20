import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

interface ScopeStatus {
  ok: boolean;
  connected: boolean;
  shop_id: string | null;
  shop_name: string | null;
  scopes: { shops_r: boolean; listings_r: boolean; images_r: boolean };
  missing_scopes: string[];
  needs_reauth: boolean;
  error: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export default function EtsyScopeBanner({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<ScopeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function check() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("etsy-scope-check");
      if (error) throw error;
      setStatus(data as ScopeStatus);
    } catch (e: any) {
      setStatus({
        ok: false, connected: false, shop_id: null, shop_name: null,
        scopes: { shops_r: false, listings_r: false, images_r: false },
        missing_scopes: [], needs_reauth: true,
        error: e.message || "Unable to reach Etsy",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { check(); }, []);

  function reauth() {
    const redirectBack = window.location.href;
    const url = `${SUPABASE_URL}/functions/v1/etsy-oauth-start?redirect_back=${encodeURIComponent(redirectBack)}`;
    window.location.href = url;
  }

  async function resync() {
    setSyncing(true);
    try {
      await supabase.functions.invoke("etsy-product-sync", { body: {} });
    } finally {
      setSyncing(false);
      check();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Checking Etsy connection…
      </div>
    );
  }

  if (!status) return null;

  // Healthy
  if (status.ok && !status.needs_reauth) {
    if (compact) return null;
    return (
      <Alert className="mb-4 border-green-500/40 bg-green-500/5">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <AlertTitle>Etsy connected — {status.shop_name || `shop ${status.shop_id}`}</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-2">
          <span className="text-xs">All scopes granted (shops_r, listings_r, images). Sync is healthy.</span>
          <Button size="sm" variant="outline" onClick={resync} disabled={syncing}>
            {syncing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Resync now
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Needs re-auth
  const missingList = [
    !status.scopes.shops_r && "shops_r (read your shop)",
    !status.scopes.listings_r && "listings_r (read your listings)",
    !status.scopes.images_r && "listings_r → images (read listing photos)",
  ].filter(Boolean) as string[];

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {status.connected
          ? "Etsy token is missing required permissions"
          : "Etsy is not connected"}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm">
          {status.connected ? (
            <>
              The token connected to <strong>{status.shop_name || `shop ${status.shop_id || "(unknown)"}`}</strong> can't
              read the data we need. Product images and listing details will appear blank until you re-authorize.
            </>
          ) : (
            <>We don't have a valid Etsy OAuth token on file. Connect your Etsy account to start syncing.</>
          )}
        </p>

        {missingList.length > 0 && (
          <div className="text-xs bg-background/40 border border-destructive/30 rounded p-2">
            <div className="font-bold uppercase tracking-widest mb-1">Missing scopes</div>
            <ul className="list-disc list-inside space-y-0.5">
              {missingList.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        )}

        <ol className="text-xs space-y-1 list-decimal list-inside">
          <li>Click <strong>Re-authorize Etsy</strong> below.</li>
          <li>On Etsy's consent page, sign in as <strong>Yarningforyoubylisa</strong> (not any other Etsy account).</li>
          <li>Approve <strong>all</strong> requested permissions (shops, listings, transactions, profile, email).</li>
          <li>You'll be sent back here automatically.</li>
        </ol>

        {status.error && (
          <p className="text-xs opacity-80">Last error: <code>{status.error}</code></p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={reauth} size="sm" variant="default">
            Re-authorize Etsy →
          </Button>
          <Button onClick={check} size="sm" variant="outline">
            <RefreshCw className="w-3 h-3 mr-1" /> Re-check
          </Button>
          {status.scopes.shops_r && status.scopes.listings_r && (
            <Button onClick={resync} size="sm" variant="outline" disabled={syncing}>
              {syncing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Resync now
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
