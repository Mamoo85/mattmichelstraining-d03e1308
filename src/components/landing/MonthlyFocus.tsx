import { motion } from "framer-motion";
import SectionHeader from "../SectionHeader";

const MonthlyFocus = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <SectionHeader title="Monthly Focus" />
    <div className="bg-card shadow-m2 p-5 md:p-6">
      <h3 className="text-base md:text-lg font-bold text-foreground mb-2">March: Posterior Chain</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Posterior chain. We're fixing the chain reaction: tight hips, weak glutes, rounded lower back.
        If you sit all day, this month is specifically for you.
      </p>
    </div>
  </motion.div>
);

export default MonthlyFocus;
