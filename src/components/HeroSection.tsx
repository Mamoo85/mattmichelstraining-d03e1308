import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import m2Logo from "@/assets/m2-logo.jpg";
import { useContentMap, useSectionVisible } from "@/hooks/useSiteContent";

import AuthorityBar from "./landing/AuthorityBar";
import AudienceSelector from "./landing/AudienceSelector";
import Testimonial from "./landing/Testimonial";
import CurrentClients from "./landing/CurrentClients";
import GuidesGrid from "./landing/GuidesGrid";
import PressAuthority from "./landing/PressAuthority";
import PremiumProgram from "./landing/PremiumProgram";
import PortalShowcase from "./landing/PortalShowcase";
import OnlineServices from "./landing/OnlineServices";
import OnlineSavings from "./landing/OnlineSavings";
import SportOnlineTraining from "./landing/SportOnlineTraining";
import CoachOnlineTools from "./landing/CoachOnlineTools";
import TeamYouthPrograms from "./landing/TeamYouthPrograms";
import MonthlyFocus from "./landing/MonthlyFocus";
import WeekendYouth from "./landing/WeekendYouth";
import ForTrainers from "./landing/ForTrainers";
import CanFixIt from "./landing/CanFixIt";
import MattsStory from "./landing/MattsStory";
import FreeBonusBanner from "./landing/FreeBonusBanner";
import WhyM2 from "./landing/WhyM2";
import MerchSection from "./MerchSection";
import FindUs from "./landing/FindUs";

const HeroSection = () => {
  const { content: hero } = useContentMap("hero");
  const { content: stats } = useContentMap("stats");

  // Visibility toggles
  const showHero = useSectionVisible("hero");
  const showAuthority = useSectionVisible("authority_bar");
  const showStats = useSectionVisible("stats");
  const showTestimonial = useSectionVisible("testimonial");
  const showPress = useSectionVisible("press");
  const showAudience = useSectionVisible("audience_selector");
  const showFreeBonus = useSectionVisible("free_bonus");
  const showClients = useSectionVisible("current_clients");
  const showGuides = useSectionVisible("guides");
  const showPremium = useSectionVisible("premium_program");
  const showOnline = useSectionVisible("online_services");
  const showTeamYouth = useSectionVisible("team_youth");
  const showMonthly = useSectionVisible("monthly_focus");
  const showWeekend = useSectionVisible("weekend_youth");
  const showTrainers = useSectionVisible("for_trainers");
  const showFixIt = useSectionVisible("can_fix_it");
  const showWhyM2 = useSectionVisible("why_m2");
  const showStory = useSectionVisible("matts_story");
  const showMerch = useSectionVisible("merch");
  const showFindUs = useSectionVisible("find_us");

  const HERO_LINES = [
    hero.headline_1 || "50+ college athletes.",
    hero.headline_2 || "Zero injuries.",
    hero.headline_3 || "Your kid could be next.",
  ];

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
        {/* HERO */}
        {showHero && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="py-10 md:py-20"
          >
            <div className="flex items-start gap-4 mb-6">
              <img
                src={m2Logo}
                alt="M² Training"
                className="w-14 h-14 md:w-20 md:h-20 object-contain rounded-md flex-shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-0.5 h-4 bg-primary" />
                  <span className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-primary font-mono">
                    {hero.location || "Grosse Pointe Park, MI"}
                  </span>
                </div>
                <h1 className="text-2xl md:text-5xl lg:text-6xl font-bold tracking-display text-foreground leading-[1.1]">
                  {HERO_LINES.map((line, i) => (
                    <motion.span
                      key={line}
                      initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{
                        delay: 0.15 * i + 0.3,
                        duration: 0.5,
                        ease: [0.23, 1, 0.32, 1],
                      }}
                      className="block"
                    >
                      {line}
                    </motion.span>
                  ))}
                </h1>
              </div>
            </div>

            <p className="text-sm md:text-base text-muted-foreground max-w-xl mb-6 leading-relaxed">
              {hero.subtitle || "Matt Michels has spent two decades doing one thing — developing young athletes the right way. No shortcuts, no burnout, no injuries. Just results that speak for themselves."}
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/auth?redirect=/shop"
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
              >
                {hero.cta_primary || "Start training"}
                <ArrowRight size={15} />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 border-2 border-primary/40 text-primary px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
              >
                {hero.cta_secondary || "View plans"}
              </Link>
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

        {showAudience && <AudienceSelector />}
        {showFreeBonus && <FreeBonusBanner />}
        {showTestimonial && <Testimonial />}
        {showPress && <PressAuthority />}
        {showClients && <div id="section-current-clients"><CurrentClients /></div>}
        {showGuides && <div id="section-guides"><GuidesGrid /></div>}
        {showPremium && <PremiumProgram />}
        {showPremium && <PortalShowcase />}
        {showOnline && <OnlineServices />}
        {showOnline && <OnlineSavings />}
        {showOnline && <SportOnlineTraining />}
        {showTeamYouth && <div id="section-teams"><TeamYouthPrograms /></div>}
        {showTeamYouth && <CoachOnlineTools />}
        {showMonthly && <MonthlyFocus />}
        {showWeekend && <WeekendYouth />}
        {showTrainers && <div id="section-trainers"><ForTrainers /></div>}
        {showFixIt && <CanFixIt />}
        {showWhyM2 && <WhyM2 />}
        {showStory && <MattsStory />}
        {showMerch && <MerchSection />}
        {showFindUs && <FindUs />}

        {/* FOOTER */}
        <div className="mt-10 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} M² Training · Grosse Pointe Park, MI · Real training, real results.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
