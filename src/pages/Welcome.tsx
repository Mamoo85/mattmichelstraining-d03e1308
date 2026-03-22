import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Dumbbell,
  Zap,
  CheckCircle2,
} from "lucide-react";
import AppNavbar from "@/components/layout/AppNavbar";
import m2Logo from "@/assets/m2-logo.jpg";

const Welcome = () => (
  <div className="min-h-screen bg-background">
    <AppNavbar />
    <div className="container pt-20 pb-16 max-w-2xl mx-auto px-4">
      {/* HERO — tight & punchy */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <img src={m2Logo} alt="M² Training" className="w-20 mx-auto mb-3 object-contain rounded-lg ring-1 ring-border" />
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mb-2">
          You're In. <span className="text-primary">Let's Get to Work.</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Your free 2-week program is loaded. Real training starts now.
        </p>
      </motion.div>

      {/* CREDIBILITY — compact row */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="grid grid-cols-2 gap-2 mb-8"
      >
        {[
          "20+ years training experience",
          "50+ college athletes · 100% durability",
          "Tested, proven programs",
          "One app — everything you need",
        ].map((p) => (
          <div key={p} className="flex items-start gap-2 bg-card border border-border p-3">
            <CheckCircle2 size={12} className="text-primary flex-shrink-0 mt-0.5" />
            <span className="text-[11px] text-foreground leading-snug font-medium">{p}</span>
          </div>
        ))}
      </motion.div>

      {/* WHAT'S INCLUDED */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="space-y-3 mb-8"
      >
        <h2 className="text-xs font-black uppercase tracking-widest text-primary text-center">
          What's Inside Your Portal
        </h2>

        <div className="flex items-center gap-4 bg-card border border-border p-4">
          <Shield size={20} className="text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-foreground block">Parent? Link Your Child's Account</span>
            <span className="text-[11px] text-muted-foreground">Track workouts, message Coach Matt, video form checks</span>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-card border border-border p-4">
          <Dumbbell size={20} className="text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-foreground block">Programs Built by Matt</span>
            <span className="text-[11px] text-muted-foreground">Sport-specific or foundation. Real coaching, not an algorithm.</span>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-card border border-border p-4">
          <Zap size={20} className="text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-foreground block">All Technology Included</span>
            <span className="text-[11px] text-muted-foreground">Posture analysis, velocity tracking, nutrition scanning — in the app</span>
          </div>
        </div>
      </motion.div>

      {/* PRIMARY CTA — 2nd-to-last */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="mb-8"
      >
        <Link
          to="/dashboard"
          className="flex items-center justify-center gap-3 bg-primary text-primary-foreground w-full py-4 text-sm font-black uppercase tracking-widest hover:opacity-90 transition-all"
        >
          <Dumbbell size={18} />
          Start Your First Workout
          <ArrowRight size={18} />
        </Link>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          6 sessions · warmup → strength → rolling → mobility · Coach Matt reviews every log
        </p>
      </motion.div>

      {/* FOOTER */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-center"
      >
        <p className="text-[10px] text-muted-foreground">
          © {new Date().getFullYear()} M² Training · Grosse Pointe Park, MI · Real training, real results.
        </p>
      </motion.div>
    </div>
  </div>
);

export default Welcome;
