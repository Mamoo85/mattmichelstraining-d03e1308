import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Users, BarChart3, ClipboardList, Shield } from "lucide-react";

const COACH_BENEFITS = [
  {
    icon: ClipboardList,
    title: "Turnkey Strength Programs",
    desc: "Matt builds the entire off-season and in-season strength plan for your team. You deliver it. No S&C certification needed — the programming is clear, detailed, and built for coaches who aren't strength specialists.",
  },
  {
    icon: BarChart3,
    title: "Athlete Progress Tracking",
    desc: "Every athlete logs lifts in the M2 portal. You see progress charts, coaching notes, and strength benchmarks for the entire roster — without spreadsheets or guesswork.",
  },
  {
    icon: Shield,
    title: "Injury Prevention Built In",
    desc: "Matt's programs prioritize connective tissue health, joint integrity, and age-appropriate loading. 20 years of youth training. Zero injuries. Your AD and athletic trainer will notice.",
  },
  {
    icon: Users,
    title: "Affordable Team Pricing",
    desc: "One subscription covers the entire team. At $84.99/month for the Team plan, that's often less than what a single athlete pays at a private training facility — and every kid on your roster gets the same quality.",
  },
];

const CoachOnlineTools = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <div className="bg-card shadow-m2 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Users size={18} className="text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
          For Coaches & Athletic Directors
        </span>
      </div>

      <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">
        Your team needs strength training. You don't need a $50K budget to get it.
      </h3>

      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        Most schools and travel programs can't afford a full-time strength coach — and the ones that can often get someone with 2 years of experience
        running the same cookie-cutter program for every sport. Matt has 20+ years building affordable, sport-specific strength programs 
        that coaches actually implement. Everything is delivered online, designed for your sport, your season, and your equipment.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {COACH_BENEFITS.map((b) => (
          <div key={b.title} className="bg-secondary/30 p-4">
            <div className="flex items-center gap-2 mb-1">
              <b.icon size={14} className="text-primary flex-shrink-0" />
              <span className="text-xs font-bold text-foreground">{b.title}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{b.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-primary/10 border border-primary/20 p-4 mb-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-foreground font-bold">How coaches use M2:</span> Order a custom team program ($20) or subscribe to the 
          Team plan ($84.99/mo) for ongoing seasonal programming, athlete tracking, and direct access to Matt for program adjustments.
          Works for middle school, JV, varsity, travel, and club teams across every sport.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/pricing"
          className="inline-flex items-center justify-center gap-2 flex-1 bg-primary text-primary-foreground px-5 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          View Team Plans
          <ArrowRight size={14} />
        </Link>
        <a
          href="mailto:matthewmichels4@gmail.com?subject=Team%20Strength%20Program%20Inquiry%20-%20Coach"
          className="inline-flex items-center justify-center gap-2 flex-1 border-2 border-primary/40 text-primary px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
        >
          Email Matt Directly
        </a>
      </div>
    </div>
  </motion.div>
);

export default CoachOnlineTools;
