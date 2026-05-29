import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Wifi } from "lucide-react";
import SectionHeader from "@/components/shared/SectionHeader";

const SPORTS = [
  {
    sport: "Baseball & Softball",
    desc: "Rotator cuff durability, hip rotation power, and arm care programming that prevents the overuse injuries plaguing youth pitchers and catchers.",
    focus: "Shoulder health · Hip power · Arm care",
  },
  {
    sport: "Soccer",
    desc: "ACL prevention starts with hamstring and glute strength — not agility ladders. Programs that build lower-body durability through club season, high school, and beyond.",
    focus: "ACL prevention · Single-leg strength · Endurance base",
  },
  {
    sport: "Hockey",
    desc: "Off-ice strength training that translates directly to skating power, shot velocity, and contact durability. Designed around your ice schedule.",
    focus: "Skating power · Core stability · Upper-body durability",
  },
  {
    sport: "Basketball",
    desc: "Vertical jump, lateral quickness, and ankle stability all come from strength — not plyometric gimmicks. Progressive programs that develop basketball-specific power safely.",
    focus: "Vertical power · Ankle stability · Lateral strength",
  },
  {
    sport: "Football",
    desc: "Functional strength for every position — from linemen needing anchor power to skill players needing explosive acceleration. Scaled to age, position, and experience.",
    focus: "Position-specific power · Neck safety · Speed foundation",
  },
  {
    sport: "Volleyball",
    desc: "Shoulder durability for repetitive overhead hitting, jump power for blocking, and core stability for passing. Programs that complement your club schedule.",
    focus: "Shoulder durability · Jump power · Core stability",
  },
  {
    sport: "Lacrosse",
    desc: "Rotational power for shooting, lower-body endurance for full-field play, and shoulder stability for stick work and contact.",
    focus: "Rotational power · Endurance · Contact prep",
  },
  {
    sport: "Track & Cross Country",
    desc: "Runners who strength train get injured less and run faster — period. Programs that improve stride efficiency, hip stability, and training resilience without adding bulk.",
    focus: "Hip stability · Stride power · Injury resilience",
  },
];

const SportOnlineTraining = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <SectionHeader
      title="Programs for Every Sport"
      timestamp="4-week & 8-week programs · Downloadable & printable"
    />

    <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 p-3 mb-4">
      <Wifi size={16} className="text-primary flex-shrink-0" />
      <p className="text-xs text-muted-foreground">
        <span className="text-foreground font-bold">Train from anywhere.</span> Every sport-specific program is available online. 
        Download and print as a PDF to keep forever. Matt designs programs around your equipment and space.
      </p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {SPORTS.map((s) => (
        <div key={s.sport} className="bg-card shadow-m2 p-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">
            {s.sport}
          </span>
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">{s.desc}</p>
          <span className="text-[10px] font-mono text-primary/70 block mb-2">{s.focus}</span>
          <Link
            to="/shop"
            className="text-[10px] font-bold text-primary hover:opacity-80 transition-m2"
          >
            View programs →
          </Link>
        </div>
      ))}
    </div>

    <Link
      to="/pricing"
      className="inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 mt-3"
    >
      Compare All Plans
      <ArrowRight size={14} />
    </Link>
  </motion.div>
);

export default SportOnlineTraining;
