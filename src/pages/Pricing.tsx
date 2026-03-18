import { useState } from "react";
import { motion } from "framer-motion";
import SEOHead from "@/components/SEOHead";
import { Check, X as XIcon, Star, Zap, Shield, Crown, Users, ArrowRight, Loader2, Tag, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import { useAuth, TIERS, TierKey, TIER_DISCOUNTS } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useContentMap } from "@/hooks/useSiteContent";
import TrialCTA from "@/components/TrialCTA";
import { getStoredReferralCode, clearStoredReferralCode } from "@/hooks/useReferral";
import CheckoutConfirmationModal, { type CheckoutProductType } from "@/components/CheckoutConfirmationModal";

const TIER_CARDS: {
  key: TierKey;
  icon: typeof Star;
  features: string[];
  highlight?: boolean;
  cta: string;
  label?: string;
  subtitle?: string;
}[] = [
  {
    key: "basic",
    icon: Zap,
    features: [
      "Exercise library with sport-specific filters",
      "10 pre-loaded daily workouts",
      "Member challenges & leaderboard",
      "Monthly Focus Plan access",
    ],
    cta: "Start Basic",
    subtitle: "The cost of a Netflix subscription — get in the ecosystem.",
  },
  {
    key: "foundation",
    icon: Star,
    highlight: true,
    features: [
      "Everything in Basic",
      "8-week periodized training block",
      "Program adapts over months — not random sweat sessions",
      "🖐️ Flag Coach Matt for personal feedback",
      "Full 'Fix It' rehab library",
      "Monthly program updates",
    ],
    cta: "Go Foundation",
    subtitle: "Your core program. Real structure. Real results.",
  },
  {
    key: "foundation",
    icon: Shield,
    label: "Youth Development",
    subtitle: "Same Foundation features — designed for families",
    features: [
      "Everything in Foundation — same price, same features",
      "🎁 Free postural assessment (video or live call)",
      "Parent account with child invite link",
      "Monitor your child's workouts & progress",
      "Flag Coach Matt on your child's behalf",
      "Age-appropriate programming from intake",
      "Parent trial auto-charges Foundation when it ends",
    ],
    cta: "Start Parent Trial",
  },
  {
    key: "custom",
    icon: Crown,
    features: [
      "Everything in Foundation",
      "Fully custom programming + AI builder",
      "1-on-1 video assessment ($50 value included)",
      "🎁 Gift a session to a friend",
      "Monthly program updates",
      "Full 'Fix It' rehab library",
      "Direct messaging support",
      "Priority Flag Coach Matt responses",
    ],
    cta: "Go Custom",
    subtitle: "Custom protocol from a 20-year vet for less than the session alone.",
  },
  {
    key: "team_elite",
    icon: Users,
    features: [
      "Everything in Custom",
      "Comprehensive on/off-season periodization",
      "Highest level of custom programming",
      "1-on-1 video session included",
      "🎁 Gift session included",
      "Bulk programming for full teams",
      "Multi-athlete management",
      "Seasonal periodization plans",
    ],
    cta: "Go Team/Elite",
    subtitle: "For serious athletes making a college roster.",
  },
];

const INITIAL_SHOW = 4;

