import { motion } from "framer-motion";
import { Link } from "react-router-dom";
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
        Team Programs · 100% Online
      </span>
      <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">
        Full-roster strength programming for any team, any sport, any age.
      </h3>
      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
        Matt builds the strength and conditioning program for your entire roster — from middle school athletes learning their first squat 
        to adult rec leagues and master's athletes. Delivered online so any coach in any state can implement it. 
        No need to hire a full-time S&C staff.
      </p>
      <p className="text-xs text-primary font-bold mb-4">
        20+ years. 50+ college athletes. Zero injuries. Any sport. Any age. Any state.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/pricing"
          className="inline-flex items-center justify-center gap-2 flex-1 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          Team/Elite Plan — $149.99/mo
          <ArrowRight size={14} />
        </Link>
        <a
          href="mailto:matthewmichels4@gmail.com?subject=Team%20Strength%20Program%20Inquiry"
          className="inline-flex items-center justify-center gap-2 flex-1 border-2 border-primary/40 text-primary px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
        >
          Email Matt for Team Quote
        </a>
      </div>
    </div>
  </motion.div>
);

export default TeamYouthPrograms;
