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
    <SectionHeader title="The Problem" timestamp="And how I solved it" />
    <div className="bg-card shadow-m2 p-5 space-y-4">
      {/* The scarcity hook */}
      <div className="bg-primary/10 border border-primary/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={16} className="text-primary" />
          <p className="text-xs font-bold text-primary uppercase tracking-widest">Here's My Problem</p>
        </div>
        <p className="text-sm text-foreground text-balance leading-relaxed">
          I can only train so many athletes in person. There are only so many hours in a day, and I will
          <span className="font-bold"> never</span> sacrifice quality by overloading my schedule.
          Every athlete I train gets my full attention. That's non-negotiable.
        </p>
      </div>

      {/* The solution */}
      <p className="text-sm text-foreground text-balance leading-relaxed">
        But after 20+ years, I've built a system that works.
        <span className="text-primary font-bold"> Every single time.</span> And I realized I could share that system —
        not just the <em>what to do</em>, but the <span className="font-bold">WHY</span> behind every rep,
        every set, every rest period. Because when athletes understand <em>why</em> they're doing something,
        they do it better. 100% of the time.
      </p>

      {/* Value proposition cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-muted p-4">
          <Lightbulb size={16} className="text-primary mb-2" />
          <h4 className="text-xs font-bold text-foreground mb-1">Not Just What — Why</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Every exercise comes with the reasoning behind it. When they understand the why,
            they execute better, recover smarter, and stay injury-free.
          </p>
        </div>
        <div className="bg-muted p-4">
          <DollarSign size={16} className="text-primary mb-2" />
          <h4 className="text-xs font-bold text-foreground mb-1">$20 for 20+ Years</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Two decades of knowledge, custom-built for your athlete. Not a template.
            Not a PDF from the internet. Matt reads your intake and writes it personally.
          </p>
        </div>
        <div className="bg-muted p-4">
          <BookOpen size={16} className="text-primary mb-2" />
          <h4 className="text-xs font-bold text-foreground mb-1">Knowledge That Transfers</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            This isn't a one-time workout. It's an education. Your athlete learns principles
            they'll carry through college and beyond.
          </p>
        </div>
      </div>

      {/* The close */}
      <div className="bg-card border border-border p-4 text-center">
        <p className="text-sm text-foreground font-semibold mb-1">
          "I can't train everyone in person. But I can share what I know."
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          20+ years of strength training knowledge, custom-built for your athlete — for less than a pizza.
        </p>
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
