import { motion } from "framer-motion";
import { TrendingUp, Trophy, Zap, Target } from "lucide-react";

const RESULTS = [
  {
    icon: TrendingUp,
    stat: "JV → Varsity",
    name: "Sophomore, Baseball",
    quote: "Went from JV backup to varsity starter after one off-season with Matt.",
  },
  {
    icon: Trophy,
    stat: "D1 Commit",
    name: "Senior, Lacrosse",
    quote: "The strength gains got college coaches' attention. Committed junior year.",
  },
  {
    icon: Zap,
    stat: "+4 mph Velo",
    name: "Junior, Baseball",
    quote: "Throwing harder and staying healthy for the first full season in 3 years.",
  },
  {
    icon: Target,
    stat: "All-State",
    name: "Senior, Soccer",
    quote: "Outworked everyone on the field. Matt's program gave me that edge.",
  },
];

const AthleteResults = () => (
  <motion.section
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className="mb-10"
  >
    <div className="mb-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
        Real athletes. Real results.
      </span>
      <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground">
        What happens when you train with M²
      </h2>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {RESULTS.map((r) => (
        <div
          key={r.stat}
          className="bg-card border border-border p-4 flex gap-3"
        >
          <div className="w-10 h-10 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <r.icon size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-black text-primary font-mono block leading-none mb-0.5">
              {r.stat}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              {r.name}
            </span>
            <p className="text-xs text-foreground leading-relaxed italic">
              "{r.quote}"
            </p>
          </div>
        </div>
      ))}
    </div>
  </motion.section>
);

export default AthleteResults;
