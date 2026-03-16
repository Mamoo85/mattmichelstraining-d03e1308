import { motion } from "framer-motion";
import { ArrowRight, ShoppingBag, MapPin, Shield, Trophy, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import m2Logo from "@/assets/m2-logo.jpg";
import SectionHeader from "./SectionHeader";
import NewsletterSignup from "./NewsletterSignup";

const STATS = [
  { value: "20+", label: "Years · Same Age Group" },
  { value: "50+", label: "College Athletes Produced" },
  { value: "Zero", label: "Career Injuries" },
  { value: "100%", label: "Results Rate" },
];

const PRODUCTS_PREVIEW = [
  { title: "Top 5 Exercises for Baseball", price: "$9", tag: "PDF GUIDE" },
  { title: "Hockey Strength Essentials", price: "$9", tag: "PDF GUIDE" },
  { title: "Pre & Post Pregnancy Top 10", price: "$12", tag: "PDF GUIDE" },
  { title: "Your Custom Program", price: "$20", tag: "CUSTOM · BUILT BY MATT" },
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        className="py-12 md:py-20"
      >
        <div className="flex items-center gap-4 mb-6">
          <img src={m2Logo} alt="M² Training" className="w-16 h-16 md:w-20 md:h-20 object-cover shadow-m2" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-0.5 h-4 bg-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono">
                Youth Athlete Strength · Grosse Pointe Park, MI
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-display text-foreground leading-[0.95]">
              YOUR ATHLETE'S<br />
              <span className="text-primary">SECRET WEAPON.</span>
            </h1>
          </div>
        </div>

        <p className="text-sm md:text-base text-muted-foreground max-w-xl mb-6 text-balance leading-relaxed">
          20+ years training young athletes for college sports. Zero injuries. 50+ college athletes produced.
          I can only train so many in person — so I put my system into guides anyone can use.
          <span className="text-foreground font-semibold"> Not just what to do. The WHY.</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            <ShoppingBag size={14} />
            Browse Guides & Programs
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 bg-card text-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest shadow-m2 hover:bg-m2-surface-hover transition-m2"
          >
            Client Portal
            <ArrowRight size={14} />
          </Link>
        </div>
      </motion.div>

      {/* STATS */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.2, 0, 0, 1] }}
      >
        {STATS.map((s) => (
          <div key={s.label} className="bg-card shadow-m2 p-3 text-center">
            <span className="text-xl md:text-2xl font-bold text-primary font-mono block">{s.value}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </motion.div>

      {/* WHY M² — short version */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.2, 0, 0, 1] }}
        className="mb-12"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card shadow-m2 p-4">
            <Shield size={18} className="text-primary mb-2" />
            <h3 className="text-xs font-bold text-foreground mb-1">Zero Injuries. Ever.</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Healthy joints and healthy minds first. They all get strong — I promise.
            </p>
          </div>
          <div className="bg-card shadow-m2 p-4">
            <Trophy size={18} className="text-primary mb-2" />
            <h3 className="text-xs font-bold text-foreground mb-1">50+ College Athletes</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Most trainers move up. I stayed with young athletes for 20+ years. That's why it works.
            </p>
          </div>
          <div className="bg-card shadow-m2 p-4">
            <Zap size={18} className="text-primary mb-2" />
            <h3 className="text-xs font-bold text-foreground mb-1">The WHY, Not Just The What</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Every guide teaches the reasoning. When they understand why, they do it better. 100% of the time.
            </p>
          </div>
        </div>
      </motion.div>

      {/* PRODUCT PREVIEW */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25, ease: [0.2, 0, 0, 1] }}
        className="mb-12"
      >
        <SectionHeader title="Guides & Programs" timestamp="20+ years of knowledge — starting at $9" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRODUCTS_PREVIEW.map((p) => (
            <Link
              key={p.title}
              to="/shop"
              className="bg-card shadow-m2 p-4 hover:bg-m2-surface-hover transition-m2 group block"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-2">{p.tag}</span>
              <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-m2 mb-2">{p.title}</h3>
              <span className="text-lg font-mono font-bold text-primary">{p.price}</span>
            </Link>
          ))}
        </div>
        <div className="mt-3 text-center">
          <Link to="/shop" className="text-xs text-primary font-bold hover:opacity-80 transition-m2">
            View All Guides →
          </Link>
        </div>
      </motion.div>

      {/* NEWSLETTER SIGNUP */}
      <div className="mb-12">
        <NewsletterSignup />
      </div>

      {/* FIND US */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35, ease: [0.2, 0, 0, 1] }}
      >
        <SectionHeader title="Find Us" />
        <div className="bg-card shadow-m2 p-5">
          <p className="text-sm font-bold text-foreground">M² Training</p>
          <p className="text-xs text-muted-foreground mt-1">15121 Kercheval Ave<br />Grosse Pointe Park, MI 48230</p>
          <div className="flex flex-wrap gap-3 mt-3">
            <a href="https://maps.google.com/?q=15121+Kercheval+Ave,+Grosse+Pointe+Park,+MI+48230" target="_blank" rel="noreferrer" className="text-xs text-primary font-bold hover:opacity-80 transition-m2">Get Directions</a>
            <a href="https://www.facebook.com/matt-michels-training" target="_blank" rel="noreferrer" className="text-xs text-primary font-bold hover:opacity-80 transition-m2">Follow on Facebook</a>
            <a href="mailto:matthewmichels4@gmail.com" className="text-xs text-primary font-bold hover:opacity-80 transition-m2">Email Matt</a>
          </div>
        </div>
      </motion.div>

      {/* FOOTER */}
      <div className="mt-12 pt-6 border-t border-border text-center">
        <p className="text-[10px] text-muted-foreground">
          © {new Date().getFullYear()} M² Training · Grosse Pointe Park, MI · Real training, real results.
        </p>
      </div>
    </div>
  </div>
);

export default HeroSection;