const Pricing = () => {
  const { user, subscribed, subscriptionTier, subscriptionEnd } = useAuth();
  const { content: cms } = useContentMap("pricing_page");
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<TierKey | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({});
  const [modalTier, setModalTier] = useState<{ key: TierKey; label: string } | null>(null);

  const handleCheckout = async (tierKey: TierKey) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoadingTier(tierKey);
    try {
      const body: any = { priceId: TIERS[tierKey].price_id };
      if (promoCode.trim()) {
        body.promoCode = promoCode.trim();
      }
      // Include referral code from URL if present
      const referralCode = getStoredReferralCode();
      if (referralCode && !promoCode.trim()) {
        body.referralCode = referralCode;
      }
      // Custom/Team_Elite → schedule page for 1-on-1 assessment booking; others → dashboard
      if (tierKey === "custom" || tierKey === "team_elite") {
        body.successUrl = "/schedule?checkout=success";
      } else {
        body.successUrl = "/dashboard?checkout=success";
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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
      <SEOHead
        title="Pricing — Affordable Youth Strength Training"
        description="Online strength training from $12.99/mo. In-person sessions from $50. Custom programs from $20. 14-day free trial. No contracts."
        path="/pricing"
      />
      <AppNavbar />
      <div className="container pt-24 pb-16">
        {/* Value comparison banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/5 border border-primary/15 p-4 md:p-5 mb-8 max-w-3xl mx-auto"
        >
          <p className="text-xs text-muted-foreground leading-relaxed text-center">
            <span className="text-foreground font-bold">1-on-1 training without the 1-on-1 price.</span>{" "}
            {cms.value_banner || "In-gym personal training averages $40–$150/session. Online coaching packages run $100–$300/mo. Matt's subscriptions start at $15.99/mo — same 20 years of expertise, same personalized approach, for athletes of every age. No contracts, no middleman, available in any state."}
          </p>
        </motion.div>

        {/* Header */}
        <div className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-foreground mb-4"
          >
            {cms.page_heading || cms.page_title || "Your Coach. Your Corner. Any Age."}
          </motion.h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {cms.page_subtitle || "I train everyone — youth athletes, parents, adults, coaches. Every tier is month-to-month. Cancel anytime. No contracts. Just 20 years of proven strength programming delivered to your phone."}
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

        {/* Promo code input */}
        {!subscribed && (
          <div className="max-w-md mx-auto mb-8">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoApplied(false); }}
                  placeholder="PROMO CODE"
                  className="w-full bg-card border border-border pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none font-mono uppercase tracking-widest"
                />
              </div>
            </div>
            {promoCode.trim() && (
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                Code will be validated at checkout
              </p>
            )}
          </div>
        )}

        {/* Tier grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {TIER_CARDS.map((card, i) => {
            const tier = TIERS[card.key];
            const isCurrentPlan = subscriptionTier === card.key;
            const Icon = card.icon;
            // Override features from CMS if available (pipe-separated)
            const cmsFeatures = cms[`${card.key}_features`];
            const features = cmsFeatures ? cmsFeatures.split("|").map(f => f.trim()) : card.features;

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
                <h3 className="text-lg font-black uppercase tracking-tight text-foreground">
                  {card.label || tier.name}
                </h3>
                {card.subtitle && (
                  <p className="text-[10px] text-muted-foreground mb-1">{card.subtitle}</p>
                )}
                <div className="flex items-baseline gap-1 mt-1 mb-2">
                  <span className="text-3xl font-black text-foreground">{tier.price}</span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>
                <div className="flex items-center gap-1.5 mb-4 text-[10px] font-bold uppercase tracking-widest text-primary">
                  <Tag className="w-3 h-3" />
                  {TIER_DISCOUNTS[card.key]}% off all store purchases
                </div>

                <ul className="flex-1 space-y-2 mb-6">
                  {(() => {
                    const isExpanded = expandedTiers[card.key];
                    const visibleFeatures = isExpanded ? features : features.slice(0, INITIAL_SHOW);
                    const hasMore = features.length > INITIAL_SHOW;
                    return (
                      <>
                        {visibleFeatures.map((f, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                        {hasMore && (
                          <button
                            onClick={() => setExpandedTiers(prev => ({ ...prev, [card.key]: !prev[card.key] }))}
                            className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors mt-1"
                          >
                            {isExpanded ? (
                              <><ChevronUp className="w-3.5 h-3.5" /> Show Less</>
                            ) : (
                              <><ChevronDown className="w-3.5 h-3.5" /> +{features.length - INITIAL_SHOW} More</>
                            )}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </ul>

                {isCurrentPlan ? (
                  <button
                    onClick={handleManage}
                    className="w-full py-3 text-xs font-bold uppercase tracking-widest border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    Manage Plan
                  </button>
                ) : card.label === "Youth Development" ? (
                  <Link
                    to={user ? "/trial-welcome?path=parent" : "/auth?redirect=/trial-welcome?path=parent"}
                    className="w-full py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors border-2 border-foreground text-foreground hover:bg-foreground hover:text-background"
                  >
                    {card.cta} <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        if (!user) { navigate("/auth"); return; }
                        setModalTier({ key: card.key, label: card.label || tier.name });
                      }}
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
                    {card.highlight && !subscribed && (
                      <Link
                        to={user ? "/trial-welcome?path=pro" : "/auth?redirect=/trial-welcome?path=pro"}
                        className="w-full py-2 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 text-primary hover:underline"
                      >
                        Or try 14 days free <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Dynamic Feature Comparison Table */}
        <TierComparisonTable />

        {/* Trial CTA */}
        {!subscribed && (
          <div className="mt-12 max-w-2xl mx-auto">
            <TrialCTA variant="comparison" />
          </div>
        )}

        {/* Free member banner */}
        <div className="mt-8 text-center border-2 border-dashed border-border p-8 max-w-2xl mx-auto">
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">
            {cms.free_banner_title || "Free When You Sign Up"}
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            {cms.free_banner_text || "A complete 2-week starter program, monthly focus plans, member challenges, and workout logging — no credit card needed. See what real coaching looks like before you commit."}
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

        {/* Checkout confirmation modal */}
        <CheckoutConfirmationModal
          open={!!modalTier}
          onClose={() => setModalTier(null)}
          onConfirm={async () => {
            if (!modalTier) return;
            await handleCheckout(modalTier.key);
            setModalTier(null);
          }}
          loading={!!loadingTier}
          productName={modalTier ? (TIERS[modalTier.key].name + " Subscription") : ""}
          productPrice={modalTier ? (TIERS[modalTier.key].price + "/mo") : ""}
          productType={modalTier?.key as CheckoutProductType || "pro"}
        />
      </div>
    </div>
  );
};

