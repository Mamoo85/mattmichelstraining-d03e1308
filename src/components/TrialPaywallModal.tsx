import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ArrowRight, Loader2, Lock, Star, Trophy, Zap } from "lucide-react";
import { useAuth, TIERS } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface TrialPaywallModalProps {
  open: boolean;
  onClose?: () => void;
  /** If true, modal cannot be dismissed */
  hardLock?: boolean;
}

const TIER_OPTIONS = [
  {
    key: "basic" as const,
    name: "M² Basic",
    price: "$12.99/mo",
    icon: Star,
    perks: ["Monthly Focus Plan", "Workout logging & tracking", "Challenges & leaderboard", "10% off programs"],
  },
  {
    key: "pro" as const,
    name: "M² Pro",
    price: "$25.99/mo",
    icon: Trophy,
    highlight: true,
    perks: ["Everything in Basic", "Fix It recovery library", "Direct messaging with Matt", "Video form checks", "15% off programs"],
  },
  {
    key: "elite" as const,
    name: "M² Elite",
    price: "$42.99/mo",
    icon: Zap,
    perks: ["Everything in Pro", "1-on-1 coaching from Matt", "Priority scheduling", "Custom programming", "20% off programs"],
  },
];

const TrialPaywallModal = ({ open, onClose, hardLock }: TrialPaywallModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (tierKey: "basic" | "pro" | "elite") => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoading(tierKey);
    try {
      const priceId = TIERS[tierKey].price_id;
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Checkout error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
      <div className="bg-card border border-border p-6 max-w-2xl w-full relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {!hardLock && onClose && (
          <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        )}

        <div className="text-center mb-6">
          <Lock size={28} className="text-primary mx-auto mb-3" />
          <h2 className="text-xl font-black uppercase tracking-tight text-foreground mb-2">
            Your 14-Day Trial Has Ended
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You've seen how we do things. Now subscribe to keep your progress, unlock the full exercise library,
            and keep Coach Matt's eyes on your training.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {TIER_OPTIONS.map((tier) => (
            <div
              key={tier.key}
              className={`bg-background p-4 flex flex-col ${
                tier.highlight ? "border-2 border-primary ring-2 ring-primary/20" : "border border-border"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <tier.icon size={14} className={tier.highlight ? "text-primary" : "text-muted-foreground"} />
                <span className="text-xs font-bold text-foreground">{tier.name}</span>
              </div>
              {tier.highlight && (
                <span className="text-[8px] bg-primary text-primary-foreground px-2 py-0.5 font-bold uppercase tracking-widest w-fit mb-2">
                  Most Popular
                </span>
              )}
              <p className="text-lg font-bold text-primary font-mono mb-3">{tier.price}</p>
              <ul className="space-y-1 mb-4 flex-1">
                {tier.perks.map((p) => (
                  <li key={p} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">✓</span> {p}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(tier.key)}
                disabled={loading !== null}
                className={`w-full py-2.5 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                  tier.highlight
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border border-primary text-primary hover:bg-primary/10"
                }`}
              >
                {loading === tier.key ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                {loading === tier.key ? "Loading…" : "Subscribe"}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-muted-foreground">
          Cancel anytime. Your progress is saved. Real coaching, real results.
        </p>
      </div>
    </div>
  );
};

export default TrialPaywallModal;
