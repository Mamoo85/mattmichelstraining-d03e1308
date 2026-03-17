import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import m2Logo from "@/assets/m2-logo-official.jpg";
import { useContentMap, useSectionVisible } from "@/hooks/useSiteContent";
import { SmartSlogan } from "./LogoAnimations";

import AuthorityBar from "./landing/AuthorityBar";
// GuidesGrid removed

import PremiumProgram from "./landing/PremiumProgram";
import PortalShowcase from "./landing/PortalShowcase";
import OnlineServices from "./landing/OnlineServices";
import OnlineSavings from "./landing/OnlineSavings";
import SportOnlineTraining from "./landing/SportOnlineTraining";
import ForParentsCTA from "./landing/ForParentsCTA";

import TeamYouthPrograms from "./landing/TeamYouthPrograms";
import MonthlyFocus from "./landing/MonthlyFocus";
import WeekendYouth from "./landing/WeekendYouth";
import ForTrainers from "./landing/ForTrainers";

import FreeBonusBanner from "./landing/FreeBonusBanner";
import MerchSection from "./MerchSection";
import FindUs from "./landing/FindUs";

const HeroSection = () => {
  const { content: hero } = useContentMap("hero");
  const { content: stats } = useContentMap("stats");

  // Visibility toggles
  const showHero = useSectionVisible("hero");
  const showAuthority = useSectionVisible("authority_bar");
  const showStats = useSectionVisible("stats");
  
  const showFreeBonus = useSectionVisible("free_bonus");
  
  const showGuides = useSectionVisible("guides");
  const showPremium = useSectionVisible("premium_program");
  const showOnline = useSectionVisible("online_services");
  const showTeamYouth = useSectionVisible("team_youth");
  const showMonthly = useSectionVisible("monthly_focus");
  const showWeekend = useSectionVisible("weekend_youth");
  const showTrainers = useSectionVisible("for_trainers");
  const showMerch = useSectionVisible("merch");
  const showFindUs = useSectionVisible("find_us");

  const STATS = [
    { value: stats.stat_1_value || "20+", label: stats.stat_1_label || "Years" },
    { value: stats.stat_2_value || "50+", label: stats.stat_2_label || "College Athletes" },
    { value: stats.stat_3_value || "1000s", label: stats.stat_3_label || "Clients Trained" },
    { value: stats.stat_4_value || "Zero", label: stats.stat_4_label || "Injuries" },
  ];

  const scrollToPortal = () => {
    document.getElementById("section-portal")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
        {/* HERO */}
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
                className="w-36 h-36 md:w-48 md:h-48 lg:w-56 lg:h-56 object-contain mb-2"
              />
              <SmartSlogan />
            </div>

            <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto mb-6 leading-relaxed text-center">
              {hero.subtitle || "20+ years developing athletes the right way. Custom programs, real coaching, zero injuries. In-person in Grosse Pointe or online anywhere."}
            </p>

            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                to="/schedule"
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
              >
                Schedule Now
                <ArrowRight size={15} />
              </Link>
              <Link
                to="/auth?redirect=/shop"
                className="inline-flex items-center justify-center gap-2 border-2 border-primary/40 text-primary px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
              >
                Start training
              </Link>
              <button
                onClick={scrollToPortal}
                className="inline-flex items-center justify-center gap-2 border-2 border-border text-muted-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:text-foreground hover:border-foreground/30 transition-m2"
              >
                See what's included
              </button>
            </div>
          </motion.div>
        )}

        {showAuthority && <AuthorityBar />}

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

        {showFreeBonus && <FreeBonusBanner />}

        {showPremium && <div id="section-portal"><PortalShowcase /></div>}
        {showPremium && <PremiumProgram />}
        {/* GuidesGrid removed — programs only */}
        {showOnline && <OnlineServices />}
        {showOnline && <OnlineSavings />}
        {showOnline && <SportOnlineTraining />}
        {showTeamYouth && <div id="section-teams"><TeamYouthPrograms /></div>}
        <ForParentsCTA />
        {showMonthly && <MonthlyFocus />}
        {showWeekend && <WeekendYouth />}
        {showTrainers && <div id="section-trainers"><ForTrainers /></div>}
        {showMerch && <MerchSection />}
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
