import { motion } from "framer-motion";
import { Newspaper, ExternalLink } from "lucide-react";

const PRESS = [
  {
    outlet: "Grosse Pointe News — Pointer of Interest",
    title: "Strength in Motion: How One Trainer Turned Passion into Purpose",
    quote: "During the past 15 years, he has trained numerous teams at Grosse Pointe South High School and developed more than 50 college-level athletes. His approach is simple but effective: Focus on movement, mechanics and mindset rather than trends and shortcuts.",
    url: "https://www.grossepointenews.com/articles/strength-in-motion-how-one-trainer-turned-passion-into-purpose/",
    date: "Feb 27, 2025",
  },
];

const PressAuthority = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.45 }}
    className="mb-10"
  >
    {PRESS.map((p) => (
      <a
        key={p.title}
        href={p.url}
        target="_blank"
        rel="noreferrer"
        className="block bg-card shadow-m2 p-5 md:p-6 hover:bg-m2-surface-hover transition-m2 group"
      >
        <div className="flex items-start gap-3">
          <Newspaper size={20} className="text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                {p.outlet}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">{p.date}</span>
            </div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-m2 mb-2">
              "{p.title}"
            </h3>
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              "{p.quote}"
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] text-primary font-bold mt-2">
              Read full article <ExternalLink size={10} />
            </span>
          </div>
        </div>
      </a>
    ))}
  </motion.div>
);

export default PressAuthority;
