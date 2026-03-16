import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Gift, Star, Trophy, Users } from "lucide-react";

const FreeBonusBanner = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.6 }}
    className="mb-10"
  >
    <div className="bg-primary/10 border-2 border-primary/30 p-5 md:p-6">
      <div className="flex items-start gap-3 mb-3">
        <Gift size={22} className="text-primary flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-base md:text-lg font-bold text-foreground mb-1">Free When You Sign Up</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Create a free account, log your workouts with Matt, and get access to{" "}
            <span className="text-foreground font-semibold">monthly focus plans</span> and{" "}
            <span className="text-foreground font-semibold">member challenges</span> — no subscription needed.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <div className="flex items-center gap-2">
          <Star size={14} className="text-primary flex-shrink-0" />
          <span className="text-xs text-foreground">Monthly Focus Plans</span>
        </div>
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-primary flex-shrink-0" />
          <span className="text-xs text-foreground">Member Challenges</span>
        </div>
        <div className="flex items-center gap-2">
          <Users size={14} className="text-primary flex-shrink-0" />
          <span className="text-xs text-foreground">Challenge Suggestions</span>
        </div>
      </div>
      <Link
        to="/auth"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 mt-4"
      >
        Create Free Account
        <ArrowRight size={14} />
      </Link>
    </div>
  </motion.div>
);

export default FreeBonusBanner;
