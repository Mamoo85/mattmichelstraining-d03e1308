import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { LockedDossierCard } from "@/components/marketplace/LockedDossierCard";
import { UnlockedDossierCard } from "@/components/marketplace/UnlockedDossierCard";
import { BuyerEmailDialog } from "@/components/marketplace/BuyerEmailDialog";
import type { MarketplaceLead } from "@/components/marketplace/GoldenTicketCard";
import { Loader2, ArrowLeft, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function LeadDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const [lead, setLead] = useState<MarketplaceLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  const isPaid = params.get("paid") === "1" || params.get("print") === "1";
  const buyerEmail = params.get("buyer") || localStorage.getItem("mp_buyer_email") || "";
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [pendingClaimLead, setPendingClaimLead] = useState<MarketplaceLead | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    supabase
      .from("unified_lead_marketplace_view" as any)
      .select("*")
      .eq("id", slug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error(error);
        setLead((data as unknown as MarketplaceLead) || null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  const handleClaim = (l: MarketplaceLead) => {
    setPendingClaimLead(l);
    setClaimDialogOpen(true);
  };

  const handleClaimEmailConfirm = async (email: string) => {
    const l = pendingClaimLead;
    if (!l) return;
    localStorage.setItem("mp_buyer_email", email);
    try {
      const { data, error } = await supabase.functions.invoke("create-marketplace-lead-checkout", {
        body: { lead_id: l.id, product: (l as any).product || "mortgage", buyer_email: email },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (url) window.location.href = url;
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes("already_sold")) toast.error("That lead just sold to someone else.");
      else if (msg.includes("locked_by_other")) toast.error("Another buyer has a 10-min hold on this lead.");
      else toast.error("Checkout failed — try again.");
    }
  };

  const handleExportPdf = async () => {
    if (!lead || !buyerEmail) return toast.error("Missing buyer email");
    setPdfBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketplace-generate-dossier-pdf", {
        body: { lead_id: lead.id, product: (lead as any).product, buyer_email: buyerEmail },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (url) window.open(url, "_blank");
    } catch (e) {
      toast.error("PDF generation failed");
    } finally { setPdfBusy(false); }
  };

  const handleShare = async () => {
    if (!lead || !buyerEmail) return toast.error("Missing buyer email");
    setShareBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketplace-share-token", {
        body: { lead_id: lead.id, product: (lead as any).product, buyer_email: buyerEmail },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (url) {
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied — valid 7 days, contact info redacted.");
      }
    } catch (e) {
      toast.error("Could not generate share link");
    } finally { setShareBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{isPaid ? "Unlocked" : "Lead"} Dossier · Detroit Web Agency</title>
        <meta name="description" content="Single-buyer marketplace lead dossier with equity intel, signal strength, and verified contact." />
      </Helmet>

      <div className="container max-w-2xl mx-auto px-4 py-8">
        {!params.get("print") && (
          <Link to="/mortgage-leads" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-3 h-3" /> Back to marketplace
          </Link>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading dossier…
          </div>
        ) : !lead ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">This lead has expired or been removed.</p>
            <Link to="/mortgage-leads" className="text-intel-teal underline text-sm mt-3 inline-block">View live marketplace</Link>
          </div>
        ) : isPaid ? (
          <UnlockedDossierCard
            lead={lead as any}
            onExportPdf={handleExportPdf}
            onShare={handleShare}
          />
        ) : (
          <LockedDossierCard lead={lead} onClaim={handleClaim} />
        )}

        {isPaid && lead && !params.get("print") && (
          <div className="mt-4 flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={pdfBusy}>
              <Download className="w-3 h-3 mr-1" /> {pdfBusy ? "Generating…" : "Download PDF"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare} disabled={shareBusy}>
              <Share2 className="w-3 h-3 mr-1" /> {shareBusy ? "Linking…" : "Share (redacted)"}
            </Button>
          </div>
        )}
      </div>

      <BuyerEmailDialog
        open={claimDialogOpen}
        onOpenChange={setClaimDialogOpen}
        onConfirm={handleClaimEmailConfirm}
        defaultEmail={buyerEmail}
        title="Enter your email"
        description="Where should we send the unlocked dossier after payment?"
      />
    </div>
  );
}
