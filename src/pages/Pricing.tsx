import { useState } from "react";
import { motion } from "framer-motion";
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
      "Monthly Focus Plan — Matt's training focus changes monthly to build balanced gym skills",
      "85+ exercise library with sport-specific filters",
      "Filter by YOUR sport — find the best exercises for Golf, Volleyball, Football & more",
      "Member challenges & leaderboard",
    ],
    cta: "Start Basic",
  },
  {
    key: "pro",
    icon: Star,
    highlight: true,
    label: "Pro",
    features: [
      "Monthly Focus Plan — Matt's training focus changes monthly to build balanced gym skills",
      "85+ exercise library with sport-specific filters",
      "Filter by YOUR sport — find the best exercises for Golf, Volleyball, Football & more",
      "Member challenges & leaderboard",
      "Custom program from intake form",
      "🖐️ Flag Coach Matt — raise your hand and get personal coaching feedback on any exercise",
      "Optional postural video assessment",
      "Monthly program updates",
      "Full 'Fix It' rehab library",
    ],
    cta: "Go Pro",
  },
  {
    key: "pro",
    icon: Shield,
    label: "Youth Development",
    subtitle: "Same Pro features — designed for families",
    features: [
      "Everything in Pro — same price, same features",
      "Parent account with child invite link",
      "Monitor your child's workouts & progress",
      "Flag Coach Matt on your child's behalf",
      "Age-appropriate programming from intake",
      "Parent trial auto-charges Pro when it ends",
    ],
    cta: "Start Parent Trial",
  },
  {
    key: "elite",
    icon: Crown,
    features: [
      "Monthly Focus Plan — Matt's training focus changes monthly to build balanced gym skills",
      "85+ exercise library with sport-specific filters",
      "Filter by YOUR sport — find the best exercises for Golf, Volleyball, Football & more",
      "Member challenges & leaderboard",
      "Custom program from intake form",
      "🖐️ Flag Coach Matt — raise your hand and get personal coaching feedback on any exercise",
      "Optional postural video assessment",
      "Monthly program updates",
      "Full 'Fix It' rehab library",
      "1-on-1 monthly check-ins with Matt",
      "Priority postural assessments",
      "Direct messaging support",
      "Priority Flag Coach Matt responses",
    ],
    cta: "Go Elite",
  },
  {
    key: "team",
    icon: Users,
    features: [
      "Monthly Focus Plan — Matt's training focus changes monthly to build balanced gym skills",
      "85+ exercise library with sport-specific filters",
      "Filter by YOUR sport — find the best exercises for Golf, Volleyball, Football & more",
      "Member challenges & leaderboard",
      "Custom program from intake form",
      "🖐️ Flag Coach Matt — raise your hand and get personal coaching feedback on any exercise",
      "Optional postural video assessment",
      "Monthly program updates",
      "Full 'Fix It' rehab library",
      "1-on-1 monthly check-ins with Matt",
      "Priority postural assessments",
      "Direct messaging support",
      "Priority Flag Coach Matt responses",
      "Bulk programming for full teams",
      "Seasonal periodization plans",
      "Multi-athlete management",
    ],
    cta: "Get Team",
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
            {cms.free_banner_text || "Monthly Focus Plans, member challenges, and workout logging — no credit card."}
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
