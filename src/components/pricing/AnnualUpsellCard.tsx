import { memo, useState } from "react";
import { CalendarDays, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useAuth, TIERS, ANNUAL_TIERS, TierKey } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Dashboard upsell card shown to monthly subscribers.
 * Offers switching to annual billing with "Save 17%" badge.
 */
const AnnualUpsellCard = memo(() => {
  const { subscribed, subscriptionTier } = useAuth();
  const [loading, setLoading] = useState(false);

  // Only show to active monthly subscribers
  if (!subscribed || !subscriptionTier) return null;

  const tier = TIERS[subscriptionTier];
  const annual = ANNUAL_TIERS[subscriptionTier];
  const monthlyCost = tier.priceNum;
  const yearlySaving = (monthlyCost * 12 - annual.priceNum).toFixed(2);

  const handleSwitch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: annual.price_id,
          successUrl: "/dashboard?checkout=annual-success",
        },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Checkout error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-primary/5 border-2 border-primary/30 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays size={14} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Save With Annual</span>
        <span className="text-[9px] font-bold uppercase tracking-widest bg-primary text-primary-foreground px-2 py-0.5 ml-auto">
          Save ${yearlySaving}/yr
        </span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">
        Switch to annual billing and get <strong className="text-primary">2 months free</strong>. 
        That's {annual.monthlyEquiv}/mo instead of {tier.price}/mo.
      </p>
      <button
        onClick={handleSwitch}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : (
          <>
            <Sparkles size={14} /> Switch to Annual — {annual.price}/yr <ArrowRight size={12} />
          </>
        )}
      </button>
    </div>
  );
});

AnnualUpsellCard.displayName = "AnnualUpsellCard";

export default AnnualUpsellCard;
