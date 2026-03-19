import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import athleteBaseball from "@/assets/athlete-baseball.jpg";
import athleteFootball from "@/assets/athlete-football.jpg";
import athleteSoccer from "@/assets/athlete-soccer.jpg";
import athleteHockey from "@/assets/athlete-hockey.jpg";
import athleteSmallGroup from "@/assets/athlete-smallgroup.jpg";

const SPORTS = [
  { name: "Baseball", image: athleteBaseball, tag: "Arm care + explosiveness" },
  { name: "Football", image: athleteFootball, tag: "Speed & power" },
  { name: "Soccer", image: athleteSoccer, tag: "Durability + agility" },
  { name: "Hockey", image: athleteHockey, tag: "Full-body strength" },
  { name: "Small Group", image: athleteSmallGroup, tag: "1–4 athletes" },
];

const SportPicker = () => (
  <motion.section
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className="mb-10"
  >
    <div className="mb-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
        Built for your sport
      </span>
      <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground">
        What do you play?
      </h2>
    </div>

    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
      {SPORTS.map((s) => (
        <Link
          key={s.name}
          to="/shop"
          className="group relative overflow-hidden bg-card border border-border hover:border-primary/60 transition-all"
        >
          <div className="aspect-[3/4] overflow-hidden">
            <img
              src={s.image}
              alt={`${s.name} training`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          </div>
          <div className="absolute bottom-0 inset-x-0 p-2">
            <span className="text-xs font-black uppercase tracking-tight text-foreground block leading-tight">
              {s.name}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-widest text-primary">
              {s.tag}
            </span>
          </div>
        </Link>
      ))}
    </div>

    <Link
      to="/shop"
      className="flex items-center justify-center gap-2 mt-3 text-[10px] font-bold uppercase tracking-widest text-primary hover:gap-3 transition-all"
    >
      Don't see your sport? We train everything <ArrowRight size={10} />
    </Link>
  </motion.section>
);

export default SportPicker;
