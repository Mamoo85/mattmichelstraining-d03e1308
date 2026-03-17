import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Gift, Star, Trophy, Dumbbell } from "lucide-react";

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
          <h3 className="text-base md:text-lg font-bold text-foreground mb-1">Free With Every Account</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            No subscription needed. Create a free account and you immediately get:
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <div className="flex items-center gap-2">
          <Star size={14} className="text-primary flex-shrink-0" />
          <span className="text-xs text-foreground">Monthly Focus Plans from Matt</span>
        </div>
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-primary flex-shrink-0" />
          <span className="text-xs text-foreground">Member Challenges & Leaderboard</span>
        </div>
        <div className="flex items-center gap-2">
          <Dumbbell size={14} className="text-primary flex-shrink-0" />
          <span className="text-xs text-foreground">Full Workout Logging & Progress Tracking</span>
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
