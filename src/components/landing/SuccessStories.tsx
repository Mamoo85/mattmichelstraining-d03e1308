import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import athleteFootball from "@/assets/athlete-football.jpg";
import athleteSoccer from "@/assets/athlete-soccer.jpg";
import athleteBaseball from "@/assets/athlete-baseball.jpg";
import athleteLacrosse from "@/assets/athlete-lacrosse.jpg";

const STORIES = [
  {
    name: "GP South Athlete",
    sport: "Football",
    image: athleteFootball,
    quote: "Matt's programming took my squat from 225 to 315 in one off-season. Movement and mechanics first — that's the M² difference.",
    result: "+90 lb Squat",
  },
  {
    name: "M² Client",
    sport: "Soccer",
    image: athleteSoccer,
    quote: "First time I feel fast AND strong. Went from JV to starting varsity after one summer with Coach Matt.",
    result: "JV → Varsity",
  },
  {
    name: "College Commit",
    sport: "Baseball",
    image: athleteBaseball,
    quote: "Matt fixed mechanics no one else even noticed. One of 50+ college athletes developed at M² Training.",
    result: "College Commit",
  },
  {
    name: "Comeback Story",
    sport: "Strength",
    image: athleteLacrosse,
    quote: "Tore my ACL sophomore year. Matt got me back stronger than before — movement, mechanics, mindset.",
    result: "Full Recovery",
  },
];
const SuccessStories = () => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.25 }}
    className="mb-10"
  >
    <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
      Real Athletes, Real Results
    </span>
    <h3 className="text-lg font-bold text-foreground mb-4">
      Success Stories
    </h3>

    <div className="grid grid-cols-2 gap-3">
      {STORIES.map((s) => (
        <div key={s.name} className="bg-card border border-border overflow-hidden shadow-m2">
          {/* Photo */}
          <div className="aspect-square overflow-hidden relative">
            <img
              src={s.image}
              alt={`${s.name} — ${s.sport}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* Sport tag */}
            <span className="absolute top-2 left-2 bg-primary/90 text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-2 py-0.5">
              {s.sport}
            </span>
            {/* Result badge */}
            <span className="absolute bottom-2 right-2 bg-background/90 text-primary text-[10px] font-bold font-mono px-2 py-0.5 border border-primary/30">
              {s.result}
            </span>
          </div>

          {/* Quote */}
          <div className="p-3">
            <Quote size={10} className="text-primary mb-1" />
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-2 line-clamp-3">
              {s.quote}
            </p>
            <span className="text-[10px] font-bold text-foreground uppercase tracking-widest">
              {s.name}
            </span>
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

export default SuccessStories;
