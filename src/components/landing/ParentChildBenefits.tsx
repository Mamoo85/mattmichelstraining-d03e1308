import { memo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, TrendingUp, Heart, Zap, Users } from "lucide-react";
import ParentChildManager from "@/components/features/ParentChildManager";

const BENEFITS = [
  { icon: Shield, title: "Full Visibility", desc: "See every workout your athlete logs — sets, reps, weights, and coach feedback." },
  { icon: TrendingUp, title: "Progress Tracking", desc: "Monitor strength gains, recovery trends, and training consistency over time." },
  { icon: Heart, title: "Independent Tiers", desc: "Choose different subscription levels for yourself and each linked athlete." },
  { icon: Zap, title: "Direct Coach Access", desc: "Flag exercises for Matt's review and message him directly from the portal." },
] as const;

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const BenefitsGrid = memo(() => (
  <motion.div {...fade(0.25)} className="mb-12">
    <div className="flex items-center gap-2 mb-4">
      <Users size={18} className="text-primary" />
      <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
        Why Link Your Parent Account
      </h2>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {BENEFITS.map((b) => (
        <div key={b.title} className="bg-card shadow-m2 p-5">
          <b.icon size={20} className="text-primary mb-2" />
          <h3 className="text-sm font-bold text-foreground mb-1">{b.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
        </div>
      ))}
    </div>
  </motion.div>
));
BenefitsGrid.displayName = "BenefitsGrid";

const ParentPortalSection = ({ user }: { user: any }) => {
  if (user) {
    return (
      <motion.div {...fade(0.3)} className="mb-12" id="parent-portal">
        <div className="bg-card shadow-m2 p-5 md:p-6">
          <ParentChildManager />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div {...fade(0.3)} className="mb-12" id="parent-portal">
      <div className="bg-card shadow-m2 p-6 text-center">
        <Users size={32} className="mx-auto text-primary mb-3" />
        <h3 className="text-sm font-bold text-foreground mb-2">Parent Portal — Link Your Child's Account</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
          Sign in or create a free account to set up a linked child account.
          Monitor their progress, flag questions for Matt, and track their development — all from your dashboard.
        </p>
        <Link
          to="/auth?redirect=/for-parents"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          Sign In / Create Account
          <ArrowRight size={14} />
        </Link>
      </div>
    </motion.div>
  );
};

export { BenefitsGrid, ParentPortalSection };
