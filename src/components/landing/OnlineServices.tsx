import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Wifi } from "lucide-react";
import SectionHeader from "../SectionHeader";

const OnlineServices = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <SectionHeader title="Online Training Plans" timestamp="Available anywhere · Month-to-month · Cancel anytime" />

    <div className="bg-primary/5 border border-primary/15 p-4 mb-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        <span className="text-foreground font-bold">Why is it more affordable?</span> No gym lease, no marketing team, no overhead. 
        Just 20 years of experience delivered direct to your phone. You get better programming for less — whether you're in Grosse Pointe or across the country.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-3 mb-3">
      <div className="bg-card shadow-m2 p-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Basic</span>
        <span className="text-lg font-mono font-bold text-foreground block">$12.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">Monthly Focus Plan + 85+ exercise library with sport-specific filters + challenges</p>
      </div>
      <div className="bg-card shadow-m2 p-4 border-2 border-primary/30 relative">
        <div className="absolute -top-2 right-2 bg-primary text-primary-foreground text-[8px] font-bold uppercase px-2 py-0.5">Popular</div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Pro</span>
        <span className="text-lg font-mono font-bold text-foreground block">$25.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">Custom programs + Fix It rehab library + flag Matt for form review</p>
      </div>
      <div className="bg-card shadow-m2 p-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Elite</span>
        <span className="text-lg font-mono font-bold text-foreground block">$42.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">1-on-1 monthly check-ins + priority coaching + direct messaging</p>
      </div>
      <div className="bg-card shadow-m2 p-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Team</span>
        <span className="text-lg font-mono font-bold text-foreground block">$84.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">Full-roster programming for coaches & organizations</p>
      </div>
    </div>

    <div className="flex items-center gap-2 bg-secondary/50 p-3 mb-3">
      <Wifi size={14} className="text-primary flex-shrink-0" />
      <span className="text-[10px] text-muted-foreground">
        <span className="text-foreground font-bold">100% online.</span> Works from home, a school gym, or any facility. No geographic limits.
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

export default OnlineServices;
