import { motion } from "framer-motion";
import SectionHeader from "../SectionHeader";

const WordsFromMatt = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <SectionHeader title="Words from Matt" />
    <div className="bg-card shadow-m2 p-5 md:p-6">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Every session counts. Every rep matters. Whether you're here to fix something broken, build something new,
        or just figure out where to start — you're in the right place. Let's get to work.
      </p>
    </div>
  </motion.div>
);

export default WordsFromMatt;
