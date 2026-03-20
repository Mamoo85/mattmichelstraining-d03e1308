import { motion } from "framer-motion";
import { Lock, DollarSign, BookOpen, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";
import SectionHeader from "./SectionHeader";

const ValuePitch = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
  >
    <SectionHeader title="Why This Exists" timestamp="Straight from Matt" />
    <div className="bg-card shadow-m2 p-5 space-y-4">
      <div className="bg-primary/10 border border-primary/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={16} className="text-primary" />
          <p className="text-xs font-bold text-primary uppercase tracking-widest">The Reality</p>
        </div>
        <p className="text-sm text-foreground leading-relaxed">
          I can only train so many athletes in person. I'll <span className="font-bold">never</span> sacrifice quality by overloading my schedule.
        </p>
      </div>

      <p className="text-sm text-foreground leading-relaxed">
        After 20+ years, I've built a system that works — <span className="text-primary font-bold">every time.</span> So I put it online. Not just the <em>what</em>, but the <span className="font-bold">WHY</span>. When athletes understand why, they execute better. 100% of the time.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-muted p-4">
          <Lightbulb size={16} className="text-primary mb-2" />
          <h4 className="text-xs font-bold text-foreground mb-1">The WHY Behind Every Rep</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Better execution, smarter recovery, fewer injuries.
          </p>
        </div>
        <div className="bg-muted p-4">
          <DollarSign size={16} className="text-primary mb-2" />
          <h4 className="text-xs font-bold text-foreground mb-1">20 Years for $20</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Not a template. Matt reads your intake and writes it himself.
          </p>
        </div>
        <div className="bg-muted p-4">
          <BookOpen size={16} className="text-primary mb-2" />
          <h4 className="text-xs font-bold text-foreground mb-1">Knowledge That Lasts</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Principles your athlete carries through college and beyond.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border p-4 text-center">
        <p className="text-sm text-foreground font-semibold mb-1">
          "I can't train everyone in person. But I can give you exactly what I'd give them."
        </p>
        <p className="text-xs text-muted-foreground mb-3">Same system. Same coaching. Starting at $20.</p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          Get Your Custom Program · $20
        </Link>
      </div>
    </div>
  </motion.div>
);

export default ValuePitch;