const TIER_COLS = [
  { key: "tier_basic", label: "Basic" },
  { key: "tier_pro", label: "Pro" },
  { key: "tier_elite", label: "Elite" },
  { key: "tier_team", label: "Team" },
] as const;

const TierComparisonTable = () => {
  const { data: features = [], isLoading } = useQuery({
    queryKey: ["tier-features-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tier_features")
        .select("feature_label, description, tier_basic, tier_pro, tier_elite, tier_team")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  if (isLoading || features.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-16 max-w-5xl mx-auto"
    >
      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-foreground text-center mb-2">
        Compare Every Feature
      </h2>
      <p className="text-muted-foreground text-sm text-center mb-8">
        See exactly what's included in each plan — updated in real time.
      </p>

      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full border-collapse min-w-[540px]">
          <thead>
            <tr className="border-b-2 border-primary/30">
              <th className="text-left py-3 pr-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-[40%]">
                Feature
              </th>
              {TIER_COLS.map((col) => (
                <th
                  key={col.key}
                  className={`text-center py-3 px-2 text-[10px] font-bold uppercase tracking-widest ${
                    col.key === "tier_pro" ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((feature: any, i: number) => (
              <tr
                key={feature.feature_label}
                className={`border-b border-border/50 ${i % 2 === 0 ? "bg-card/30" : ""}`}
              >
                <td className="py-3 pr-4">
                  <span className="text-sm font-semibold text-foreground block">{feature.feature_label}</span>
                  {feature.description && (
                    <span className="text-[11px] text-muted-foreground leading-tight block mt-0.5">
                      {feature.description}
                    </span>
                  )}
                </td>
                {TIER_COLS.map((col) => (
                  <td key={col.key} className="text-center py-3 px-2">
                    {feature[col.key] ? (
                      <Check className="w-4 h-4 text-primary mx-auto" />
                    ) : (
                      <XIcon className="w-3.5 h-3.5 text-muted-foreground/30 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default Pricing;
