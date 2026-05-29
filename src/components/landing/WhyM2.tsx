import { motion } from "framer-motion";
import { Shield, Trophy, Zap } from "lucide-react";

const WhyM2 = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.2 }}
    className="mb-10"
  >
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="bg-card shadow-m2 p-5">
        <Shield size={20} className="text-primary mb-2" />
        <h3 className="text-sm font-bold text-foreground mb-1">Injury Prevention First</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Every program starts with joint health and connective tissue strength before chasing numbers. That's why my athletes stay on the field — not on the bench.
        </p>
      </div>
      <div className="bg-card shadow-m2 p-5">
        <Trophy size={20} className="text-primary mb-2" />
        <h3 className="text-sm font-bold text-foreground mb-1">50+ College Athletes. Zero Injuries.</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Most trainers move on to higher-paying clients. I stayed with young athletes for 20+ years. These programs are built on experience — not trends.
        </p>
      </div>
      <div className="bg-card shadow-m2 p-5">
        <Zap size={20} className="text-primary mb-2" />
        <h3 className="text-sm font-bold text-foreground mb-1">Strength Is the Foundation</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Speed and agility come from strength — not ladder drills. When an athlete gets stronger safely, everything improves: first-step quickness, change of direction, durability.
        </p>
      </div>
    </div>
  </motion.div>
);

export default WhyM2;
