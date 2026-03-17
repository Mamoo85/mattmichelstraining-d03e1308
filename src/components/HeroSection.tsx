import { useState } from "react";
import { motion } from "framer-motion";
import m2Logo from "@/assets/m2-logo-official.jpg";
import { useContentMap, useSectionVisible } from "@/hooks/useSiteContent";

import AuthorityBar from "./landing/AuthorityBar";
import AudienceSelector from "./landing/AudienceSelector";
import ForParentsCTA from "./landing/ForParentsCTA";
import Testimonials from "./landing/Testimonials";
import M2Difference from "./landing/M2Difference";
import FindUs from "./landing/FindUs";
import PortalEntrance from "./landing/PortalEntrance";
import EmailCapture from "./landing/EmailCapture";

const HeroSection = () => {
  const { content: hero } = useContentMap("hero");
  const { content: stats } = useContentMap("stats");

  const showHero = useSectionVisible("hero");
  const showAuthority = useSectionVisible("authority_bar");
  const showStats = useSectionVisible("stats");
  const showFindUs = useSectionVisible("find_us");

  const STATS = [
    { value: stats.stat_1_value || "20+", label: stats.stat_1_label || "Years" },
    { value: stats.stat_2_value || "50+", label: stats.stat_2_label || "College Athletes" },
    { value: stats.stat_3_value || "1000s", label: stats.stat_3_label || "Clients Trained" },
    { value: stats.stat_4_value || "Zero", label: stats.stat_4_label || "Injuries" },
  ];

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
                Your kid's strength coach.
                <br />
                <span className="text-primary">20 years. Zero injuries.</span>
              </h1>
              <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
                In-person training in Grosse Pointe. Online programs anywhere.
                The same coach either way.
              </p>
            </div>
          </motion.div>
        )}

        {/* Authority credentials */}
        {showAuthority && <AuthorityBar />}

        {/* Stats */}
        {showStats && (
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            {STATS.map((s) => (
              <div key={s.label} className="bg-card shadow-m2 p-4 text-center">
                <span className="text-xl md:text-2xl font-bold text-primary font-mono block">
                  {s.value}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {s.label}
                </span>
              </div>
            ))}
          </motion.div>
        )}

        {/* ─── 2. AUDIENCE ROUTER ─── */}
        <AudienceSelector />

        {/* ─── 3. FOR PARENTS — Injury Prevention Hook ─── */}
        <ForParentsCTA />

        {/* ─── 4. THE M² DIFFERENCE ─── */}
        <M2Difference />

        {/* ─── 5. MEMBER PORTAL (for returning users) ─── */}
        <PortalEntrance />

        {/* ─── 6. FIND US ─── */}
        {showFindUs && <FindUs />}

        {/* FOOTER */}
        <div className="mt-10 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} <span className="font-brand text-sm text-foreground">M² Training</span> · Grosse Pointe Park, MI · Real training, real results.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
