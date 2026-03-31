import { forwardRef } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Video, Eye, Trophy, ArrowRight, Lock } from "lucide-react";
import { Link } from "react-router-dom";

const STEPS = [
  {
    icon: Video,
    label: "Film It",
    desc: "Hit a new PR? Record the full lift. No video = no record.",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
  },
  {
    icon: Eye,
    label: "Coach Reviews",
    desc: "Matt personally watches every submission. Form, depth, lockout — all verified.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: ShieldCheck,
    label: "Approved or Denied",
    desc: "Only legit lifts get logged. Half reps don't count here.",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
];

const ProveItShowcase = forwardRef<HTMLElement>((_, ref) => (
  <motion.section
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className="relative overflow-hidden border-2 border-foreground/20 bg-gradient-to-br from-card via-background to-card"
  >
    {/* Glow */}
    <div className="absolute -top-24 right-0 w-56 h-56 bg-primary/8 rounded-full blur-[80px]" />

    <div className="relative p-5 sm:p-8 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center gap-1.5 bg-foreground text-background px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em]">
            <Lock size={10} /> Zero Cheating Policy
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-foreground leading-tight mb-2">
          You Don't Just Log a PR.<br />
          <span className="text-primary">You Prove It.</span>
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
          Every personal record requires video proof and coach approval. No half reps. No ego lifts. 
          No "trust me bro." If Coach Matt doesn't approve it, it doesn't count.
        </p>
      </div>

      {/* 3-step process */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STEPS.map((step, i) => (
          <div
            key={step.label}
            className={`border ${step.bg} p-4 space-y-2`}
          >
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-background/60 text-[10px] font-black text-foreground">
                {i + 1}
              </span>
              <step.icon size={16} className={step.color} />
            </div>
            <p className="text-xs font-black uppercase tracking-tight text-foreground">{step.label}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* Mock approval card */}
      <div className="bg-card border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Trophy size={12} className="text-primary" /> Recent Verified PRs
        </div>
        {[
          { lift: "Back Squat 3RM", weight: "315 lbs", status: "approved", note: "Full depth. Clean lockout. ✅" },
          { lift: "Bench Press 5RM", weight: "225 lbs", status: "approved", note: "Good pause. Solid. ✅" },
          { lift: "Deadlift 3RM", weight: "405 lbs", status: "denied", note: "Hitched at lockout. Resubmit. ❌" },
        ].map((pr) => (
          <div key={pr.lift} className="flex items-start gap-3 text-xs">
            <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${pr.status === "approved" ? "bg-green-500" : "bg-red-500"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{pr.lift}</span>
                <span className="font-mono text-primary text-[10px]">{pr.weight}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{pr.note}</p>
            </div>
            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 shrink-0 ${
              pr.status === "approved" 
                ? "bg-green-500/20 text-green-400" 
                : "bg-red-500/20 text-red-400"
            }`}>
              {pr.status}
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
        <Link
          to="/auth?redirect=/trial-welcome"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
        >
          Start 14-Day Free Trial <ArrowRight size={14} />
        </Link>
        <p className="text-[9px] text-muted-foreground">
          Real accountability. Real standards. Starting at $19.99/mo.
        </p>
      </div>
    </div>
  </motion.section>
));

ProveItShowcase.displayName = "ProveItShowcase";

export default ProveItShowcase;
