import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, X, ArrowRight, Loader2 } from "lucide-react";
import { useAuth, TierKey, TIERS } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useTierAccess } from "@/hooks/useTierAccess";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const TIER_LEVEL: Record<string, number> = {
  basic: 1,
  pro: 2,
  elite: 3,
  team: 4,
};

interface PaywallGateProps {
  /** Legacy tier-based gate */
  requiredTier?: TierKey;
  /** New dynamic feature key from tier_features table */
  featureKey?: string;
  featureName: string;
  children: React.ReactNode;
}

const PaywallGate = ({ requiredTier, featureKey, featureName, children }: PaywallGateProps) => {
  const { subscriptionTier, user, isLegend } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { hasAccess } = useTierAccess(featureKey || "");

  // Admins and Legend members bypass all paywalls
  if (isAdmin || isLegend) return <>{children}</>;

  // If featureKey is provided, use dynamic tier_features check
  if (featureKey) {
    if (hasAccess) return <>{children}</>;
  } else if (requiredTier) {
    // Legacy: tier level comparison
    const userLevel = subscriptionTier ? (TIER_LEVEL[subscriptionTier] ?? 0) : 0;
    const requiredLevel = TIER_LEVEL[requiredTier] ?? 0;
    if (userLevel >= requiredLevel) return <>{children}</>;
  }

  const tierInfo: Record<string, { name: string; price: string }> = {
    basic: { name: "M² Basic", price: "$12.99/mo" },
    pro: { name: "M² Pro", price: "$25.99/mo" },
    elite: { name: "M² Elite", price: "$42.99/mo" },
    team: { name: "M² Team", price: "$84.99/mo" },
  };

  const displayTier = requiredTier || "basic";
  const info = tierInfo[displayTier];

  return (
    <div className="bg-card border border-border p-8 text-center">
      <Lock size={32} className="text-muted-foreground mx-auto mb-4" />
      <h3 className="text-base font-bold text-foreground mb-2">{featureName}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
        {user
          ? `Upgrade to ${info?.name} (${info?.price}) to unlock this feature.`
          : "Sign in and subscribe to access this feature."}
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        {user ? (
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            View Plans <ArrowRight size={14} />
          </Link>
        ) : (
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
};

/** Upsell modal for elite-gated features like Flag for Coach */
export const EliteUpsellModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: TIERS.elite.price_id },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Checkout error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border p-6 max-w-sm w-full relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
        <div className="text-center space-y-3">
          <div className="text-3xl">🏋️</div>
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Upgrade to Elite</h3>
          <p className="text-sm text-muted-foreground">
            Get direct form checks and 1-on-1 coaching from Matt. Flag exercises for review, get personalized feedback, and level up your training.
          </p>
          <div className="text-2xl font-black text-foreground">$42.99<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full h-12 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            {loading ? "Loading…" : "Upgrade Now"}
          </button>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaywallGate;

