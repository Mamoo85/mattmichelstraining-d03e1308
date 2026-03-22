import { useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import SEOHead from "@/components/layout/SEOHead";
import { Check, X as XIcon, Star, Zap, Shield, Crown, Users, ArrowRight, Loader2, Tag, ChevronDown, ChevronUp, Calendar, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import AppNavbar from "@/components/layout/AppNavbar";
import { useAuth, TIERS, ANNUAL_TIERS, TierKey, TIER_DISCOUNTS } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useContentMap } from "@/hooks/useSiteContent";
import TrialCTA from "@/components/billing/TrialCTA";
import { getStoredReferralCode, clearStoredReferralCode } from "@/hooks/useReferral";
const DoNotPressButton = lazy(() => import("@/components/landing/DoNotPressButton"));

import CheckoutConfirmationModal, { type CheckoutProductType } from "@/components/billing/CheckoutConfirmationModal";

const TIER_CARDS: {
  key: TierKey;
  icon: typeof Star;
  features: string[];
  highlight?: boolean;
  cta: string;
  label?: string;
  subtitle?: string;
  badge?: string;
}[] = [
  {
    key: "basic",
    icon: Zap,
    features: [
      "200+ exercise video library",
      "10 daily workouts",
      "Monthly challenges & leaderboard",
      "Progress logging & tracking",
    ],
    cta: "Start Basic",
    subtitle: "Train on your own terms with a real library.",
  },
  {
    key: "foundation",
    icon: Star,
    features: [
      "8-week periodized training blocks",
      "Fix It injury recovery library",
      "Flag exercises for coach feedback",
      "Real programming, not random workouts",
    ],
    cta: "Go Foundation",
    subtitle: "Structured training that updates every cycle.",
  },
  {
    key: "custom",
    icon: Crown,
    highlight: true,
    features: [
      "Free online assessment",
      "Custom program built by Matt",
      "20% off every in-person session — Matt teaches you your workout",
      "Direct message Coach Matt",
    ],
    cta: "Go Custom",
    subtitle: "Your own program from a 20-year coaching vet. Private sessions extra.",
    badge: "Free Assessment · 20% Off In-Person",
  },
  {
    key: "team_elite",
    icon: Users,
    features: [
      "Full-season team programming",
      "Roster management & bulk assignment",
      "Optional 30-min video chat monthly",
      "Built for coaches and competitive teams",
    ],
    cta: "Go Team/Elite",
    subtitle: "Train a team or manage multiple athletes under one plan.",
  },
];

const INITIAL_SHOW = 4;

const Pricing = () => {
  const { user, subscribed, subscriptionTier, subscriptionEnd } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { content: cms } = useContentMap("pricing_page");
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<TierKey | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({});
  const [modalTier, setModalTier] = useState<{ key: TierKey; label: string } | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const handleCheckout = async (tierKey: TierKey) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoadingTier(tierKey);
    try {
      const body: any = { priceId: billingCycle === "annual" ? ANNUAL_TIERS[tierKey].price_id : TIERS[tierKey].price_id };
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
        description="Online strength training from $12.99/mo. Custom 8-week programs from $49.99/mo. 14-day free trial. No contracts."
        path="/pricing"
      />
      <AppNavbar />
      <div className="container pt-24 pb-16">
        {/* ═══════════ Online Training Hero ═══════════ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background mb-8 max-w-3xl mx-auto"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/8 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          <div className="relative p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary bg-primary/10 border border-primary/20 px-2.5 py-1">
                100% Online · Any State
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground leading-tight">
              Train With Matt.<br />
              <span className="text-primary">Online. Affordable. Real Coaching.</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
              20 years of coaching delivered to your phone. Every plan is month-to-month with a
              <strong className="text-foreground"> 14-day free trial</strong>. Cancel anytime. Custom members
              can come train in person at 20% off — or do it all online. Totally up to you.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                to="/auth?redirect=/trial-welcome"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
              >
                Start 14-Day Free Trial
              </Link>
              <a
                href="mailto:matthewmichels4@gmail.com?subject=Training%20Inquiry"
                className="inline-flex items-center gap-2 border-2 border-primary/40 text-primary px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
              >
                Email Matt
              </a>
            </div>
          </div>
        </motion.div>

        {/* Value comparison banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-primary/5 border border-primary/15 p-4 md:p-5 mb-8 max-w-3xl mx-auto"
        >
          <p className="text-xs text-muted-foreground leading-relaxed text-center">
            <span className="text-foreground font-bold">Real coaching without the premium price tag.</span>{" "}
            {cms.value_banner || "Online coaching packages run $100–$300/mo. Matt's subscriptions start at $12.99/mo — same 20 years of expertise, same personalized approach, for athletes of every age. No contracts, no middleman, available in any state."}
          </p>
        </motion.div>

        {/* Header */}
        <div className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-foreground mb-4"
          >
            {cms.page_heading || cms.page_title || "Your Coach. Your Corner. Any Age."}
          </motion.h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {cms.page_subtitle || "I train everyone — youth athletes, parents, adults, coaches. Every tier is month-to-month. Cancel anytime. No contracts. Just 20 years of proven strength programming delivered to your phone."}
          </p>

          {(subscribed || isAdmin) && (
            <div className="mt-6 inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-sm text-sm font-bold uppercase tracking-widest">
              <Shield className="w-4 h-4" />
              You're on {isAdmin ? "M² Coach" : subscriptionTier ? TIERS[subscriptionTier].name : "Free"}
              {subscriptionEnd && (
                <span className="text-muted-foreground font-normal normal-case ml-2">
                  · renews {new Date(subscriptionEnd).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Trial CTA — top position */}
        {!subscribed && (
          <div className="mb-8 max-w-2xl mx-auto">
            <TrialCTA variant="comparison" />
          </div>
        )}

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

        {/* Billing cycle toggle */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
              billingCycle === "monthly"
                ? "bg-foreground text-background"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("annual")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
              billingCycle === "annual"
                ? "bg-foreground text-background"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays size={14} className="shrink-0" />
            Annual
            <span className="text-[8px] bg-primary text-primary-foreground px-1.5 py-0.5 font-bold whitespace-nowrap">
              Save 17%
            </span>
          </button>
        </div>

        {/* Tier grid — 4 columns on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
          {TIER_CARDS.map((card, i) => {
            const tier = TIERS[card.key];
            const annual = ANNUAL_TIERS[card.key];
            const isCurrentPlan = subscriptionTier === card.key;
            const Icon = card.icon;
            const cmsFeatures = cms[`${card.key}_features`];
            const features = cmsFeatures ? cmsFeatures.split("|").map(f => f.trim()) : card.features;

            return (
              <motion.div
                key={`${card.key}-${i}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative flex flex-col border-2 p-5 ${
                  card.highlight
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
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

                <Icon className="w-7 h-7 text-primary mb-2" />
                <h3 className="text-base font-black uppercase tracking-tight text-foreground">
                  {card.label || tier.name}
                </h3>
                {card.subtitle && (
                  <p className="text-[10px] text-muted-foreground mb-1 leading-tight">{card.subtitle}</p>
                )}
                <div className="flex items-baseline gap-1 mt-1 mb-1.5">
                  {billingCycle === "annual" ? (
                    <>
                      <span className="text-2xl font-black text-foreground">{annual.monthlyEquiv}</span>
                      <span className="text-muted-foreground text-xs">/mo</span>
                      <span className="text-[10px] text-muted-foreground line-through ml-1">{tier.price}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-black text-foreground">{tier.price}</span>
                      <span className="text-muted-foreground text-xs">/mo</span>
                    </>
                  )}
                </div>
                {billingCycle === "annual" && (
                  <p className="text-[10px] text-primary font-bold mb-1">
                    {annual.price}/yr · 2 months free
                  </p>
                )}
                <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                  <Tag className="w-3 h-3" />
                  {TIER_DISCOUNTS[card.key]}% off store
                </div>

                {/* Assessment badge for Custom & Team */}
                {card.badge && (
                  <div className="bg-primary/10 border border-primary/20 px-2.5 py-1.5 mb-3 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-[10px] font-bold text-primary leading-tight">{card.badge}</span>
                  </div>
                )}

                <ul className="flex-1 space-y-1.5 mb-4">
                  {(() => {
                    const isExpanded = expandedTiers[`${card.key}-${i}`];
                    const visibleFeatures = isExpanded ? features : features.slice(0, INITIAL_SHOW);
                    const hasMore = features.length > INITIAL_SHOW;
                    return (
                      <>
                        {visibleFeatures.map((f, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                        {hasMore && (
                          <button
                            onClick={() => setExpandedTiers(prev => ({ ...prev, [`${card.key}-${i}`]: !prev[`${card.key}-${i}`] }))}
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors mt-1"
                          >
                            {isExpanded ? (
                              <><ChevronUp className="w-3 h-3" /> Less</>
                            ) : (
                              <><ChevronDown className="w-3 h-3" /> +{features.length - INITIAL_SHOW} More</>
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
                    className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    Manage Plan
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        if (!user) { navigate("/auth"); return; }
                        setModalTier({ key: card.key, label: card.label || tier.name });
                      }}
                      disabled={loadingTier === card.key}
                      className={`w-full py-2.5 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${
                        card.highlight
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border-2 border-foreground text-foreground hover:bg-foreground hover:text-background"
                      }`}
                    >
                      {loadingTier === card.key ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {card.cta} <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                    {card.key === "foundation" && !subscribed && (
                      <Link
                        to={user ? "/trial-welcome?path=foundation" : "/auth?redirect=/trial-welcome?path=foundation"}
                        className="w-full py-1.5 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 text-primary hover:underline"
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

        {/* Family Pack callout — sits below the 4-column grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 max-w-7xl mx-auto bg-card border-2 border-primary/30 p-6 flex flex-col md:flex-row items-start md:items-center gap-4"
        >
          <Shield className="w-8 h-8 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black uppercase tracking-tight text-foreground mb-1">
              🎁 Family Pack — Free With Custom Membership
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every Custom membership includes a <strong className="text-foreground">free child membership</strong>. Your athlete gets their own account with age-appropriate programming and full progress monitoring — all under your plan. <strong className="text-foreground">Private sessions extra. 14-day free trial available.</strong>
            </p>
          </div>
          <Link
            to={user ? "/trial-welcome?path=parent" : "/auth?redirect=/trial-welcome?path=parent"}
            className="shrink-0 bg-primary text-primary-foreground px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-colors flex items-center gap-2"
          >
            Start Custom Trial <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>

        {/* Dynamic Feature Comparison Table */}
        <TierComparisonTable />





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
          productName={modalTier ? (TIERS[modalTier.key].name + (billingCycle === "annual" ? " Annual" : "") + " Subscription") : ""}
          productPrice={modalTier ? (billingCycle === "annual" ? ANNUAL_TIERS[modalTier.key].price + "/yr" : TIERS[modalTier.key].price + "/mo") : ""}
          productType={modalTier?.key as CheckoutProductType || "foundation"}
        />
        <Suspense fallback={null}><DoNotPressButton /></Suspense>
      </div>
    </div>
  );
};

const TIER_COLS = [
  { key: "tier_basic", label: "Basic", price: "$12.99" },
  { key: "tier_foundation", label: "Foundation", price: "$19.99" },
  { key: "tier_custom", label: "Custom", price: "$49.99" },
  { key: "tier_team_elite", label: "Team", price: "$99.99" },
] as const;

const TierComparisonTable = () => {
  const { data: features = [], isLoading } = useQuery({
    queryKey: ["tier-features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tier_features")
        .select("feature_label, description, tier_basic, tier_foundation, tier_custom, tier_team_elite")
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
      className="mt-12 max-w-3xl mx-auto"
    >
      <h2 className="text-lg font-black uppercase tracking-tight text-foreground text-center mb-1">
        What You Get
      </h2>
      <p className="text-[11px] text-muted-foreground text-center mb-4">
        Every plan includes a 14-day free trial. Upgrade anytime.
      </p>

      <div className="border border-border bg-card overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_repeat(4,48px)] sm:grid-cols-[1fr_repeat(4,64px)] items-end border-b-2 border-primary/30 px-3 py-2.5 bg-background/50">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Feature</span>
          {TIER_COLS.map((col) => (
            <div key={col.key} className="text-center">
              <span className={`text-[9px] font-bold uppercase tracking-widest block ${col.key === "tier_custom" ? "text-primary" : "text-muted-foreground"}`}>
                {col.label}
              </span>
            </div>
          ))}
        </div>

        {/* Feature rows */}
        {features.map((feature: any, i: number) => (
          <div
            key={feature.feature_label}
            className={`grid grid-cols-[1fr_repeat(4,48px)] sm:grid-cols-[1fr_repeat(4,64px)] items-center px-3 py-2 ${
              i % 2 === 0 ? "bg-card" : "bg-background/30"
            } ${i < features.length - 1 ? "border-b border-border/40" : ""}`}
          >
            <span className="text-xs font-semibold text-foreground pr-2 truncate">{feature.feature_label}</span>
            {TIER_COLS.map((col) => (
              <div key={col.key} className="flex justify-center">
                {feature[col.key] ? (
                  <Check className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <XIcon className="w-3 h-3 text-muted-foreground/20" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
};
export default Pricing;
