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
        Custom Program · $20
      </span>
      <h3 className="text-lg font-bold text-foreground mb-2">Your Custom Workout</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        Matt reads your intake and builds a program from scratch — specific to your goals, equipment, and level.
      </p>
      <Link
        to="/shop"
        className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
      >
        Get yours →
      </Link>
    </div>
  </motion.div>
);

export default CustomProgram;
