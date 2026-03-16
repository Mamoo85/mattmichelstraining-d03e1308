import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const CustomProgram = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <div className="bg-card shadow-m2 p-5 md:p-6">
      <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-1">
        Custom Strength Program · $20
      </span>
      <h3 className="text-lg font-bold text-foreground mb-2">Affordable Custom Strength Training — Built for Your Athlete</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        Matt reads your intake and builds a strength training program from scratch — specific to your athlete's sport, goals, equipment, and training level.
        Whether it's a youth baseball player building arm durability, a soccer player developing lower-body strength, or a middle school athlete
        starting their first structured strength program — every rep has a purpose.
      </p>
      <Link
        to="/shop"
        className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
      >
        Get your custom strength program →
      </Link>
    </div>
  </motion.div>
);

export default CustomProgram;
