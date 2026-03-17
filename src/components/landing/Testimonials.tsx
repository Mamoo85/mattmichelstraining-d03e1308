import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    quote: "My son started with Matt at 13. Two years later he's the strongest kid on his baseball team and hasn't missed a game to injury. Matt teaches him how to take care of his body — not just lift weights.",
    name: "Sarah M.",
    role: "Parent · Grosse Pointe",
    sport: "Baseball",
  },
  {
    quote: "I've worked with online coaches before and they send you a PDF and disappear. Matt actually watches my videos, replies the same day, and adjusts my program. It's not even close to the same thing.",
    name: "Jake R.",
    role: "College Athlete · Remote",
    sport: "Football",
  },
  {
    quote: "We were spending $200/month on a trainer who had our daughter doing the same exercises as adults. Matt's youth program is age-appropriate, affordable, and she actually enjoys it.",
    name: "Lisa & Tom K.",
    role: "Parents · St. Clair Shores",
    sport: "Soccer",
  },
];

const Testimonials = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.1 }}
    className="mb-10"
  >
    <div className="mb-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
        What Parents & Athletes Say
      </span>
      <h2 className="text-lg md:text-xl font-bold text-foreground">
        Real results from real families
      </h2>
    </div>

    <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-4">
      {TESTIMONIALS.map((t) => (
        <div key={t.name} className="bg-card shadow-m2 p-5 flex flex-col">
          <Quote size={18} className="text-primary/40 mb-2" />
          <p className="text-sm text-muted-foreground leading-relaxed flex-1 italic">
            "{t.quote}"
          </p>
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-1 mb-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={10} className="text-primary fill-primary" />
              ))}
            </div>
            <span className="text-xs font-bold text-foreground block">{t.name}</span>
            <span className="text-[10px] text-muted-foreground">{t.role}</span>
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

export default Testimonials;
