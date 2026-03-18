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
    <SectionHeader title="Online Training Plans" timestamp="1-on-1 coaching without the 1-on-1 price · Cancel anytime" />

    <div className="bg-primary/5 border border-primary/15 p-4 mb-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        <span className="text-foreground font-bold">I train everyone.</span> Youth athletes, parents who want to train with their kids, adults who haven't lifted in 20 years, coaches who want to practice what they preach. 
        The foundation doesn't change — your body needs the same movements at 15 or 55. In-gym training runs $40–$150/session. Online coaching packages cost $100–$300/mo. 
        My subscription starts at $12.99/mo — same expertise, no overhead.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-3 mb-3">
      <div className="bg-card shadow-m2 p-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Basic</span>
        <span className="text-lg font-mono font-bold text-foreground block">$12.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">My full 85+ exercise library filtered by level, sport & focus. 20 years of science, distilled.</p>
      </div>
      <div className="bg-card shadow-m2 p-4 border-2 border-primary/30 relative">
        <div className="absolute -top-2 right-2 bg-primary text-primary-foreground text-[8px] font-bold uppercase px-2 py-0.5">Popular</div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Pro</span>
        <span className="text-lg font-mono font-bold text-foreground block">$25.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">Custom programs + Fix It rehab library + flag Matt for form review. In person or online.</p>
      </div>
      <div className="bg-card shadow-m2 p-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Elite</span>
        <span className="text-lg font-mono font-bold text-foreground block">$42.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">1-on-1 monthly check-ins + priority coaching + direct messaging with Matt</p>
      </div>
      <div className="bg-card shadow-m2 p-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">Team</span>
        <span className="text-lg font-mono font-bold text-foreground block">$84.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
        <p className="text-[11px] text-muted-foreground mt-1">Full-roster programming for coaches & organizations. Any sport, any state.</p>
      </div>
    </div>

    <div className="flex items-center gap-2 bg-secondary/50 p-3 mb-3">
      <Wifi size={14} className="text-primary flex-shrink-0" />
      <span className="text-[10px] text-muted-foreground">
        <span className="text-foreground font-bold">100% online.</span> Works from home, a school gym, or any facility. Any age. Any level. No geographic limits.
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
