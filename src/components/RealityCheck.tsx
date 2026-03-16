import { motion } from "framer-motion";
import SectionHeader from "./SectionHeader";

const RealityCheck = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.1, ease: [0.2, 0, 0, 1] }}
  >
    <SectionHeader title="Why Your Athlete Is Getting Hurt" />
    <div className="bg-card shadow-m2 p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-destructive/10 border border-destructive/20 p-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-destructive block mb-1">#1 Reason</span>
          <span className="text-sm font-bold text-foreground">Lack of sleep</span>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 p-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-destructive block mb-1">#2 Reason</span>
          <span className="text-sm font-bold text-foreground">Bad or excessive training</span>
        </div>
      </div>

      <p className="text-sm text-foreground text-balance leading-relaxed">
        Most kids today are rushing the process, but rushing actually makes you slower.
        In my professional opinion, the body needs 72 hours minimum to recover — especially
        when they're up all night on their phones.
      </p>
      <p className="text-sm text-foreground text-balance leading-relaxed">
        At M² Training, I prioritize healthy joints and mental resilience over ego numbers on a board.
        We build work capacity step-by-step so they can dominate in college, not just survive senior year.
      </p>

      <div className="bg-primary/10 border border-primary/20 p-4">
        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">The Deal</p>
        <p className="text-sm text-foreground font-semibold">
          Let me handle the strength protocol. You handle the bedtime. They will get strong. I promise.
        </p>
      </div>
    </div>
  </motion.div>
);

export default RealityCheck;
