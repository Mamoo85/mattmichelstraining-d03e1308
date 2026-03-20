import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Cpu, Zap, Camera, Brain, ArrowRight, ChevronRight } from "lucide-react";

const TECH_ITEMS = [
  { icon: Camera, label: "Posture Analysis", color: "text-[hsl(var(--synth-cyan))]" },
  { icon: Zap, label: "Velocity-Based Training", color: "text-[hsl(var(--synth-orange))]" },
  { icon: Brain, label: "Nutrition Scanner", color: "text-[hsl(var(--synth-pink))]" },
  { icon: Cpu, label: "Smart Workout Logger", color: "text-primary" },
];

const TechShowcaseCard = () => (
  <motion.section
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className="mb-10"
  >
    <Link to="/the-edge" className="block group">
      <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(var(--synth-bg))] to-card border border-border hover:border-primary/40 transition-all duration-300">
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-500" />
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-[hsl(var(--synth-cyan))]/10 rounded-full blur-2xl" />

        <div className="relative p-5 md:p-6">
          {/* Badge */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-1">
              <Cpu size={12} className="text-primary" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-primary">
                The M² Edge
              </span>
            </div>
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
              Technology Suite
            </span>
          </div>

          <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground mb-2 group-hover:text-primary transition-colors">
            Training Technology That's 5 Years Ahead
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4 max-w-lg">
            Advanced posture analysis, real-time velocity tracking, instant nutrition scanning, and smart workout logging — all running on your phone. No extra hardware needed.
          </p>

          {/* Tech pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {TECH_ITEMS.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-1.5 bg-secondary/60 px-2.5 py-1.5 border border-border"
              >
                <item.icon size={12} className={item.color} />
                <span className="text-[10px] font-bold text-foreground">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary group-hover:gap-2.5 transition-all">
            Explore All Technology <ArrowRight size={12} />
          </div>
        </div>
      </div>
    </Link>
  </motion.section>
);

export default TechShowcaseCard;
