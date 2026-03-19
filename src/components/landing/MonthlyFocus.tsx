import { motion } from "framer-motion";
import SectionHeader from "../SectionHeader";

const MonthlyFocus = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <div className="flex items-center gap-3 mb-4">
      <div className="w-1 h-8 bg-primary rounded-full" />
      <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">
        Monthly Focus
      </h2>
    </div>
    <div className="bg-card shadow-m2 border-l-4 border-primary p-5 md:p-6">
      <h3 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground mb-2">
        March: Posterior Chain
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        We're fixing the chain reaction: tight hips, weak glutes, rounded lower back.
        If you sit all day, this month is for you.
      </p>
    </div>
  </motion.div>
);

export default MonthlyFocus;
