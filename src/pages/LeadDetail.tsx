import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { LockedDossierCard } from "@/components/marketplace/LockedDossierCard";
import type { MarketplaceLead } from "@/components/marketplace/GoldenTicketCard";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function LeadDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [lead, setLead] = useState<MarketplaceLead | null>(null);
  const [loading, setLoading] = useState(true);

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
    toast.info(`Checkout opening soon — lead #${l.id.slice(0, 6).toUpperCase()}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Lead Dossier · Detroit Web Agency</title>
        <meta name="description" content="Single-buyer marketplace lead dossier with equity intel, signal strength, and verified contact." />
      </Helmet>

      <div className="container max-w-2xl mx-auto px-4 py-8">
        <Link to="/mortgage-leads" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-3 h-3" /> Back to marketplace
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading dossier…
          </div>
        ) : !lead ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">This lead has expired or been removed.</p>
            <Link to="/mortgage-leads" className="text-intel-teal underline text-sm mt-3 inline-block">View live marketplace</Link>
          </div>
        ) : (
          <LockedDossierCard lead={lead} onClaim={handleClaim} />
        )}
      </div>
    </div>
  );
}
