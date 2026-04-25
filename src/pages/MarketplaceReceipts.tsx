import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Share2, ScrollText, Loader2, Mail, ChevronDown, ChevronUp, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ShareLinkDialog } from "@/components/marketplace/ShareLinkDialog";
import { isEmail } from "@/lib/parseSearchParams";

interface Receipt {
  lead_id: string;
  product: string;
  purchased_at: string;
  amount_cents: number;
  pdf_url: string | null;
  lead_summary: {
    score?: number;
    signal_strength_tier?: string;
    signal_type?: string;
    city?: string | null;
    zip?: string | null;
    human_summary?: string | null;
    buyer_type?: string | null;
    suggested_opener?: string | null;
  };
  provenance: Array<{ url?: string; source?: string; label?: string; timestamp?: string } | string>;
}

const PRODUCT_LABEL: Record<string, string> = {
  mortgage: "Mortgage", talent: "Talent", demand: "Demand", growth: "Growth", supply: "Supply",
};

export default function MarketplaceReceipts() {
  const [email, setEmail] = useState(() => {
    // Only honor the URL email if it passes shape validation; bad input
    // would otherwise auto-trigger a useless server fetch on mount.
    const fromUrl = new URLSearchParams(window.location.search).get("email")?.trim() || "";
    if (fromUrl && isEmail(fromUrl)) return fromUrl;
    const stored = localStorage.getItem("mp_buyer_email") || "";
    return isEmail(stored) ? stored : "";
  });
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [regenBusy, setRegenBusy] = useState<string | null>(null);
  const [shareDialog, setShareDialog] = useState<{ open: boolean; url: string | null; expires_at: string | null }>({
    open: false, url: null, expires_at: null,
  });

  const fetchReceipts = async (lookupEmail: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketplace-buyer-receipts", {
        body: { buyer_email: lookupEmail },
      });
      if (error) throw error;
      setReceipts(((data as any)?.purchases || []) as Receipt[]);
      localStorage.setItem("mp_buyer_email", lookupEmail);
      setSubmittedEmail(lookupEmail);
    } catch (e) {
      console.error(e);
      toast.error("Could not load receipts");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load if email is in URL or localStorage
  useEffect(() => {
    if (email && email.includes("@") && !submittedEmail) {
      fetchReceipts(email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) {
      toast.error("Enter a valid email");
      return;
    }
    fetchReceipts(email.trim());
  };

  const handleShare = async (lead_id: string, product: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("marketplace-share-token", {
        body: { lead_id, product, buyer_email: submittedEmail },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      const expires_at = (data as any)?.expires_at;
      if (!url) throw new Error("no url");
      setShareDialog({ open: true, url, expires_at });
      navigator.clipboard?.writeText(url).catch(() => {});
    } catch (e) {
      console.error(e);
      toast.error("Could not generate share link");
    }
  };

  const handleRegeneratePdf = async (lead_id: string, product: string) => {
    setRegenBusy(lead_id);
    try {
      const { data, error } = await supabase.functions.invoke("marketplace-generate-dossier-pdf", {
        body: { lead_id, product, buyer_email: submittedEmail, force_regenerate: true },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("no url");
      // Update local state with the fresh URL
      setReceipts((prev) => prev.map((r) => r.lead_id === lead_id ? { ...r, pdf_url: url } : r));
      window.open(url, "_blank");
      toast.success("Fresh PDF generated");
    } catch {
      toast.error("Could not regenerate PDF");
    } finally {
      setRegenBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>My Receipts · Marketplace · Detroit Web Agency</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Header */}
      <div className="border-b border-border/40 bg-gradient-to-b from-card to-background">
        <div className="container max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-intel-teal mb-2">
            <ScrollText className="w-3.5 h-3.5" /> Receipts Inbox
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">My Purchased Dossiers</h1>
          <p className="text-muted-foreground max-w-2xl">
            Every lead you've unlocked. Re-download the PDF, share a redacted version, or audit the data trail.
          </p>
        </div>
      </div>

      {/* Email lookup */}
      {!submittedEmail && (
        <div className="container max-w-md mx-auto px-4 py-12">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Buyer email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="pl-10 bg-card border-border/40"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-intel-teal text-background hover:bg-intel-teal/90" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Look up my purchases"}
            </Button>
          </form>
        </div>
      )}

      {/* Results */}
      {submittedEmail && (
        <div className="container max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4 text-sm">
            <div className="text-muted-foreground">
              Showing receipts for <span className="text-foreground font-mono">{submittedEmail}</span>
            </div>
            <button
              onClick={() => { setSubmittedEmail(""); setReceipts([]); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Use different email
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : receipts.length === 0 ? (
            <Card className="p-12 text-center bg-card/50 border-dashed">
              <ScrollText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-4">No purchases on file for this email.</p>
              <Button variant="outline" asChild>
                <a href="/mortgage-leads">Browse the marketplace</a>
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {receipts.map((r) => {
                const isExpanded = expanded === r.lead_id;
                return (
                  <Card key={r.lead_id + r.purchased_at} className="bg-card/80 border-border/40 overflow-hidden">
                    <div className="p-4 md:p-5">
                      {/* Top row: badges + price */}
                      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider border-intel-teal/40 text-intel-teal">
                            {PRODUCT_LABEL[r.product] || r.product}
                          </Badge>
                          {r.lead_summary.signal_strength_tier && (
                            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
                              {r.lead_summary.signal_strength_tier}
                            </Badge>
                          )}
                          {typeof r.lead_summary.score === "number" && (
                            <span className="text-xs font-mono text-muted-foreground">
                              Score {r.lead_summary.score}/10
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono text-muted-foreground">
                            {new Date(r.purchased_at).toLocaleDateString()}
                          </div>
                          {r.amount_cents > 0 && (
                            <div className="text-sm font-semibold">${(r.amount_cents / 100).toFixed(2)}</div>
                          )}
                        </div>
                      </div>

                      {/* Headline */}
                      <div className="mb-3">
                        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                          {r.lead_summary.signal_type || "Lead"} · {r.lead_summary.city || r.lead_summary.zip || "Metro Detroit"}
                        </div>
                        {r.lead_summary.human_summary && (
                          <p className="text-sm text-foreground/90 line-clamp-2">{r.lead_summary.human_summary}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!r.pdf_url}
                          onClick={() => r.pdf_url && window.open(r.pdf_url, "_blank")}
                        >
                          <FileText className="w-3.5 h-3.5 mr-1.5" />
                          {r.pdf_url ? "Download PDF" : "PDF unavailable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRegeneratePdf(r.lead_id, r.product)}
                          disabled={regenBusy === r.lead_id}
                          title="Force a fresh PDF if the download link is broken"
                        >
                          {regenBusy === r.lead_id
                            ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                          Regenerate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleShare(r.lead_id, r.product)}
                        >
                          <Share2 className="w-3.5 h-3.5 mr-1.5" />
                          Share (redacted)
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpanded(isExpanded ? null : r.lead_id)}
                        >
                          <ScrollText className="w-3.5 h-3.5 mr-1.5" />
                          Provenance
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`/lead/${r.lead_id}`}>
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open dossier
                          </a>
                        </Button>
                      </div>

                      {/* Inline provenance */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border/40">
                          <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                            Source audit trail
                          </div>
                          {r.provenance.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">No provenance records on file.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {r.provenance.map((p, i) => {
                                const obj = typeof p === "string" ? { url: p } as any : p;
                                return (
                                  <li key={i} className="flex items-start gap-2 text-xs">
                                    <span className="text-muted-foreground font-mono mt-0.5">{i + 1}.</span>
                                    <div className="flex-1 min-w-0">
                                      {obj.label || obj.source ? (
                                        <div className="text-foreground/80">{obj.label || obj.source}</div>
                                      ) : null}
                                      {obj.url && (
                                        <a
                                          href={obj.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-intel-teal hover:underline break-all"
                                        >
                                          {obj.url}
                                        </a>
                                      )}
                                      {obj.timestamp && (
                                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                          {new Date(obj.timestamp).toLocaleString()}
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ShareLinkDialog
        open={shareDialog.open}
        onOpenChange={(v) => setShareDialog((s) => ({ ...s, open: v }))}
        url={shareDialog.url}
        expiresAt={shareDialog.expires_at}
      />
    </div>
  );
}
