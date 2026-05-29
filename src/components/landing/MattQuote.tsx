import { motion } from "framer-motion";

const MattQuote = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <div className="border-l-4 border-primary bg-card shadow-m2 p-5 md:p-6">
      <p className="text-base md:text-lg italic text-muted-foreground leading-relaxed">
        "Your only competition is who you were yesterday."
      </p>
      <span className="text-xs font-bold text-primary mt-2 block">— M² Training</span>
    </div>
  </motion.div>
);

export default MattQuote;
