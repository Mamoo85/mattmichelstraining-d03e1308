import { motion } from "framer-motion";
import { ArrowRight, Dumbbell, BarChart3, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const HeroSection = () => (
  <div className="min-h-screen flex flex-col justify-center bg-background relative overflow-hidden">
    {/* Subtle grid pattern */}
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: `linear-gradient(hsl(var(--muted-foreground)) 1px, transparent 1px),
          linear-gradient(90deg, hsl(var(--muted-foreground)) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }}
    />

    <div className="container relative z-10 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
      >
        {/* Badge */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-0.5 h-4 bg-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono">
            Professional Strength Coaching
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-display text-foreground leading-[0.95] mb-6">
          LEAVE NOTHING<br />
          <span className="text-primary">TO CHANCE.</span>
        </h1>

        <p className="text-sm md:text-base text-muted-foreground max-w-md mb-8 text-balance">
          Professional-grade tracking for the 1%. Data-driven strength protocols built for competitive powerlifters and serious athletes.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            Enter Protocol
            <ArrowRight size={14} />
          </Link>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 bg-m2-surface text-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest shadow-m2 hover:bg-m2-surface-hover transition-m2"
          >
            Browse Programs
          </Link>
        </div>
      </motion.div>

      {/* Feature pills */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-16"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.2, 0, 0, 1] }}
      >
        {[
          { icon: Dumbbell, title: "STRENGTH PROTOCOLS", desc: "Periodized programming with real-time tracking" },
          { icon: BarChart3, title: "PROGRESS ENGINE", desc: "E1RM charts and performance analytics" },
          { icon: Shield, title: "COACH ACCESS", desc: "Direct messaging and video review" },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-m2-surface shadow-m2 p-4 flex items-start gap-3">
            <Icon size={18} className="text-primary mt-0.5 shrink-0" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground block">{title}</span>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  </div>
);

export default HeroSection;
