import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Shield, AlertTriangle, ArrowRight, Users } from "lucide-react";

const ForParentsCTA = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className="mb-10"
  >
    <div className="bg-gradient-to-r from-destructive/10 via-primary/10 to-primary/5 border-2 border-primary/30 p-6 md:p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="flex items-start gap-4 relative z-10">
        <div className="bg-destructive/20 p-3 flex-shrink-0 hidden sm:flex">
          <AlertTriangle size={24} className="text-destructive" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono">
              For Parents of Young Athletes
            </span>
          </div>
          <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">
            3.5 Million Youth Injuries Per Year. 50% Are Preventable.
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-xl">
            Matt's Youth Foundation Programs teach your child how to move correctly, build real strength,
            and take care of their body for life. Every program includes a FREE postural assessment.
            Zero injuries in 20 years of training youth athletes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/for-parents"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
            >
              Learn More — For Parents
              <ArrowRight size={14} />
            </Link>
            <Link
              to="/shop"
              onClick={() => setTimeout(() => window.dispatchEvent(new CustomEvent("switch-shop-tab", { detail: "store" })), 100)}
              className="inline-flex items-center gap-2 border-2 border-primary/40 text-primary px-5 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
            >
              <Shield size={12} />
              View Foundation Programs
            </Link>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

export default ForParentsCTA;
