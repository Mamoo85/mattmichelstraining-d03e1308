import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Wifi } from "lucide-react";
import SectionHeader from "../SectionHeader";

const SPORTS = [
  {
    sport: "Baseball & Softball",
    keywords: "youth baseball strength training online",
    desc: "Rotator cuff durability, hip rotation power, and arm care programming that prevents the overuse injuries plaguing youth pitchers and catchers. Online strength programs built around your season schedule.",
    focus: "Shoulder health · Hip power · Arm care",
  },
  {
    sport: "Soccer",
    keywords: "online strength training for youth soccer players",
    desc: "ACL prevention starts with hamstring and glute strength — not agility ladders. Matt's online soccer strength programs build the lower-body durability that keeps players on the pitch through club season, high school, and beyond.",
    focus: "ACL prevention · Single-leg strength · Endurance base",
  },
  {
    sport: "Hockey",
    keywords: "affordable youth hockey strength program",
    desc: "Off-ice strength training that translates directly to skating power, shot velocity, and contact durability. Online programs designed around your athlete's ice schedule so training enhances performance — never competes with it.",
    focus: "Skating power · Core stability · Upper-body durability",
  },
  {
    sport: "Basketball",
    keywords: "online strength training for youth basketball",
    desc: "Vertical jump, lateral quickness, and ankle stability all come from strength — not plyometric gimmicks. Matt builds progressive online programs that develop basketball-specific power safely over time.",
    focus: "Vertical power · Ankle stability · Lateral strength",
  },
  {
    sport: "Football",
    keywords: "affordable youth football strength conditioning",
    desc: "Functional strength for every position — from linemen needing anchor power to skill players needing explosive acceleration. Online programs scaled to age, position, and experience level.",
    focus: "Position-specific power · Neck safety · Speed foundation",
  },
  {
    sport: "Volleyball",
    keywords: "youth volleyball strength training online",
    desc: "Shoulder durability for repetitive overhead hitting, jump power for blocking, and core stability for passing. Online strength programs that complement your club practice schedule.",
    focus: "Shoulder durability · Jump power · Core stability",
  },
  {
    sport: "Lacrosse",
    keywords: "online lacrosse strength training for youth",
    desc: "Rotational power for shooting, lower-body endurance for full-field play, and shoulder stability for stick work and contact. Available online for athletes training anywhere.",
    focus: "Rotational power · Endurance · Contact prep",
  },
  {
    sport: "Track & Cross Country",
    keywords: "strength training for youth runners online",
    desc: "Runners who strength train get injured less and run faster — period. Matt builds complementary online strength programs that improve stride efficiency, hip stability, and training resilience without adding unnecessary bulk.",
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
      title="Online Strength Training — Every Sport"
      timestamp="Affordable programs delivered to your phone · Any state"
    />

    <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 p-3 mb-4">
      <Wifi size={16} className="text-primary flex-shrink-0" />
      <p className="text-xs text-muted-foreground">
        <span className="text-foreground font-bold">Train from anywhere.</span> Every sport-specific program below is available as an online strength training subscription or a one-time $9 guide. 
        No gym required — Matt designs programs around your equipment and space.
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
          <div className="flex items-center gap-3">
            <Link
              to="/shop"
              className="text-[10px] font-bold text-primary hover:opacity-80 transition-m2"
            >
              Guide · $9 →
            </Link>
            <Link
              to="/pricing"
              className="text-[10px] font-bold text-primary hover:opacity-80 transition-m2"
            >
              Online plan · from $12.99/mo →
            </Link>
          </div>
        </div>
      ))}
    </div>

    <Link
      to="/pricing"
      className="inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 mt-3"
    >
      Compare All Online Strength Plans
      <ArrowRight size={14} />
    </Link>
  </motion.div>
);

export default SportOnlineTraining;
