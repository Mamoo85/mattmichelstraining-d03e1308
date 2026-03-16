import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SectionHeader from "../SectionHeader";

const OnlineServices = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <SectionHeader title="Online Training Plans" timestamp="15% below every competitor. Same quality." />

    <div className="bg-primary/5 border border-primary/15 p-4 mb-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        <span className="text-foreground font-bold">Why is Matt cheaper?</span> No fancy office, no marketing team, no overhead.
        Just 20 years of experience delivered direct. You get better training for less — and Matt still makes a living.
        Month-to-month. Cancel anytime. No contracts.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-3 mb-3">
      <div className="bg-card shadow-m2 p-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Basic</span>
        <span className="text-lg font-mono font-bold text-foreground block">$12.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">Newsletter + exercise library</p>
      </div>
      <div className="bg-card shadow-m2 p-4 border-2 border-primary/30 relative">
        <div className="absolute -top-2 right-2 bg-primary text-primary-foreground text-[8px] font-bold uppercase px-2 py-0.5">Popular</div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Pro</span>
        <span className="text-lg font-mono font-bold text-foreground block">$25.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">Custom programs + Fix It library</p>
      </div>
      <div className="bg-card shadow-m2 p-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Elite</span>
        <span className="text-lg font-mono font-bold text-foreground block">$42.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">1-on-1 check-ins with Matt</p>
      </div>
      <div className="bg-card shadow-m2 p-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Team</span>
        <span className="text-lg font-mono font-bold text-foreground block">$84.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">Bulk programming for coaches</p>
      </div>
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

export default OnlineServices;
