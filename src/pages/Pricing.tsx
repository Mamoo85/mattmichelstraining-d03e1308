import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Star, Zap, Shield, Crown, ArrowRight, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import { useAuth, TIERS, TierKey } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const TIER_CARDS: {
  key: TierKey;
  icon: typeof Star;
  features: string[];
  highlight?: boolean;
  cta: string;
}[] = [
  {
    key: "basic",
    icon: Zap,
    features: [
      "Monthly 'Real Deal' newsletter",
      "Full text-based exercise library",
      "Monthly Focus Plan access",
      "Member challenges",
    ],
    cta: "Start Basic",
  },
  {
    key: "pro",
    icon: Star,
    highlight: true,
    features: [
      "Everything in Basic",
      "Custom program from intake form",
      "Optional postural video assessment",
      "Monthly program updates",
      "Full 'Fix It' rehab library",
    ],
    cta: "Go Pro",
  },
  {
    key: "elite",
    icon: Crown,
    features: [
      "Everything in Pro",
      "1-on-1 monthly check-ins with Matt",
      "Priority postural assessments",
      "Direct messaging support",
    ],
    cta: "Go Elite",
  },
];

const Pricing = () => {
  const { user, subscribed, subscriptionTier, subscriptionEnd } = useAuth();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<TierKey | null>(null);

  const handleCheckout = async (tierKey: TierKey) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoadingTier(tierKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: TIERS[tierKey].price_id },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast({ title: "Checkout error", description: e.message, variant: "destructive" });
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManage = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast({ title: "Portal error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-24 pb-16">
        {/* Value comparison banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/5 border border-primary/15 p-4 md:p-5 mb-8 max-w-3xl mx-auto"
        >
          <p className="text-xs text-muted-foreground leading-relaxed text-center">
            <span className="text-foreground font-bold">Why parents & coaches are switching to online strength training:</span>{" "}
            The average family spends $200–$600/month on in-person youth training. Matt's online programs start at{" "}
            <span className="text-primary font-bold">$12.99/month</span> — same 20 years of experience, delivered to your phone, 
            available in any state. No travel, no scheduling conflicts, no contracts.
          </p>
        </motion.div>

        {/* Header */}
        <div className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-foreground mb-4"
          >
            Online Strength Training Plans
          </motion.h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Every tier is month-to-month. Cancel anytime. No contracts — just affordable, proven strength programming for athletes in any sport, any state.
          </p>

          {subscribed && subscriptionTier && (
            <div className="mt-6 inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-sm text-sm font-bold uppercase tracking-widest">
              <Shield className="w-4 h-4" />
              You're on {TIERS[subscriptionTier].name}
              {subscriptionEnd && (
                <span className="text-muted-foreground font-normal normal-case ml-2">
                  · renews {new Date(subscriptionEnd).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tier grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {TIER_CARDS.map((card, i) => {
            const tier = TIERS[card.key];
            const isCurrentPlan = subscriptionTier === card.key;
            const Icon = card.icon;

            return (
              <motion.div
                key={card.key}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative flex flex-col border-2 p-6 ${
                  card.highlight
                    ? "border-primary bg-primary/5"
                    : isCurrentPlan
                    ? "border-primary/60 bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                {card.highlight && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-1">
                    Most Popular
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-1">
                    Your Plan
                  </div>
                )}

                <Icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="text-lg font-black uppercase tracking-tight text-foreground">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mt-1 mb-4">
                  <span className="text-3xl font-black text-foreground">{tier.price}</span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>

                <ul className="flex-1 space-y-2 mb-6">
                  {card.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <button
                    onClick={handleManage}
                    className="w-full py-3 text-xs font-bold uppercase tracking-widest border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    Manage Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckout(card.key)}
                    disabled={loadingTier === card.key}
                    className={`w-full py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${
                      card.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border-2 border-foreground text-foreground hover:bg-foreground hover:text-background"
                    }`}
                  >
                    {loadingTier === card.key ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {card.cta} <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Free member banner */}
        <div className="mt-12 text-center border-2 border-dashed border-border p-8 max-w-2xl mx-auto">
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">
            Free When You Sign Up
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create an account and get Monthly Focus Plans, member challenges, and workout logging — no credit card required.
          </p>
          {!user && (
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-foreground/90 transition-colors"
            >
              Create Free Account <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pricing;
