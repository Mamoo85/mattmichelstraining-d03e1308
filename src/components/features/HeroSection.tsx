import { lazy, Suspense, useState } from "react";
import WheelSlogan from "@/components/features/WheelSlogan";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, Trophy, Clock, MapPin, Star, Quote } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

import m2Logo from "@/assets/m2-logo-official.png";
import { useSectionVisible } from "@/hooks/useSiteContent";

const AudienceSelector = lazy(() => import("@/components/landing/AudienceSelector"));

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

const SPECIALTIES = [
  "💪 Strength Training",
  "🏈 Youth Sports Performance",
  "📱 Online Coaching",
];

const HERO_TESTIMONIALS = [
  {
    quote: "Matt actually watches my videos, replies the same day, and adjusts my program. It's not even close to other online coaches.",
    name: "Jake R.",
    role: "College Football Athlete",
  },
  {
    quote: "She used to get hurt every season. Two months with Matt's youth program and she's faster, stronger, and hasn't missed a game.",
    name: "Lisa K.",
    role: "Parent · Soccer",
  },
];

const HeroSection = () => {
  const showHero = useSectionVisible("hero");
  const showFindUs = useSectionVisible("find_us");
  const isMobile = useIsMobile();
  const [showBelow, setShowBelow] = useState(true);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle radial glow behind hero */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-card/60" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-30 blur-[100px]" style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.15), transparent 70%)" }} />

      <div className="container relative z-10 pt-20 pb-12">
        {showHero && (
          <div className="py-8 md:py-16 animate-fadeIn">
            {/* Glassmorphism hero card */}
            <div className="relative rounded-2xl overflow-hidden bg-card/40 backdrop-blur-xl border border-white/[0.06] shadow-[0_8px_48px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] p-6 md:p-10 mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
              <div className="relative flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <div className="absolute inset-0 rounded-full blur-2xl bg-primary/20 scale-110" />
                  <img
                    src={m2Logo}
                    alt="M2 Performance Training"
                    width={256}
                    height={256}
                    fetchPriority="high"
                    decoding="sync"
                    className="relative w-28 md:w-40 lg:w-48 h-auto object-contain drop-shadow-lg shadow-[0_0_40px_rgba(232,98,26,0.25)]"
                  />
                </div>

                {/* Specialty chips */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                  {SPECIALTIES.map((s) => (
                    <span
                      key={s}
                      className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full bg-card/60 backdrop-blur-sm border border-border/50 text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <h1 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.1] mb-2">
                  Real strength.{" "}
                  <span className="text-primary drop-shadow-[0_0_24px_rgba(232,98,26,0.5)]">Zero gimmicks.</span>
                </h1>
                <div className="text-xl md:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
                  <WheelSlogan />
                </div>
                <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed mb-6">
                  In-person training in Grosse Pointe. Online programs anywhere.
                  Ages 12 to 60+. The same coach either way.
                </p>

                {/* Stats bar */}
                <div className="flex items-center justify-center gap-6 sm:gap-10 mb-6">
                  {STATS.map((s) => (
                    <div key={s.label} className="flex flex-col items-center">
                      <s.icon size={14} className="text-primary mb-1" />
                      <span className="text-lg sm:text-xl font-black text-primary font-mono leading-none">{s.value}</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Local trust section */}
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground text-xs mb-2">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-primary" />
                    <span className="font-bold text-foreground">Grosse Pointe Park, MI</span>
                  </div>
                  <span className="text-[10px]">Serving Grosse Pointe, Harper Woods, St. Clair Shores &amp; East Side Detroit</span>
                  <div className="flex items-center gap-1">
                    <Star size={11} className="text-primary fill-primary" />
                    <span className="font-bold text-foreground text-[11px]">Rated 5.0 on Google</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Social proof — inline testimonials above CTA */}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-2xl mx-auto mb-5">
              {HERO_TESTIMONIALS.map((t) => (
                <div key={t.name} className="flex-1 bg-card/50 backdrop-blur-sm border border-border/50 border-l-2 border-l-primary rounded-xl p-4 text-left shadow-[0_2px_16px_rgba(0,0,0,0.2)]">
                  <Quote size={14} className="text-primary/50 mb-1.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed italic mb-2">"{t.quote}"</p>
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={9} className="text-primary fill-primary" />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-foreground block">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground">{t.role}</span>
                </div>
              ))}
            </div>

            {/* $4.99 promo — primary CTA above the fold */}
            <div className="w-full max-w-sm mx-auto mb-4">
              <Link
                to="/auth?redirect=/trial-welcome"
                className="flex flex-col items-center gap-1 bg-primary text-primary-foreground px-6 py-4 rounded-xl hover:opacity-90 transition-all w-full shadow-[0_0_24px_rgba(249,115,22,0.4)]"
              >
                <span className="text-base font-black uppercase tracking-widest">Start for $4.99 →</span>
                <span className="text-[10px] font-medium opacity-80">then $19.99/mo · Cancel anytime · No contracts</span>
              </Link>
            </div>

            {/* CTA row — secondary actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <Link
                to="/schedule"
                className="inline-flex items-center gap-2 border-2 border-primary text-primary px-6 py-3.5 text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-primary/10 transition-all duration-300 w-full sm:w-auto justify-center"
              >
                {isMobile ? "Schedule In-Person Session" : "Schedule Here"}
                <ArrowRight size={14} />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 border-2 border-border text-muted-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest rounded-lg hover:border-primary hover:text-primary transition-all duration-300 w-full sm:w-auto justify-center"
              >
                Meet Matt
                <ArrowRight size={14} />
              </Link>
            </div>

            {showBelow && (
              <Suspense fallback={null}>
                <AudienceSelector />
              </Suspense>
            )}
          </div>
        )}

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

        <div className="mt-10 pt-6 border-t border-border text-center pb-16 md:pb-0">
          <p className="text-xs text-muted-foreground break-words">
            © {new Date().getFullYear()} <span className="font-brand text-sm text-foreground">M2&nbsp;Training</span> · Grosse Pointe Park, MI · Strength done right since 2004.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
