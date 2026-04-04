import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Wifi } from "lucide-react";
import SectionHeader from "@/components/shared/SectionHeader";
import { useExerciseCount } from "@/hooks/useExerciseCount";

const OnlineServices = () => {
  const exerciseCount = useExerciseCount();
  return (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <SectionHeader title="Online Training Plans" timestamp="Expert coaching without the in-person price" />

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
      <div className="bg-card shadow-m2 p-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Foundation</span>
        <span className="text-lg font-mono font-bold text-foreground block">$19.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">Full M2 App, {exerciseCount}+ exercise library, Fix It rehab, AI Generator.</p>
      </div>
      <div className="bg-card shadow-m2 p-4 border-2 border-primary/30 relative">
        <div className="absolute -top-2 right-2 bg-primary text-primary-foreground text-[8px] font-bold uppercase px-2 py-0.5">Popular</div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Pro</span>
        <span className="text-lg font-mono font-bold text-foreground block">$149.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">Custom 4-week block + 2 weekly video form-checks from Matt.</p>
      </div>
      <div className="bg-card shadow-m2 p-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Elite</span>
        <span className="text-lg font-mono font-bold text-foreground block">$349.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">White-glove 1-on-1 coaching. Daily messaging. Bespoke programming.</p>
      </div>
    </div>

    <div className="flex items-center gap-2 bg-secondary/50 p-3 mb-3">
      <Wifi size={14} className="text-primary flex-shrink-0" />
      <span className="text-[10px] text-muted-foreground">
        <span className="text-foreground font-bold">100% online.</span> Any age. Any level. No geographic limits.
      </span>
    </div>

    <Link
      to="/pricing"
      className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 w-full justify-center"
    >
      Compare All Plans
      <ArrowRight size={14} />
    </Link>
  </motion.div>
  );
};

export default OnlineServices;
