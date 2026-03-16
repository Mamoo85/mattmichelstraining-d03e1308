import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const TeamYouthPrograms = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.25 }}
    className="mb-10"
  >
    <div className="bg-card shadow-m2 p-5 md:p-6">
      <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-2">
        Team & Youth Programs
      </span>
      <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">
        Any team. Any sport. Any age.
      </h3>
      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
        Custom one-time programs built specifically for your team — from middle school all the way through college.
        Matt builds the program for your coach to deliver, comes on-site to teach it, or trains the team directly.
        A day, a week, a month — whatever you need.
      </p>
      <p className="text-xs text-primary font-bold mb-4">
        20+ years developing athletes. 50+ college athletes produced. Zero injuries. Guaranteed results.
      </p>
      <a
        href="mailto:matthewmichels4@gmail.com?subject=Team%20Program%20Inquiry"
        className="inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        I Can Do That
        <ArrowRight size={14} />
      </a>
    </div>
  </motion.div>
);

export default TeamYouthPrograms;
