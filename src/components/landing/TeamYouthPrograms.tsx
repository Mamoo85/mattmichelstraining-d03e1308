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
        Team & Youth Strength Programs · Online or In-Person
      </span>
      <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">
        Affordable youth strength training for any team, any sport, any age — anywhere.
      </h3>
      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
        Custom strength and conditioning programs built specifically for your team — from middle school athletes learning their first proper squat 
        to high school varsity preparing for college recruitment. Matt builds the program and delivers it online so any coach, in any state, 
        can implement proven strength training without hiring a full-time S&C staff. Whether it's youth soccer, baseball, hockey, football, 
        or volleyball — the focus is always building stronger, more durable athletes who stay injury-free.
      </p>
      <p className="text-xs text-primary font-bold mb-4">
        20+ years developing youth athletes. 50+ college athletes produced. Zero injuries. Available online nationwide.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/pricing"
          className="inline-flex items-center justify-center gap-2 flex-1 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          View Team Plan — $84.99/mo
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
