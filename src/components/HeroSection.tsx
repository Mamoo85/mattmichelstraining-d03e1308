import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Star, Shield, Trophy, Clock } from "lucide-react";

import m2Logo from "@/assets/m2-logo.jpg";
import { useSectionVisible } from "@/hooks/useSiteContent";
import AudienceSelector from "./landing/AudienceSelector";

// Lazy-load below-the-fold landing sections
const ForParentsCTA = lazy(() => import("./landing/ForParentsCTA"));
const M2Difference = lazy(() => import("./landing/M2Difference"));
const FindUs = lazy(() => import("./landing/FindUs"));
const PortalEntrance = lazy(() => import("./landing/PortalEntrance"));
const TechShowcaseCard = lazy(() => import("./landing/TechShowcaseCard"));
const EmailCapture = lazy(() => import("./landing/EmailCapture"));
const MonthlyFocus = lazy(() => import("./landing/MonthlyFocus"));
const SportPicker = lazy(() => import("./landing/SportPicker"));
const FreeWorkoutTeaser = lazy(() => import("./landing/FreeWorkoutTeaser"));
const AthleteResults = lazy(() => import("./landing/AthleteResults"));

const STATS = [
  { icon: Clock, value: "20+", label: "Years Coaching" },
  { icon: Trophy, value: "50+", label: "College Athletes" },
  { icon: Shield, value: "Zero", label: "Injuries" },
];

const HeroSection = () => {
  const showHero = useSectionVisible("hero");
  const showFindUs = useSectionVisible("find_us");

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--muted-foreground)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--muted-foreground)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container relative z-10 pt-20 pb-12">
        {/* ─── 1. HERO — Identity & Proof ─── */}
        {showHero && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="py-8 md:py-16"
          >
            <div className="flex flex-col items-center text-center mb-6">
              <img
                src={m2Logo}
                alt="M² Training"
                width={224}
                height={224}
                className="w-36 h-36 md:w-48 md:h-48 lg:w-56 lg:h-56 object-contain mb-4"
              />

              {/* ── Impact Stats Bar ── */}
              <div className="flex items-center justify-center gap-4 sm:gap-8 mb-5">
                {STATS.map((s) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    className="flex flex-col items-center"
                  >
                    <s.icon size={14} className="text-primary mb-1" />
                    <span className="text-lg sm:text-xl font-black text-primary font-mono leading-none">{s.value}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{s.label}</span>
                  </motion.div>
                ))}
              </div>

              <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold tracking-display text-foreground leading-snug mb-3">
                Real strength. Zero gimmicks.
                <br />
                <span className="text-primary">Real coaching. Real results.</span>
              </h1>
              <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
                In-person training in Grosse Pointe. Online programs anywhere.
                Ages 12 to 60+. The same coach either way.
              </p>
            </div>

            {/* Quick-action CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 w-full sm:w-auto justify-center"
              >
                Start Training
                <ArrowRight size={14} />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 border-2 border-primary text-primary px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2 w-full sm:w-auto justify-center"
              >
                Meet Matt
              </Link>
            </div>

            {/* Audience Router */}
            <AudienceSelector />
          </motion.div>
        )}

        {/* Below-the-fold lazy sections */}
        <Suspense fallback={null}>
          {/* ─── 2. SPORT PICKER ─── */}
          <SportPicker />

          {/* ─── 4. TECH SHOWCASE ─── */}
          <TechShowcaseCard />

          {/* ─── 5. FREE WORKOUT TEASER ─── */}
          <FreeWorkoutTeaser />

          {/* ─── 6. FOR PARENTS ─── */}
          <ForParentsCTA />

          {/* ─── 7. MEMBER PORTAL ─── */}
          <PortalEntrance />

          {/* ─── 8. MONTHLY FOCUS ─── */}
          <div className="mb-8">
            <MonthlyFocus />
          </div>

          {/* ─── 9. THE M² DIFFERENCE ─── */}
          <M2Difference />

          {/* ─── 10. MEMBERSHIP CTA ─── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="bg-gradient-to-br from-primary/10 via-background to-background border border-primary/30 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-primary" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">
                    Monthly Plans
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-foreground leading-tight">
                  Train Like a Pro.<br />
                  <span className="text-primary">Starting at $14.99/mo.</span>
                </h2>
                <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                  Access the full exercise library, structured programs, injury recovery guides,
                  and direct coaching from Matt — all from your phone. Every plan includes a
                  <strong className="text-foreground"> 14-day free trial</strong>. No contracts. Cancel anytime.
                </p>
                <Link
                  to="/auth?redirect=/trial-welcome"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
                >
                  Try 14 Days Free <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </motion.div>

          {/* ─── 11. ATHLETE RESULTS ─── */}
          <AthleteResults />

          {/* ─── 12. EMAIL CAPTURE ─── */}
          <EmailCapture />

          {/* ─── 12. FIND US ─── */}
          {showFindUs && <div className="mb-8"><FindUs /></div>}
        </Suspense>

        {/* FOOTER */}
        <div className="mt-10 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} <span className="font-brand text-sm text-foreground">M² Training</span> · Grosse Pointe Park, MI · Strength done right since 2004.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
