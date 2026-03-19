import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import m2Logo from "@/assets/m2-logo.jpg";
import { useSectionVisible } from "@/hooks/useSiteContent";
import AudienceSelector from "./landing/AudienceSelector";
import ForParentsCTA from "./landing/ForParentsCTA";
import InstagramSocialBox from "./landing/InstagramSocialBox";
import M2Difference from "./landing/M2Difference";
import FindUs from "./landing/FindUs";
import PortalEntrance from "./landing/PortalEntrance";

import TrialCTA from "./TrialCTA";

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
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold tracking-display text-foreground leading-snug mb-3">
                Real strength. Zero gimmicks.
                <br />
                <span className="text-primary">Real coaching. Real results.</span>
              </h1>
              <p className="text-sm md:text-base text-foreground-soft max-w-xl mx-auto leading-relaxed">
                In-person training in Grosse Pointe. Online programs anywhere.
                Ages 12 to 60+. The same coach either way.
              </p>
            </div>

            {/* Quick-action CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <Link
                to="/shop"
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
              <Link
                to="/schedule"
                className="inline-flex items-center gap-2 border-2 border-border text-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:border-primary/40 hover:text-primary transition-m2 w-full sm:w-auto justify-center"
              >
                Schedule
              </Link>
            </div>

            {/* Audience Router */}
            <AudienceSelector />
          </motion.div>
        )}

        {/* ─── 3. FOR PARENTS — Injury Prevention Hook ─── */}
        <ForParentsCTA />

        {/* ─── 4. MEMBER PORTAL (sneak peek) ─── */}
        <PortalEntrance />

        {/* ─── 5. THE M² DIFFERENCE ─── */}
        <M2Difference />

        {/* ─── 6. TRIAL CTA ─── */}
        <div className="mb-8">
          <TrialCTA variant="banner" />
        </div>

        {/* ─── 7. SOCIAL — Instagram Feed ─── */}
        <div className="mb-8">
          <InstagramSocialBox />
        </div>

        {/* ─── 8. FIND US — always last ─── */}
        {showFindUs && <div className="mb-8"><FindUs /></div>}

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
