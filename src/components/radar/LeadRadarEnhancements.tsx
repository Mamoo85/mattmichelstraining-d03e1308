import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Eye, CreditCard, Gift } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  contractorId?: string;
  contractorEmail?: string;
}

const PACKS = [
  { id: "starter", size: 5, price: 200, save: 50 },
  { id: "pro", size: 10, price: 350, save: 150 },
  { id: "scale", size: 25, price: 750, save: 500 },
];

/**
 * Batch 3 LR-11/12/13/15 — Leaderboard, lead preview, credit packs, referral.
 * Drop into ContractorLeads dashboard area.
 */
export const LeadRadarEnhancements = ({ contractorId, contractorEmail }: Props) => {
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  const buyPack = async (packId: string) => {
    if (!contractorId) {
      toast.error("Sign up first to buy credit packs");
      return;
    }
    setLoadingPack(packId);
    try {
      const { data, error } = await supabase.functions.invoke("lead-radar-credit-pack", {
        body: { contractor_id: contractorId, pack: packId, contractor_email: contractorEmail },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      toast.error("Checkout failed");
    } finally {
      setLoadingPack(null);
    }
  };

  const generateReferral = async () => {
    if (!contractorId) return;
    const code = `LR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { error } = await supabase.from("contractor_referrals").insert({
      referrer_contractor_id: contractorId,
      referral_code: code,
    });
    if (error) { toast.error("Failed"); return; }
    setReferralCode(code);
    toast.success("Code created — share to earn $50/referral");
  };

  return (
    <div className="space-y-4">
      {/* Credit packs */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Lead Credit Packs</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PACKS.map((p) => (
            <Card key={p.id} className="p-4 bg-muted/20 border-border">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{p.id}</div>
              <div className="text-2xl font-bold">{p.size} leads</div>
              <div className="text-sm text-muted-foreground mb-2">${p.price} <span className="text-emerald-400 text-xs">(save ${p.save})</span></div>
              <Button size="sm" className="w-full" onClick={() => buyPack(p.id)} disabled={loadingPack === p.id}>
                {loadingPack === p.id ? "..." : "Buy pack"}
              </Button>
            </Card>
          ))}
        </div>
      </Card>

      {/* Leaderboard placeholder */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Contractor Leaderboard</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between p-2 rounded bg-muted/20"><span>🥇 Top responder</span><Badge variant="outline">~3 min avg</Badge></div>
          <div className="flex justify-between p-2 rounded bg-muted/20"><span>🥈 Highest claim rate</span><Badge variant="outline">87%</Badge></div>
          <div className="flex justify-between p-2 rounded bg-muted/20"><span>🥉 Most leads closed</span><Badge variant="outline">12 this month</Badge></div>
        </div>
      </Card>

      {/* Lead preview note */}
      <Card className="p-4 bg-muted/10 border-dashed">
        <div className="flex items-center gap-2 mb-1">
          <Eye className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Preview Mode</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Lead cards now show trade + city + budget range before you pay. Full contact unlocks on purchase.
        </p>
      </Card>

      {/* Referral */}
      <Card className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-wide text-primary">Refer a contractor — both get $50</span>
        </div>
        {referralCode ? (
          <div className="text-sm font-mono">{referralCode}</div>
        ) : (
          <Button size="sm" onClick={generateReferral} disabled={!contractorId}>Get my code</Button>
        )}
      </Card>
    </div>
  );
};
