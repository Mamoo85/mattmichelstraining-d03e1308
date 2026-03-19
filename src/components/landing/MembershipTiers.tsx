import { memo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, GraduationCap } from "lucide-react";

const MEMBERSHIP_TIERS = [
  {
    name: "Basic",
    price: "$14.99/mo",
    highlights: [
      "Full exercise library access (200+ exercises)",
      "10 pre-loaded training workouts",
      "Monthly Focus Plan with tracking",
      "Progress logging & coach feedback",
    ],
    cta: "Start 14-Day Free Trial",
    link: "/auth?redirect=/trial-welcome",
    accent: false,
  },
  {
    name: "Foundation",
    price: "$39.99/mo",
    highlights: [
      "Everything in Basic",
      "8-week periodized training blocks",
      "Fix It rehab & recovery library",
      "Monthly 'Real Deal' newsletter",
    ],
    cta: "Start 14-Day Free Trial",
    link: "/auth?redirect=/trial-welcome",
    accent: true,
  },
  {
    name: "Custom",
    price: "$99.99/mo",
    highlights: [
      "Everything in Foundation",
      "1-on-1 video movement assessment",
      "Advanced biomechanics tracking",
      "Priority coach messaging",
    ],
    cta: "Start 14-Day Free Trial",
    link: "/auth?redirect=/trial-welcome",
    accent: false,
  },
] as const;

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const MembershipTiers = memo(() => (
  <motion.div {...fade(0.15)} className="mb-12">
    <div className="flex items-center gap-2 mb-4">
      <GraduationCap size={18} className="text-primary" />
      <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
        Membership Plans for Your Athlete
      </h2>
    </div>
    <p className="text-sm text-muted-foreground mb-6 max-w-2xl leading-relaxed">
      Every plan includes a 14-day free trial. Pick the level that fits your athlete — upgrade or cancel anytime.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {MEMBERSHIP_TIERS.map((t) => (
        <div key={t.name} className={`bg-card shadow-m2 p-5 flex flex-col relative overflow-hidden ${t.accent ? "ring-2 ring-primary" : ""}`}>
          {t.accent && (
            <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest text-center py-1">
              Most Popular
            </div>
          )}
          <div className={t.accent ? "mt-4" : ""}>
            <h3 className="text-base font-bold text-foreground mb-0.5">{t.name}</h3>
            <p className="text-lg font-mono font-bold text-primary mb-3">{t.price}</p>
            <ul className="space-y-2 mb-4 flex-1">
              {t.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                  <ChevronRight size={10} className="text-primary mt-0.5 flex-shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
            <Link
              to={t.link}
              className={`inline-flex items-center justify-center gap-2 w-full py-2.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                t.accent
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border border-primary/40 text-primary hover:bg-primary/10"
              }`}
            >
              {t.cta}
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      ))}
    </div>
    <p className="text-[10px] text-muted-foreground mt-3 text-center">
      <Link to="/pricing" className="text-primary hover:opacity-80 transition-m2">View full plan comparison →</Link>
    </p>
  </motion.div>
));

MembershipTiers.displayName = "MembershipTiers";

export default MembershipTiers;
