import { motion } from "framer-motion";
import { ArrowRight, ShoppingBag, Shield, Trophy, Zap, Star, Gift, Users } from "lucide-react";
import { Link } from "react-router-dom";
import m2Logo from "@/assets/m2-logo.jpg";
import SectionHeader from "./SectionHeader";
import NewsletterSignup from "./NewsletterSignup";
import MerchSection from "./MerchSection";

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


const TITLE_WORDS = ["YOUR", "ATHLETE'S", "SECRET", "WEAPON."];

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
          <img
            src={m2Logo}
            alt="M² Training"
            className="w-14 h-14 md:w-20 md:h-20 object-contain rounded-md flex-shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-0.5 h-4 bg-primary" />
              <span className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-primary font-mono">
                Youth Athlete Strength · Grosse Pointe Park, MI
              </span>
            </div>
            <h1 className="text-2xl md:text-5xl lg:text-6xl font-bold tracking-display text-foreground leading-[1.05]">
              {TITLE_WORDS.map((word, i) => (
                <motion.span
                  key={word}
                  initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{
                    delay: 0.15 * i + 0.3,
                    duration: 0.5,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                  className={`inline-block mr-2 md:mr-3 ${word === "WEAPON." ? "text-primary" : ""}`}
                >
                  {word}
                </motion.span>
              ))}
            </h1>
          </div>
        </div>

        <p className="text-sm md:text-base text-muted-foreground max-w-xl mb-6 leading-relaxed">
          20+ years training young athletes for college sports. Zero injuries. 50+ college athletes produced.
          I can only train so many in person — so I put my system into guides anyone can use.
          <span className="text-foreground font-semibold"> Not just what to do. The WHY.</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/shop"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            <ShoppingBag size={15} />
            Browse Guides & Programs
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 bg-card text-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest shadow-m2 hover:bg-m2-surface-hover transition-m2"
          >
            Client Portal
            <ArrowRight size={15} />
          </Link>
        </div>
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
          {PRODUCTS_PREVIEW.map((p) => (
            <Link
              key={p.title}
              to="/shop"
              className="bg-card shadow-m2 p-4 hover:bg-m2-surface-hover transition-m2 group block"
            >
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-2">{p.tag}</span>
              <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-m2 mb-2">{p.title}</h3>
              <span className="text-lg font-mono font-bold text-primary">{p.price}</span>
            </Link>
          ))}
        </div>
        <div className="mt-3 text-center">
          <Link to="/shop" className="text-sm text-primary font-bold hover:opacity-80 transition-m2">
            View All Guides →
          </Link>
        </div>
      </motion.div>

      {/* NEWSLETTER SIGNUP */}
      <div className="mb-10">
        <NewsletterSignup />
      </div>

      {/* MERCHANDISE SHOP */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mb-10"
      >
        <SectionHeader title="M² Merch" timestamp="Rep the brand. Earn the shirt." />
        <div className="bg-primary/5 border border-primary/15 p-4 mb-4">
          <p className="text-sm text-foreground leading-relaxed">
            <span className="font-bold">Gear for the athletes and parents who put in the work.</span>{" "}
            Every piece is designed to be worn in the gym, at the field, or on the sidelines. 
            If you train with Matt — you've earned it.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MERCH_ITEMS.map((item) => (
            <div
              key={item.id}
              className="bg-card shadow-m2 p-4 hover:bg-m2-surface-hover transition-m2 group flex flex-col"
            >
              <div className="w-full aspect-square bg-secondary/50 mb-3 flex items-center justify-center">
                <img
                  src={m2Logo}
                  alt={item.name}
                  className="w-12 h-12 object-contain opacity-40 group-hover:opacity-60 transition-m2"
                />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">{item.tag}</span>
              <h3 className="text-xs font-bold text-foreground mb-1 leading-snug">{item.name}</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed mb-2 flex-1">{item.description}</p>
              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="text-base font-mono font-bold text-primary">{item.price}</span>
                <button className="bg-primary text-primary-foreground px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2">
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            All merch ships from Grosse Pointe Park, MI · Secure checkout via Stripe
          </p>
        </div>
      </motion.div>

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
