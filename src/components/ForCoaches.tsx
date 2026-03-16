import { motion } from "framer-motion";
import { Users, Target, Award } from "lucide-react";
import SectionHeader from "./SectionHeader";

const ForCoaches = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.15, ease: [0.2, 0, 0, 1] }}
  >
    <SectionHeader title="For Coaches & Athletic Directors" timestamp="Your team's competitive edge" />
    <div className="bg-card shadow-m2 p-5 space-y-4">
      <p className="text-sm text-foreground text-balance leading-relaxed">
        Your athletes are only as good as the foundation under them. If they're getting hurt every season,
        if they're slowing down by playoffs, if the weight room isn't translating to the field —
        <span className="font-bold text-primary"> that's a strength programming problem.</span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-muted p-3">
          <Users size={16} className="text-primary mb-2" />
          <h4 className="text-xs font-bold text-foreground mb-1">Team Programs</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Custom one-time programs built for your team's sport, age, and competition schedule. Matt builds it, teaches your staff to deliver it, or trains the team directly.
          </p>
        </div>
        <div className="bg-muted p-3">
          <Target size={16} className="text-primary mb-2" />
          <h4 className="text-xs font-bold text-foreground mb-1">Injury Prevention</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            20+ years. Zero injuries. Matt's system prioritizes work capacity and joint health so your athletes make it through the season — and through college.
          </p>
        </div>
        <div className="bg-muted p-3">
          <Award size={16} className="text-primary mb-2" />
          <h4 className="text-xs font-bold text-foreground mb-1">Proven at Every Level</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            50+ athletes trained for college. Middle school through D-I. Matt has stayed in the trenches with this age group for over two decades while everyone else moved on.
          </p>
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/10 p-4">
        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">For Athletic Directors</p>
        <p className="text-sm text-foreground text-balance leading-relaxed">
          "I'll come to your facility, evaluate your current strength program, and tell you exactly what's working
          and what isn't. No pitch, no sell. If I can help, I'll tell you how. If I can't, I'll tell you that too.
          I've been doing this too long to waste anyone's time."
        </p>
        <span className="text-[10px] font-mono text-primary mt-2 block">— Matt Michels</span>
      </div>

      <a
        href="mailto:matthewmichels4@gmail.com?subject=Team%20Training%20Inquiry"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        Contact Matt About Your Team
      </a>
    </div>
  </motion.div>
);

export default ForCoaches;
