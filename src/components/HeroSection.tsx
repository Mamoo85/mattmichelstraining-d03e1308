import { motion } from "framer-motion";
import { ArrowRight, ShoppingBag, Shield, Trophy, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import m2Logo from "@/assets/m2-logo.jpg";
import SectionHeader from "./SectionHeader";
import NewsletterSignup from "./NewsletterSignup";
import MerchSection from "./MerchSection";
import CurrentClients from "./landing/CurrentClients";
import TeamYouthPrograms from "./landing/TeamYouthPrograms";
import MattQuote from "./landing/MattQuote";
import WordsFromMatt from "./landing/WordsFromMatt";
import MonthlyFocus from "./landing/MonthlyFocus";
import CustomProgram from "./landing/CustomProgram";
import WeekendYouth from "./landing/WeekendYouth";
import OnlineServices from "./landing/OnlineServices";
import ForTrainers from "./landing/ForTrainers";
import CanFixIt from "./landing/CanFixIt";

const STATS = [
  { value: "20+", label: "Years" },
  { value: "50+", label: "College Athletes" },
  { value: "1000s", label: "Clients Trained" },
  { value: "Zero", label: "Injuries" },
];

const TITLE_LINES = ["Train smarter.", "Fix what's broken.", "Get stronger."];

const HeroSection = () => (
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="py-10 md:py-20"
      >
        <div className="flex items-start gap-4 mb-6">
          <img src={m2Logo} alt="M² Training" className="w-14 h-14 md:w-20 md:h-20 object-contain rounded-md flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-0.5 h-4 bg-primary" />
              <span className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-primary font-mono">
                Personal Training
              </span>
            </div>
            <h1 className="text-2xl md:text-5xl lg:text-6xl font-bold tracking-display text-foreground leading-[1.1]">
              {TITLE_LINES.map((line, i) => (
                <motion.span
                  key={line}
                  initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 0.15 * i + 0.3, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                  className="block"
                >
                  {line}
                </motion.span>
              ))}
            </h1>
          </div>
        </div>

        <p className="text-sm md:text-base text-muted-foreground max-w-xl mb-6 leading-relaxed">
          Two decades of experience. Thousands of clients trained with zero injuries. From middle school athletes to Division I competitors — real training, real results.
        </p>

        <Link
          to="/shop"
          className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          Get started
          <ArrowRight size={15} />
        </Link>
      </motion.div>

      {/* STATS */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        {STATS.map((s) => (
          <div key={s.label} className="bg-card shadow-m2 p-4 text-center">
            <span className="text-xl md:text-2xl font-bold text-primary font-mono block">{s.value}</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </motion.div>

      {/* CURRENT CLIENTS */}
      <CurrentClients />

      {/* TEAM & YOUTH */}
      <TeamYouthPrograms />

      {/* QUOTE */}
      <MattQuote />

      {/* WORDS FROM MATT */}
      <WordsFromMatt />

      {/* MONTHLY FOCUS */}
      <MonthlyFocus />

      {/* CUSTOM PROGRAM */}
      <CustomProgram />

      {/* WEEKEND & YOUTH */}
      <WeekendYouth />

      {/* ONLINE SERVICES */}
      <OnlineServices />

      {/* FOR TRAINERS */}
      <ForTrainers />

      {/* I CAN FIX IT */}
      <CanFixIt />

      {/* WHY M² */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-10"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card shadow-m2 p-5">
            <Shield size={20} className="text-primary mb-2" />
            <h3 className="text-sm font-bold text-foreground mb-1">Zero Injuries. Ever.</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Healthy joints and healthy minds first. They all get strong — I promise.
            </p>
          </div>
          <div className="bg-card shadow-m2 p-5">
            <Trophy size={20} className="text-primary mb-2" />
            <h3 className="text-sm font-bold text-foreground mb-1">50+ College Athletes</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Most trainers move up. I stayed with young athletes for 20+ years. That's why it works.
            </p>
          </div>
          <div className="bg-card shadow-m2 p-5">
            <Zap size={20} className="text-primary mb-2" />
            <h3 className="text-sm font-bold text-foreground mb-1">The WHY, Not Just The What</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every guide teaches the reasoning. When they understand why, they do it better. 100% of the time.
            </p>
          </div>
        </div>
      </motion.div>

      {/* PRODUCT PREVIEW */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="mb-10"
      >
        <SectionHeader title="Guides & Programs" timestamp="20+ years of knowledge — starting at $9" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { title: "Top 5 Exercises for Baseball", price: "$9", tag: "PDF GUIDE" },
            { title: "Hockey Strength Essentials", price: "$9", tag: "PDF GUIDE" },
            { title: "Pre & Post Pregnancy Top 10", price: "$12", tag: "PDF GUIDE" },
            { title: "Your Custom Program", price: "$20", tag: "CUSTOM · BUILT BY MATT" },
          ].map((p) => (
            <Link key={p.title} to="/shop" className="bg-card shadow-m2 p-4 hover:bg-m2-surface-hover transition-m2 group block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-2">{p.tag}</span>
              <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-m2 mb-2">{p.title}</h3>
              <span className="text-lg font-mono font-bold text-primary">{p.price}</span>
            </Link>
          ))}
        </div>
        <div className="mt-3 text-center">
          <Link to="/shop" className="text-sm text-primary font-bold hover:opacity-80 transition-m2">View All Guides →</Link>
        </div>
      </motion.div>

      {/* NEWSLETTER */}
      <div className="mb-10">
        <NewsletterSignup />
      </div>

      {/* MERCH */}
      <MerchSection />

      {/* FIND US */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
      >
        <SectionHeader title="Find Us" />
        <div className="bg-card shadow-m2 p-5">
          <p className="text-sm font-bold text-foreground">M² Training</p>
          <p className="text-xs text-muted-foreground mt-1">15121 Kercheval Ave<br />Grosse Pointe Park, MI 48230</p>
          <div className="flex flex-wrap gap-3 mt-3">
            <a href="https://maps.google.com/?q=15121+Kercheval+Ave,+Grosse+Pointe+Park,+MI+48230" target="_blank" rel="noreferrer" className="text-sm text-primary font-bold hover:opacity-80 transition-m2">Get Directions</a>
            <a href="https://www.facebook.com/matt-michels-training" target="_blank" rel="noreferrer" className="text-sm text-primary font-bold hover:opacity-80 transition-m2">Follow on Facebook</a>
            <a href="mailto:matthewmichels4@gmail.com" className="text-sm text-primary font-bold hover:opacity-80 transition-m2">Email Matt</a>
          </div>
        </div>
      </motion.div>

      {/* FOOTER */}
      <div className="mt-10 pt-6 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} M² Training · Grosse Pointe Park, MI · Real training, real results.
        </p>
      </div>
    </div>
  </div>
);

export default HeroSection;
