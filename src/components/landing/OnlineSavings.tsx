import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, DollarSign, MapPin, Wifi } from "lucide-react";

const COMPARISONS = [
  { label: "In-person trainer (1x/week)", cost: "$200–$600/mo", note: "National average for youth" },
  { label: "Group speed & agility class", cost: "$150–$300/mo", note: "Cookie-cutter drills" },
  { label: "Travel team S&C coach", cost: "$100–$250/mo", note: "Often seasonal only" },
];

const OnlineSavings = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.28 }}
    className="mb-10"
  >
    <div className="bg-card shadow-m2 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign size={18} className="text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
          Why Parents & Coaches Are Switching to Online Strength Training
        </span>
      </div>

      <h3 className="text-lg md:text-xl font-bold text-foreground mb-3">
        The same expertise. A fraction of the cost. Available anywhere.
      </h3>

      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        Most families spend $200–$600/month on in-person youth training — and still end up with generic programming.
        Matt's affordable online strength training programs deliver 20 years of experience direct to your phone,
        starting at <span className="text-foreground font-bold">$12.99/month</span>. No travel, no scheduling conflicts, 
        no geographic limits. Whether you're in Michigan, Texas, or California — your athlete gets the same 
        proven system that's produced 50+ college athletes with zero injuries.
      </p>

      {/* Cost comparison */}
      <div className="space-y-2 mb-4">
        {COMPARISONS.map((c) => (
          <div key={c.label} className="flex items-center justify-between bg-destructive/5 border border-destructive/15 p-3">
            <div>
              <span className="text-xs font-bold text-foreground block">{c.label}</span>
              <span className="text-[10px] text-muted-foreground">{c.note}</span>
            </div>
            <span className="text-sm font-mono font-bold text-destructive">{c.cost}</span>
          </div>
        ))}
        <div className="flex items-center justify-between bg-primary/10 border-2 border-primary/30 p-3">
          <div>
            <span className="text-xs font-bold text-foreground block">M² Online Strength Training</span>
            <span className="text-[10px] text-muted-foreground">Custom programming by a 20-year veteran · any sport · any state</span>
          </div>
          <span className="text-sm font-mono font-bold text-primary">$12.99–$42.99/mo</span>
        </div>
      </div>

      {/* Location callout */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex items-center gap-2 bg-secondary/50 p-3 flex-1">
          <MapPin size={16} className="text-primary flex-shrink-0" />
          <div>
            <span className="text-xs font-bold text-foreground block">In-person in Grosse Pointe</span>
            <span className="text-[10px] text-muted-foreground">Local families train at the M² gym</span>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-secondary/50 p-3 flex-1">
          <Wifi size={16} className="text-primary flex-shrink-0" />
          <div>
            <span className="text-xs font-bold text-foreground block">Online — anywhere in the U.S.</span>
            <span className="text-[10px] text-muted-foreground">Same programs, same coach, delivered to your phone</span>
          </div>
        </div>
      </div>

      <Link
        to="/pricing"
        className="inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        Compare Online Strength Training Plans
        <ArrowRight size={14} />
      </Link>
    </div>
  </motion.div>
);

export default OnlineSavings;
