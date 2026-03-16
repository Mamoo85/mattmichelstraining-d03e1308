import { motion } from "framer-motion";
import SectionHeader from "../SectionHeader";

const WeekendYouth = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <SectionHeader title="Weekend & Youth Programs" />
    <div className="bg-card shadow-m2 p-5 md:p-6">
      <h3 className="text-base font-bold text-foreground mb-2">Group classes coming soon</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Weekend rolling classes · Youth strength 14–16 · Youth strength 17–18
      </p>
      <a
        href="mailto:matthewmichels4@gmail.com?subject=Weekend%20%26%20Youth%20Early%20Access"
        className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
      >
        Sign up for early access →
      </a>
    </div>
  </motion.div>
);

export default WeekendYouth;
