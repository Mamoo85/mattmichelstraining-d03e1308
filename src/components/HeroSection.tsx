import { motion } from "framer-motion";
import m2Logo from "@/assets/m2-logo-official.jpg";
import { useSectionVisible } from "@/hooks/useSiteContent";

import AudienceSelector from "./landing/AudienceSelector";
import ForParentsCTA from "./landing/ForParentsCTA";
import Testimonials from "./landing/Testimonials";
import M2Difference from "./landing/M2Difference";
import FindUs from "./landing/FindUs";
import PortalEntrance from "./landing/PortalEntrance";
import EmailCapture from "./landing/EmailCapture";

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
                className="w-36 h-36 md:w-48 md:h-48 lg:w-56 lg:h-56 object-contain mb-4"
              />
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold tracking-display text-foreground leading-snug mb-3">
                Train smarter. Get stronger.
                <br />
                <span className="text-primary">Real coaching. Real results.</span>
              </h1>
              <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
                In-person training in Grosse Pointe. Online programs anywhere.
                The same coach either way.
              </p>
            </div>

            {/* Audience Router — right under hero subtitle */}
            <AudienceSelector />
          </motion.div>
        )}

        {/* ─── 3. FOR PARENTS — Injury Prevention Hook ─── */}
        <ForParentsCTA />

        {/* ─── 4. SOCIAL PROOF ─── */}
        <Testimonials />

        {/* ─── 5. THE M² DIFFERENCE ─── */}
        <M2Difference />

        {/* ─── 6. MEMBER PORTAL (for returning users) ─── */}
        <PortalEntrance />

        {/* ─── 7. FIND US ─── */}
        {showFindUs && <FindUs />}

        {/* ─── 8. EMAIL CAPTURE ─── */}
        <EmailCapture />

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
