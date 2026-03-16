import { motion } from "framer-motion";
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
        Team & Youth Strength Programs
      </span>
      <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">
        Affordable youth strength training for any team, any sport, any age.
      </h3>
      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
        Custom strength and conditioning programs built specifically for your team — from middle school athletes learning their first proper squat to high school varsity preparing for college recruitment. Matt builds the program, teaches your coaching staff how to deliver it, or trains the team directly. Whether it's youth soccer strength training, a baseball pre-season program, or hockey off-season conditioning — the focus is always building stronger, more durable athletes who stay injury-free.
      </p>
      <p className="text-xs text-primary font-bold mb-4">
        20+ years developing youth athletes. 50+ college athletes produced. Zero injuries. Results speak louder than marketing.
      </p>
      <a
        href="mailto:matthewmichels4@gmail.com?subject=Team%20Strength%20Program%20Inquiry"
        className="inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        Get a Team Strength Program
        <ArrowRight size={14} />
      </a>
    </div>
  </motion.div>
);

export default TeamYouthPrograms;
