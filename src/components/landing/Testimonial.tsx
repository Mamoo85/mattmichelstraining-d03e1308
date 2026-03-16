import { motion } from "framer-motion";
import { Quote } from "lucide-react";

const Testimonial = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.5 }}
    className="mb-10"
  >
    <div className="bg-card shadow-m2 p-5 md:p-6 border-l-4 border-primary">
      <Quote size={20} className="text-primary mb-3 opacity-60" />
      <p className="text-sm md:text-base italic text-muted-foreground leading-relaxed mb-3">
        "My son trained with Matt for three years. He walked on at Michigan as a freshman and started by his junior year. Matt didn't just make him stronger — he made him durable. Three years of college ball, zero time missed to injury."
      </p>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">KR</span>
        </div>
        <div>
          <span className="text-xs font-bold text-foreground block">Parent of D1 Athlete</span>
          <span className="text-[10px] text-muted-foreground">Grosse Pointe, MI</span>
        </div>
      </div>
    </div>
  </motion.div>
);

export default Testimonial;
