import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2, Lock, ShieldCheck, ArrowLeft, AlertTriangle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreBars, EquityPanel, MetricsRow, TcpaBadge, TierBadge, FreshnessBadge } from "@/components/marketplace/GoldenTicketCard";
import { SourceIconRow } from "@/components/marketplace/SourceIconRow";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type RedeemState =
  | { kind: "loading" }
  | { kind: "ok"; lead: any; expires_at?: string }
  | { kind: "error"; code: string; retry_after?: number };

export default function SharedLead() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<RedeemState>({ kind: "loading" });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const url = `${SUPABASE_URL}/functions/v1/marketplace-share-token?token=${encodeURIComponent(token)}`;
    fetch(url, { method: "GET" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "error", code: json?.error || `http_${res.status}`, retry_after: json?.retry_after });
        } else {
          setState({ kind: "ok", lead: json.lead, expires_at: json.expires_at });
        }
      })
      .catch(() => !cancelled && setState({ kind: "error", code: "network" }));
    return () => { cancelled = true; };
  }, [token]);

  const lead = state.kind === "ok" ? state.lead : null;
  const locationLine = lead ? [lead.city, lead.state, lead.zip].filter(Boolean).join(", ") : "";
  const daysLeft = state.kind === "ok" && state.expires_at
    ? Math.max(0, Math.ceil((new Date(state.expires_at).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Shared Lead Dossier · Detroit Web Agency</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="description" content="Read-only redacted dossier preview shared by the original buyer." />
        <meta property="og:title" content="Marketplace Lead Dossier (Redacted Preview)" />
        <meta property="og:description" content="Verified intel snapshot — contact info redacted. Unlock the full dossier in the marketplace." />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="container max-w-2xl mx-auto px-4 py-8">
        <Link to="/mortgage-leads" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-3 h-3" /> Back to marketplace
        </Link>

        {state.kind === "loading" && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Verifying share link…
          </div>
        )}

        {state.kind === "error" && (
          <Card className="p-8 text-center border-destructive/40 bg-destructive/5">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-destructive" />
            <h1 className="text-xl font-bold mb-2">
              {state.code === "expired" && "This share link has expired"}
              {state.code === "revoked" && "This share link was revoked"}
              {state.code === "max_redeems_reached" && "Share limit reached"}
              {state.code === "rate_limited" && "Too many attempts"}
              {state.code === "invalid_token" && "Link not found"}
              {!["expired","revoked","max_redeems_reached","rate_limited","invalid_token"].includes(state.code) && "Could not load this dossier"}
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
              {state.code === "rate_limited"
                ? `Please retry in ${Math.ceil((state.retry_after || 60) / 60)} minute(s).`
                : "Ask the buyer to send a fresh link, or browse the live marketplace for current leads."}
            </p>
            <Button asChild>
              <Link to="/mortgage-leads">Browse marketplace</Link>
            </Button>
          </Card>
        )}

        {state.kind === "ok" && lead && (
          <>
            {/* Banner */}
            <Card className="mb-4 p-3 border-intel-teal/30 bg-intel-teal/5 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-intel-teal flex-shrink-0" />
              <div className="text-xs text-foreground/80">
                <strong className="text-intel-teal">Redacted preview</strong> — contact info hidden. Original buyer owns this lead.
                {daysLeft !== null && (
                  <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" /> {daysLeft}d left
                  </span>
                )}
              </div>
            </Card>

            <Card className="overflow-hidden bg-gradient-to-br from-card via-card to-background border-border/60">
              <div className="px-4 pt-4 pb-3 border-b border-border/40 flex items-start justify-between gap-2">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TierBadge tier={lead.signal_strength_tier} />
                    <FreshnessBadge days={lead.days_on_radar} />
                    <Badge variant="outline" className="text-[9px] font-mono uppercase border-muted-foreground/40">
                      <Lock className="w-2.5 h-2.5 mr-1" /> Redacted
                    </Badge>
                  </div>
                </div>
                <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider flex-shrink-0">
                  Lead #{String(lead.id || "").slice(0, 6).toUpperCase()}
                </div>
              </div>

              <div className="p-4 space-y-3">
                {lead.human_summary && (
                  <p className="text-sm text-foreground leading-relaxed">{lead.human_summary}</p>
                )}

                <div className="flex items-center gap-2 text-xs font-mono">
                  <Lock className="w-3 h-3 text-seal-gold" />
                  <span className="text-muted-foreground">REDACTED ST,</span>
                  <span className="text-foreground">{locationLine || "Metro Detroit"}</span>
                </div>

                <ScoreBars score={lead.score} percentile={lead.score_percentile} history={lead.score_history} />
                <SourceIconRow sources={lead.provenance_sources || lead.provenance_source_urls} />
                <EquityPanel lead={lead} />
                <MetricsRow lead={lead} />

                <div className="flex items-center justify-between pt-1">
                  <TcpaBadge clear={lead.tcpa_clear} />
                  <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
                    Source: DWA Scanner
                  </span>
                </div>
              </div>

              <div className="px-4 pb-4 pt-2 border-t border-border/40 bg-gradient-to-b from-transparent to-seal-gold/5 space-y-2">
                <Button asChild className="w-full bg-gradient-to-r from-seal-gold to-orange-500 hover:from-seal-gold hover:to-orange-400 text-background font-bold tracking-wide" size="lg">
                  <Link to="/mortgage-leads">Browse live marketplace</Link>
                </Button>
                <p className="text-[10px] text-center text-muted-foreground font-mono tracking-wider">
                  TCPA notice: contact only with proper consent. Verify DNC & licensing before outreach.
                </p>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
