import { useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import SEOHead from "@/components/layout/SEOHead";
import { Check, X as XIcon, Star, Zap, Shield, Crown, Users, ArrowRight, Loader2, Tag, ChevronDown, ChevronUp, Calendar, CalendarDays, Mail, MapPin, Phone, MessageSquare, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import AppNavbar from "@/components/layout/AppNavbar";
import { useAuth, TIERS, ANNUAL_TIERS, TierKey, TIER_DISCOUNTS } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useContentMap } from "@/hooks/useSiteContent";
import TrialCTA from "@/components/billing/TrialCTA";
import { useExerciseCount } from "@/hooks/useExerciseCount";
import { getStoredReferralCode, clearStoredReferralCode } from "@/hooks/useReferral";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
const DoNotPressButton = lazy(() => import("@/components/landing/DoNotPressButton"));
const AiGeneratorShowcase = lazy(() => import("@/components/landing/AiGeneratorShowcase"));
const ProveItShowcase = lazy(() => import("@/components/landing/ProveItShowcase"));

import CheckoutConfirmationModal, { type CheckoutProductType } from "@/components/billing/CheckoutConfirmationModal";

const TIER_CARDS: {
  key: TierKey;
  icon: typeof Star;
  features: string[];
  highlight?: boolean;
  cta: string;
  label?: string;
  subtitle?: string;
  headline?: string;
  pitch?: string;
  badge?: string;
}[] = [
  {
    key: "foundation",
    icon: Zap,
    headline: "20 Years of Iron Game Knowledge in Your Pocket.",
    pitch: `Stop guessing. Get the exact digital blueprint I use for my athletes. Full access to the M2 App, my private Exercise Library, the Fix It Rehab Library, and the AI Generator.`,
    features: [
      "Full M² App access",
      "Exercise video library",
      "Fix It rehab library",
      "AI Workout Generator",
      "Progress logging & tracking",
      "Monthly challenges & leaderboard",
    ],
    cta: "Start Foundation",
    subtitle: "The digital blueprint behind 20 years of coaching.",
  },
  {
    key: "pro",
    icon: Star,
    highlight: true,
    headline: "YouTube Can't Watch You Squat. I Can.",
    pitch: "An article can't tell you why your back hurts. I will. Complete an assessment, and I build your custom 4-week block. Send me two video form-checks every week. I critique your mechanics, fix weak points, and keep you safe.",
    features: [
      "Everything in Foundation",
      "Full movement assessment",
      "Custom 4-week training block",
      "2 weekly video form-checks",
      "Direct coach feedback on mechanics",
      "Program adjusted every cycle",
    ],
    cta: "Go Pro",
    subtitle: "Real coaching. Real feedback. Custom programming.",
    badge: "Custom Assessment Included",
  },
  {
    key: "elite",
    icon: Crown,
    headline: "Undivided Attention. Zero Guesswork.",
    pitch: "White-glove, concierge strength coaching. Full live video movement assessment. Highly bespoke weekly programming adjusted on the fly. Direct daily messaging with me for instant form analysis and accountability.",
    features: [
      "Everything in Pro",
      "Live video movement assessment",
      "Bespoke weekly programming",
      "Daily direct messaging with Matt",
      "Instant form analysis",
      "Priority scheduling for in-person",
    ],
    cta: "Go Elite",
    subtitle: "White-glove concierge coaching from Matt.",
  },
];

const INITIAL_SHOW = 4;

const FAQ_ITEMS = [
  {
    question: "Why should I pay for this when I can use a free AI app?",
    answer: "Anyone can ask an AI to write a fitness app. But an AI is an empty calculator. I built the M2 AI Generator myself, from scratch, and tested it a million times. I didn't feed it generic internet garbage — I fed it 20 years of my personal, in-the-trenches coaching experience. You aren't paying for code; you are paying for my brain, my safety protocols, and my guarantee of quality.",
  },
  {
    question: "How does the Pro ($149) tier work?",
    answer: "When you sign up, you'll fill out a detailed damage report (injury history) and upload a quick movement video. I personally review it, build your 4-week program to fix your specific weaknesses, and every week you send me videos of your heavy lifts so I can correct your form.",
  },
  {
    question: "Is there a contract?",
    answer: "No. Every tier is month-to-month. Cancel anytime.",
  },
];

const Pricing = () => {
  const exerciseCount = useExerciseCount();
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
      const referralCode = getStoredReferralCode();
      if (referralCode && !promoCode.trim()) {
        body.referralCode = referralCode;
      }
      if (tierKey === "pro" || tierKey === "elite") {
        body.successUrl = "/assessment?checkout=success";
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
        title="Pricing — Expert Strength Coaching Plans"
        description="Online strength coaching from $19.99/mo. Custom programming from $149.99/mo. Elite 1-on-1 from $349.99/mo. No contracts."
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
              <span className="text-primary">Online. Expert. Real Coaching.</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
              20 years of coaching delivered to your phone. The Foundation tier includes a
              <strong className="text-foreground"> 14-day free trial</strong> of the full M² App. All plans are month-to-month. Cancel anytime. No contracts.
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

        {/* In-Person Training Box */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border-2 border-primary/30 bg-card mb-8 max-w-3xl mx-auto overflow-hidden"
        >
          <div className="bg-primary/10 border-b border-primary/20 px-5 py-2.5 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              In-Person Training · Grosse Pointe Park, MI
            </span>
          </div>
          <div className="p-5 sm:p-6 space-y-3">
            <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground leading-tight">
              Train With Matt — In the Gym
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              One-on-one sessions and <strong className="text-foreground">small group training</strong> available
              at the studio. Youth athletes, adults, and post-rehab clients welcome. Same coach, same
              programming quality — face to face.
            </p>
            <ul className="space-y-1.5 pt-1">
              {["1-on-1 personal training sessions", "Small group training (2–4 athletes)", "Youth athlete development", "Post-rehab & return-to-sport"].map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2.5 pt-2">
              <Link
                to="/schedule"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
              >
                <Calendar className="w-3.5 h-3.5" />
                Schedule a Session
              </Link>
              <a
                href="mailto:matthew.michels4@gmail.com?subject=In-Person%20Training%20Inquiry"
                className="inline-flex items-center gap-2 border border-primary/40 text-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </a>
              <a
                href="tel:3138064952"
                className="inline-flex items-center gap-2 border border-primary/40 text-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
              >
                <Phone className="w-3.5 h-3.5" />
                Call
              </a>
              <a
                href="sms:3138064952"
                className="inline-flex items-center gap-2 border border-primary/40 text-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Text
              </a>
            </div>
          </div>
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

        {/* Tier grid — 3 main tiers + Team card */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
          {TIER_CARDS.map((card, i) => {
            const tier = TIERS[card.key];
            const annual = ANNUAL_TIERS[card.key];
            const isCurrentPlan = subscriptionTier === card.key;
            const Icon = card.icon;
            const cmsFeatures = cms[`${card.key}_features`];
            const rawFeatures = cmsFeatures ? cmsFeatures.split("|").map((f: string) => f.trim()) : card.features;
            const features = card.key === "foundation"
              ? rawFeatures.map((f: string) => f === "Exercise video library" ? `${exerciseCount}+ exercise video library` : f)
              : rawFeatures;

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
                {card.headline && (
                  <p className="text-xs font-bold text-foreground mt-1 leading-snug">{card.headline}</p>
                )}
                {card.pitch && (
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                    {card.key === "foundation" ? card.pitch.replace("Exercise Library", `${exerciseCount}+ Exercise Library`) : card.pitch}
                  </p>
                )}
                <div className="flex items-baseline gap-1 mt-2 mb-1.5">
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
                        {visibleFeatures.map((f: string, j: number) => (
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
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Team Card — static, no Stripe */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative flex flex-col border-2 border-border bg-card p-5"
          >
            <Users className="w-7 h-7 text-primary mb-2" />
            <h3 className="text-base font-black uppercase tracking-tight text-foreground">
              Team & Organization
            </h3>
            <p className="text-xs font-bold text-foreground mt-1 leading-snug">
              Team & Organization Programming
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              Built for high school programs and travel teams. Injury prevention, off-season strength, and in-season maintenance for your whole roster.
            </p>
            <div className="flex items-baseline gap-1 mt-2 mb-1.5">
              <span className="text-2xl font-black text-foreground">Custom</span>
              <span className="text-muted-foreground text-xs">Bid</span>
            </div>

            <ul className="flex-1 space-y-1.5 mb-4">
              {[
                "Full-season team programming",
                "Roster management & bulk assignment",
                "Injury prevention protocols",
                "In-season maintenance plans",
              ].map((f, j) => (
                <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="mailto:matthewmichels4@gmail.com?subject=Team%20Programming%20Inquiry"
              className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest border-2 border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors flex items-center justify-center gap-2"
            >
              <Mail className="w-3.5 h-3.5" />
              Contact Coach Matt
            </a>
          </motion.div>
        </div>

        {/* AI Generator Showcase */}
        <div className="mt-12 max-w-3xl mx-auto">
          <Suspense fallback={null}>
            <AiGeneratorShowcase />
          </Suspense>
        </div>

        <div className="mt-8 max-w-3xl mx-auto">
          <Suspense fallback={null}>
            <ProveItShowcase />
          </Suspense>
        </div>

        {/* Dynamic Feature Comparison Table */}
        <TierComparisonTable />

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-16 max-w-2xl mx-auto"
        >
          <h2 className="text-lg font-black uppercase tracking-tight text-foreground text-center mb-1">
            Frequently Asked Questions
          </h2>
          <p className="text-[11px] text-muted-foreground text-center mb-6">
            Straight answers. No sales pitch.
          </p>

          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-sm text-left font-bold text-foreground">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

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
  { key: "tier_basic", label: "Foundation", price: "$19.99" },
  { key: "tier_foundation", label: "Pro", price: "$149.99" },
  { key: "tier_custom", label: "Elite", price: "$349.99" },
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
        <div className="grid grid-cols-[1fr_repeat(3,56px)] sm:grid-cols-[1fr_repeat(3,72px)] items-end border-b-2 border-primary/30 px-3 py-2.5 bg-background/50">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Feature</span>
          {TIER_COLS.map((col) => (
            <div key={col.key} className="text-center">
              <span className={`text-[9px] font-bold uppercase tracking-widest block ${col.key === "tier_foundation" ? "text-primary" : "text-muted-foreground"}`}>
                {col.label}
              </span>
            </div>
          ))}
        </div>

        {/* Feature rows */}
        {features.map((feature: any, i: number) => (
          <div
            key={feature.feature_label}
            className={`grid grid-cols-[1fr_repeat(3,56px)] sm:grid-cols-[1fr_repeat(3,72px)] items-center px-3 py-2 ${
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
