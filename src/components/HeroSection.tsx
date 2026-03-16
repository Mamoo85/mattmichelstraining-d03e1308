import { motion } from "framer-motion";
import { ArrowRight, ShoppingBag, Shield, Trophy, Zap, Gift, Star, Users } from "lucide-react";
import { Link } from "react-router-dom";
import m2Logo from "@/assets/m2-logo.jpg";
import SectionHeader from "./SectionHeader";

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

const GUIDES = [
  {
    title: "Top 5 Exercises for Baseball",
    price: "$9",
    tag: "PDF GUIDE",
    desc: "I've trained baseball players for two decades. These are the five movements that actually translate to the field — rotational power, arm health, hip mobility. Not the stuff you see on Instagram. The stuff that works.",
  },
  {
    title: "Top 5 Exercises for Football",
    price: "$9",
    tag: "PDF GUIDE",
    desc: "Football is about power off the line and a body that can take contact without breaking. These five exercises build explosive hips, a bulletproof core, and the kind of durability that keeps them on the field all season. Twenty years of training football athletes — this is what actually transfers.",
  },
  {
    title: "Top 5 Exercises for Basketball",
    price: "$9",
    tag: "PDF GUIDE",
    desc: "Every basketball parent asks me about vertical. Here's the truth — you can't jump higher if your knees can't handle the landing. This guide builds elastic power AND protects the joints. Five exercises that make them faster, more explosive, and way harder to guard.",
  },
  {
    title: "Hockey Strength Essentials",
    price: "$9",
    tag: "PDF GUIDE",
    desc: "Hockey is the most physically demanding youth sport, period. This guide covers the posterior chain work, single-leg stability, and core bracing that turns skaters into forces. I explain the physics behind every movement so your athlete knows WHY they're doing it.",
  },
  {
    title: "Top 5 Exercises for Soccer",
    price: "$9",
    tag: "PDF GUIDE",
    desc: "Soccer kids run for 90 minutes on one leg at a time — that's the reality. This guide is built around single-leg strength, hip mobility, and the endurance base that keeps them sharp in the 80th minute. No fluff. Just the movements that matter.",
  },
  {
    title: "Top 5 Exercises for Lacrosse",
    price: "$9",
    tag: "PDF GUIDE",
    desc: "Lacrosse beats up shoulders and demands sprint speed in transition. These five exercises build shoulder durability for stick work, explosive change of direction, and a frame that handles contact. I've watched this sport grow for 15 years — I know what breaks down first.",
  },
  {
    title: "Pre & Post Pregnancy Top 10",
    price: "$12",
    tag: "PDF GUIDE",
    desc: "This one's personal. I wrote it for the moms who trained with me and asked 'what can I do now?' Ten exercises that are safe, effective, and backed by the kinesiology. Pelvic floor, core reconnection, rebuilding strength the right way.",
  },
  {
    title: "Youth Athlete Starter Guide",
    price: "$12",
    tag: "PDF GUIDE",
    desc: "This is the exact program I give every new young athlete who walks through my door. Movement quality first, then work capacity, then strength. Four weeks of building the foundation that prevents injuries for life. Parents — this is where it starts.",
  },
  {
    title: "Your Custom Program",
    price: "$20",
    tag: "CUSTOM · BUILT BY MATT",
    desc: "You fill out the intake. I read every word. Then I build your program from scratch — your goals, your equipment, your level. No templates. No AI. Just me, a notebook, and 20 years of doing this. This is the one that changes everything.",
  },
];

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
          to="/auth"
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

      {/* FREE MEMBER BONUS BANNER */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="mb-10"
      >
        <div className="bg-primary/10 border-2 border-primary/30 p-5 md:p-6">
          <div className="flex items-start gap-3 mb-3">
            <Gift size={22} className="text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base md:text-lg font-bold text-foreground mb-1">Free When You Sign Up</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Create a free account, log your workouts with Matt, and get access to <span className="text-foreground font-semibold">monthly focus plans</span> and <span className="text-foreground font-semibold">member challenges</span> — no subscription needed. It's Matt's way of keeping you accountable.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="flex items-center gap-2">
              <Star size={14} className="text-primary flex-shrink-0" />
              <span className="text-xs text-foreground">Monthly Focus Plans</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-primary flex-shrink-0" />
              <span className="text-xs text-foreground">Member Challenges</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={14} className="text-primary flex-shrink-0" />
              <span className="text-xs text-foreground">Challenge Suggestions</span>
            </div>
          </div>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 mt-4"
          >
            Create Free Account
            <ArrowRight size={14} />
          </Link>
        </div>
      </motion.div>

      {/* CURRENT CLIENTS */}
      <CurrentClients />

      {/* GUIDES & PROGRAMS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="mb-10"
      >
        <SectionHeader title="Guides & Programs" timestamp="20+ years of knowledge — starting at $9" />
        <div className="space-y-3">
          {GUIDES.map((p) => (
            <Link key={p.title} to="/shop" className="bg-card shadow-m2 p-5 hover:bg-m2-surface-hover transition-m2 group block">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">{p.tag}</span>
                  <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-m2">{p.title}</h3>
                </div>
                <span className="text-lg font-mono font-bold text-primary flex-shrink-0">{p.price}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
            </Link>
          ))}
        </div>
        <div className="mt-3 text-center">
          <Link to="/shop" className="text-sm text-primary font-bold hover:opacity-80 transition-m2">View All Guides →</Link>
        </div>
      </motion.div>

      {/* ONLINE SERVICES */}
      <OnlineServices />

      {/* CUSTOM PROGRAM */}
      <CustomProgram />

      {/* TEAM & YOUTH */}
      <TeamYouthPrograms />

      {/* QUOTE */}
      <MattQuote />

      {/* WORDS FROM MATT */}
      <WordsFromMatt />

      {/* MONTHLY FOCUS */}
      <MonthlyFocus />

      {/* WEEKEND & YOUTH */}
      <WeekendYouth />

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
