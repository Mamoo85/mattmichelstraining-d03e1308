import { motion } from "framer-motion";
import { Wrench } from "lucide-react";

const CanFixIt = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <div className="bg-primary/10 border-2 border-primary/30 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <Wrench size={22} className="text-primary flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-base md:text-lg font-bold text-foreground mb-1">I Can Fix It</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Stuck? Something hurts? Need a workout?
          </p>
          <a
            href="mailto:matthewmichels4@gmail.com?subject=I%20Can%20Fix%20It"
            className="text-sm text-primary font-bold hover:opacity-80 transition-m2"
          >
            Pay what you feel →
          </a>
        </div>
      </div>
    </div>
  </motion.div>
);

export default CanFixIt;
