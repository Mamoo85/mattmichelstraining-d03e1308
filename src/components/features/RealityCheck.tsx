import { motion } from "framer-motion";
import SectionHeader from "@/components/shared/SectionHeader";

const RealityCheck = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.1, ease: [0.2, 0, 0, 1] }}
  >
    <SectionHeader title="Why Your Athlete Is Getting Hurt" timestamp="The reality check most trainers won't give you" />
    <div className="bg-card shadow-m2 p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-destructive/10 border border-destructive/20 p-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-destructive block mb-1">#1 Reason</span>
          <span className="text-sm font-bold text-foreground">Lack of sleep</span>
          <p className="text-[10px] text-muted-foreground mt-1">Up all night on their phones. Their bodies can't recover.</p>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 p-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-destructive block mb-1">#2 Reason</span>
          <span className="text-sm font-bold text-foreground">Bad or excessive training</span>
          <p className="text-[10px] text-muted-foreground mt-1">Rushing the process. More reps ≠ more results.</p>
        </div>
      </div>

      <p className="text-sm text-foreground text-balance leading-relaxed">
        Most kids today are rushing the process, but rushing actually makes you slower.
        In my professional opinion, the body needs <span className="font-bold">72 hours minimum</span> to recover —
        especially when they're up all night on their phones instead of sleeping.
      </p>

      <p className="text-sm text-foreground text-balance leading-relaxed">
        At M² Training, I prioritize <span className="text-primary font-semibold">healthy joints and mental resilience</span> over
        ego numbers on a board. We build work capacity step-by-step so they can
        <span className="font-semibold"> dominate in college</span>, not just survive senior year.
      </p>

      <div className="bg-muted p-4">
        <p className="text-xs font-bold text-foreground uppercase tracking-widest mb-2">What Other Programs Get Wrong</p>
        <ul className="space-y-2 text-[11px] text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-destructive font-bold mt-0.5">✕</span>
            High-rep "burnout" workouts that exhaust athletes without building real strength
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive font-bold mt-0.5">✕</span>
            Cookie-cutter programs not designed for developing bodies
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive font-bold mt-0.5">✕</span>
            Training every day without proper recovery windows
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive font-bold mt-0.5">✕</span>
            Chasing numbers on a board instead of building pain-free athletes
          </li>
        </ul>
      </div>

      <div className="bg-primary/10 border border-primary/20 p-4">
        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">The M² Way</p>
        <p className="text-sm text-foreground font-semibold text-balance">
          Let me handle the strength protocol. You handle the bedtime.
          They will get strong. I promise.
        </p>
      </div>
    </div>
  </motion.div>
);

export default RealityCheck;
