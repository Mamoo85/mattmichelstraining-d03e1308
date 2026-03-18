import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Users, Dumbbell, GraduationCap, ArrowRight, X, Sparkles } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import sneakAthlete from "@/assets/sneak-athlete.jpg";
import sneakCoach from "@/assets/sneak-coach.jpg";
import sneakParent from "@/assets/sneak-parent.jpg";
import portalProgress from "@/assets/portal-progress.png";

const AUDIENCES = [
  {
    label: "I'm a Parent",
    icon: Shield,
    route: "/for-parents",
    desc: "Monitor every rep. Message Coach Matt. Zero guesswork.",
    peek: sneakParent,
    peekAlt: "Parent monitoring dashboard showing recovery metrics",
    cta: "See How It Works",
    peekCaption: "Track your athlete's workouts, recovery, and progress — all from your phone.",
  },
  {
    label: "I'm an Athlete",
    icon: Dumbbell,
    route: "/shop",
    desc: "Build workouts. Crush challenges. Track everything.",
    peek: sneakAthlete,
    peekAlt: "Challenge leaderboard and workout builder",
    cta: "Peek Inside",
    peekCaption: "Join monthly challenges, build custom workouts, and compete on the leaderboard.",
  },
  {
    label: "I'm a Coach",
    icon: Users,
    route: "/pricing",
    desc: "Full-roster strength programs. Any sport. Any state.",
    peek: sneakCoach,
    peekAlt: "Team strength program dashboard with roster progress",
    cta: "See Team Programs",
    peekCaption: "Matt builds the S&C program for your entire roster — delivered online, ready to implement.",
  },
  {
    label: "Current Member",
    icon: GraduationCap,
    route: "/dashboard",
    desc: "Your portal is waiting. Log in and get to work.",
    peek: portalProgress,
    peekAlt: "Member training portal with progress tracking",
    cta: "Enter Portal",
    peekCaption: "Your programs, logs, and Coach Matt — all in one place.",
  },
];

const AudienceSelector = () => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="mb-10"
    >
      {/* Bold header */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-primary/40" />
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <h2 className="text-sm md:text-base font-bold uppercase tracking-widest text-primary">
            What brings you here?
          </h2>
          <Sparkles size={14} className="text-primary" />
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-primary/40" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {AUDIENCES.map((a, i) => (
          <div key={a.label} className="relative">
            {/* Main card */}
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className={`w-full bg-card shadow-m2 p-4 text-left border-2 transition-m2 group ${
                expanded === i
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-transparent hover:border-primary/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <a.icon size={18} className="text-primary group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-foreground block mb-0.5 group-hover:text-primary transition-m2">
                    {a.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-relaxed block">
                    {a.desc}
                  </span>
                </div>
                <ArrowRight
                  size={14}
                  className={`text-muted-foreground mt-1 transition-transform ${
                    expanded === i ? "rotate-90 text-primary" : "group-hover:translate-x-0.5"
                  }`}
                />
              </div>
            </button>

            {/* Sneak peek expand */}
            <AnimatePresence>
              {expanded === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="bg-card border-2 border-t-0 border-primary/30 p-3">
                    {/* Screenshot */}
                    <div className="relative overflow-hidden mb-3 bg-background">
                      <img
                        src={a.peek}
                        alt={a.peekAlt}
                        className="w-full h-40 object-cover object-top"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                      <span className="absolute bottom-2 left-2 text-[9px] font-bold uppercase tracking-widest text-primary bg-background/80 px-2 py-1">
                        Sneak Peek
                      </span>
                    </div>
                    {/* Caption */}
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                      {a.peekCaption}
                    </p>
                    {/* CTA */}
                    <Link
                      to={a.route}
                      className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 w-full justify-center"
                    >
                      {a.cta}
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default AudienceSelector;
