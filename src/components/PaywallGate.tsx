import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, X, ArrowRight, Loader2 } from "lucide-react";
import { useAuth, TIERS } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useTierAccess } from "@/hooks/useTierAccess";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PaywallGateProps {
  featureKey: string;
  featureName: string;
  children: React.ReactNode;
}

const PaywallGate = ({ featureKey, featureName, children }: PaywallGateProps) => {
  const { user, isLegend } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { hasAccess } = useTierAccess(featureKey);

  // Admins and Legend members bypass all paywalls
  if (isAdmin || isLegend) return <>{children}</>;

  // Dynamic tier_features check
  if (hasAccess) return <>{children}</>;


  return (
    <div className="bg-card border border-border p-8 text-center">
      <Lock size={32} className="text-muted-foreground mx-auto mb-4" />
      <h3 className="text-base font-bold text-foreground mb-2">{featureName}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
        {user
          ? "Upgrade your plan to unlock this feature."
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
        body: { priceId: TIERS.custom.price_id },
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

