import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const CurrentClients = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.2 }}
    className="mb-10"
  >
    <div className="bg-card shadow-m2 p-5 md:p-6">
      <span className="text-[11px] font-bold uppercase tracking-widest text-primary block mb-2">
        Current Clients
      </span>
      <h3 className="text-lg md:text-xl font-bold text-foreground mb-1">
        Already training with Matt?
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Log a lift · View progress · Book a session
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        Go to your portal
        <ArrowRight size={14} />
      </Link>
    </div>
  </motion.div>
);

export default CurrentClients;
