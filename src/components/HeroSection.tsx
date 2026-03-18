import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
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

      <div className="container relative z-10 pt-20 pb-12 px-4 sm:px-6">
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
              <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed mb-6">
                In-person training in Grosse Pointe. Online programs anywhere.
                The same coach either way.
              </p>

              {/* CTA Buttons */}
              <motion.div
                className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Link
                  to="/pricing"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all group"
                >
                  Start Training
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/shop"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 border-2 border-primary text-primary px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-all group"
                >
                  <Play size={14} />
                  Browse Programs
                </Link>
              </motion.div>
            </div>

            {/* Orange accent bar */}
            <motion.div
              className="w-16 h-1 bg-primary mx-auto mt-4"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            />
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
