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
        <h3 className="text-sm font-bold text-foreground mb-1">Zero Injuries. Ever.</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Healthy joints and healthy minds first. They all get strong — I promise.
        </p>
      </div>
      <div className="bg-card shadow-m2 p-5">
        <Trophy size={20} className="text-primary mb-2" />
        <h3 className="text-sm font-bold text-foreground mb-1">50+ College Athletes</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Most trainers move up. I stayed with young athletes for 20+ years. That's why it works.
        </p>
      </div>
      <div className="bg-card shadow-m2 p-5">
        <Zap size={20} className="text-primary mb-2" />
        <h3 className="text-sm font-bold text-foreground mb-1">The WHY, Not Just The What</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Every guide teaches the reasoning. When they understand why, they do it better. 100% of the time.
        </p>
      </div>
    </div>
  </motion.div>
);

export default WhyM2;
