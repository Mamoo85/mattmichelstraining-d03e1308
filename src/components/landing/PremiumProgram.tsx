import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import { useContentMap } from "@/hooks/useSiteContent";

const PremiumProgram = () => {
  const { content: c } = useContentMap("premium_program");

  const title = c.title || "Your Custom Strength Training Program — $20";
  const subtitle = c.subtitle || "Custom Strength Program · Built by Matt · Not a Template";
  const description = c.description || "You fill out the intake. Matt reads every word. Then he builds your program from scratch — your sport, your goals, your equipment, your level. No templates. No AI-generated workouts. Just 20 years of experience and a proven system for building stronger, more durable athletes of any age.";
  const price = c.price || "$20";
  const cta = c.cta || "Get Your Strength Program";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mb-10"
    >
      <div className="relative bg-primary/10 border-2 border-primary/40 p-5 md:p-6 overflow-hidden">
        <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1">
          <span className="text-[10px] font-bold uppercase tracking-widest">Most Popular</span>
        </div>

        <div className="flex items-start gap-2 mb-2">
          <Star size={18} className="text-primary flex-shrink-0 mt-0.5" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
            {subtitle}
          </span>
        </div>

        <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">{title}</h3>

        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{description}</p>

        <div className="flex items-end justify-between gap-4">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            {cta}
            <ArrowRight size={14} />
          </Link>
          <span className="text-2xl font-mono font-bold text-primary">{price}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default PremiumProgram;
