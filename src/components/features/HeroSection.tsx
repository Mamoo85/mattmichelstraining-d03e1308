import { lazy, Suspense, useState, useEffect } from "react";
import WheelSlogan from "@/components/features/WheelSlogan";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, Trophy, Clock } from "lucide-react";

import m2Logo from "@/assets/m2-logo.jpg";
import { useSectionVisible } from "@/hooks/useSiteContent";

const AudienceSelector = lazy(() => import("@/components/landing/AudienceSelector"));

// Lazy-load below-the-fold landing sections
const FindUs = lazy(() => import("@/components/landing/FindUs"));
const PortalEntrance = lazy(() => import("@/components/landing/PortalEntrance"));
const EmailCapture = lazy(() => import("@/components/landing/EmailCapture"));
const MonthlyFocus = lazy(() => import("@/components/landing/MonthlyFocus"));
const SportPicker = lazy(() => import("@/components/landing/SportPicker"));
const M2Difference = lazy(() => import("@/components/landing/M2Difference"));

const STATS = [
  { icon: Clock, value: "20+", label: "Years Coaching" },
  { icon: Trophy, value: "50+", label: "College Athletes" },
  { icon: Shield, value: "100%", label: "Durability" },
];

const HeroSection = () => {
  const showHero = useSectionVisible("hero");
  const showFindUs = useSectionVisible("find_us");

  // Defer below-fold sections until after first paint to improve FCP
  const [showBelow, setShowBelow] = useState(false);
  useEffect(() => {
    const id = requestIdleCallback?.(() => setShowBelow(true)) ??
      setTimeout(() => setShowBelow(true), 100);
    return () => {
      if (typeof id === "number" && "cancelIdleCallback" in window) cancelIdleCallback(id);
      else clearTimeout(id as ReturnType<typeof setTimeout>);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Full-bleed dark gradient hero background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-card/60" />

      <div className="container relative z-10 pt-20 pb-12">
        {/* ─── 1. HERO — Identity & Proof ─── */}
        {showHero && (
          <div className="py-8 md:py-16 animate-fadeIn">
            {/* Hero card — full-bleed feel */}
            <div className="relative rounded-lg overflow-hidden bg-card/50 ring-1 ring-white/5 p-6 md:p-10 mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
              <div className="relative flex flex-col items-center text-center">
                <img
                  src={m2Logo}
                  alt="M² Training"
                  width={256}
                  height={256}
                  fetchPriority="high"
                  decoding="sync"
                  className="w-28 md:w-40 lg:w-48 h-auto object-contain mb-5"
                  style={{ mixBlendMode: "lighten", aspectRatio: "1/1" }}
                />

                <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold tracking-display text-foreground leading-snug mb-2">
                  Real strength. Zero gimmicks.
                </h1>
                <div className="text-xl md:text-3xl lg:text-4xl font-bold tracking-display mb-4">
                  <WheelSlogan />
                </div>
                <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed mb-6">
                  In-person training in Grosse Pointe. Online programs anywhere.
                  Ages 12 to 60+. The same coach either way.
                </p>

                {/* Stats bar — overlaid at bottom of hero card */}
                <div className="flex items-center justify-center gap-6 sm:gap-10">
                  {STATS.map((s) => (
                    <div key={s.label} className="flex flex-col items-center">
                      <s.icon size={14} className="text-primary mb-1" />
                      <span className="text-lg sm:text-xl font-black text-primary font-mono leading-none">{s.value}</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Single CTA row */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <Link
                to="/schedule"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest rounded-lg hover:opacity-90 transition-m2 w-full sm:w-auto justify-center"
              >
                Start Training
                <ArrowRight size={14} />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 border-2 border-primary text-primary px-6 py-3.5 text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-primary/10 hover:shadow-[0_0_20px_rgba(249,115,22,0.35)] transition-all duration-300 w-full sm:w-auto justify-center"
              >
                Enter The Portal
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* Audience Router */}
            {showBelow && (
              <Suspense fallback={null}>
                <AudienceSelector />
              </Suspense>
            )}
          </div>
        )}

        {/* Below-the-fold lazy sections */}
        {showBelow && (
          <Suspense fallback={null}>
            <SportPicker />
            <PortalEntrance />
            <div className="mb-8">
              <MonthlyFocus />
            </div>
            <M2Difference />
            <EmailCapture />
            {showFindUs && <div className="mb-8"><FindUs /></div>}
          </Suspense>
        )}

        {/* FOOTER */}
        <div className="mt-10 pt-6 border-t border-border text-center pb-16 md:pb-0">
          <p className="text-xs text-muted-foreground break-words">
            © {new Date().getFullYear()} <span className="font-brand text-sm text-foreground">M²&nbsp;Training</span> · Grosse Pointe Park, MI · Strength done right since 2004.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
