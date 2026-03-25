import { motion } from "framer-motion";
import { Shield, Users, Dumbbell, GraduationCap, ArrowRight, HeartPulse } from "lucide-react";
import { Link } from "react-router-dom";
import sneakAthlete from "@/assets/sneak-athlete.jpg";
import sneakCoach from "@/assets/sneak-coach.jpg";
import sneakParent from "@/assets/sneak-parent.jpg";
import portalProgress from "@/assets/portal-progress.jpg";

const AUDIENCES = [
  {
    label: "I Want to Train",
    icon: HeartPulse,
    route: "/shop",
    peek: sneakAthlete,
    desc: "Get faster. Get stronger. Dominate your season.",
    cta: "Browse Programs",
  },
  {
    label: "I'm a Parent",
    icon: Shield,
    route: "/for-parents",
    peek: sneakParent,
    desc: "Monitor every rep. Message Coach Matt.",
    cta: "See How It Works",
  },
  {
    label: "I'm a Coach",
    icon: Users,
    route: "/pricing",
    peek: sneakCoach,
    desc: "Full-roster strength programs. Any sport.",
    cta: "Team Programs",
  },
  {
    label: "Current Member",
    icon: GraduationCap,
    route: "/dashboard",
    peek: portalProgress,
    desc: "Your portal is waiting. Get to work.",
    cta: "Enter Portal",
  },
];

const AudienceSelector = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.15 }}
    className="mb-10"
  >
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
        What brings you here?
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
    </div>

    {/* Horizontal scroll row of tall image cards */}
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:overflow-visible">
      {AUDIENCES.map((a) => (
        <Link
          key={a.label}
          to={a.route}
          className="group relative overflow-hidden rounded-lg ring-1 ring-white/5 hover:ring-primary/40 transition-all shrink-0 w-[160px] sm:w-auto snap-start"
        >
          <div className="aspect-[3/4] overflow-hidden">
            <img
              src={a.peek}
              alt={a.label}
              width={400}
              height={300}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          </div>
          <div className="absolute bottom-0 inset-x-0 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <a.icon size={14} className="text-primary" />
              <span className="text-xs font-bold text-foreground">{a.label}</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug mb-2">{a.desc}</p>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-primary group-hover:gap-1.5 transition-all">
              {a.cta} <ArrowRight size={9} />
            </span>
          </div>
        </Link>
      ))}
    </div>
  </motion.div>
);

export default AudienceSelector;
