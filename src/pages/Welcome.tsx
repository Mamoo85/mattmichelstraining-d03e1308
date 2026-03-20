import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Dumbbell,
  Users,
  Zap,
  CheckCircle2,
  Eye,
  MessageCircle,
  Video,
} from "lucide-react";
import AppNavbar from "@/components/AppNavbar";
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
        <img src={m2Logo} alt="M² Training" className="w-20 mx-auto mb-3 object-contain" />
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mb-2">
          You're In. <span className="text-primary">Let's Get to Work.</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Your free 2-week program is loaded. Real training starts now.
        </p>
      </motion.div>

      {/* PRIMARY CTA — big, unmissable */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
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

      {/* CREDIBILITY — compact row */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="grid grid-cols-2 gap-2 mb-8"
      >
        {[
          "20+ years training experience",
          "50+ college athletes · 0 injuries",
          "Tested, proven programs",
          "One app — everything you need",
        ].map((p) => (
          <div key={p} className="flex items-start gap-2 bg-card border border-border p-3">
            <CheckCircle2 size={12} className="text-primary flex-shrink-0 mt-0.5" />
            <span className="text-[11px] text-foreground leading-snug font-medium">{p}</span>
          </div>
        ))}
      </motion.div>

      {/* WHAT'S NEXT — three clear paths */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="space-y-3 mb-8"
      >
        <h2 className="text-xs font-black uppercase tracking-widest text-primary text-center">
          What You Can Do Right Now
        </h2>

        {/* Parent CTA */}
        <Link
          to="/for-parents"
          className="flex items-center gap-4 bg-primary/10 border-2 border-primary/30 p-4 hover:border-primary/60 transition-colors group"
        >
          <Shield size={20} className="text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-foreground block">Parent? Link Your Child's Account</span>
            <span className="text-[11px] text-muted-foreground">Track workouts, message Coach Matt, video form checks</span>
          </div>
          <ArrowRight size={16} className="text-primary flex-shrink-0 group-hover:translate-x-1 transition-transform" />
        </Link>

        {/* Shop Programs */}
        <Link
          to="/shop"
          className="flex items-center gap-4 bg-card border border-border p-4 hover:border-primary/40 transition-colors group"
        >
          <Dumbbell size={20} className="text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-foreground block">Grab a Custom Program — from $20</span>
            <span className="text-[11px] text-muted-foreground">Sport-specific or foundation. Built by Matt, not an algorithm.</span>
          </div>
          <ArrowRight size={16} className="text-muted-foreground flex-shrink-0 group-hover:translate-x-1 transition-transform" />
        </Link>

        {/* Upgrade */}
        <Link
          to="/pricing"
          className="flex items-center gap-4 bg-card border border-border p-4 hover:border-primary/40 transition-colors group"
        >
          <Zap size={20} className="text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-foreground block">Upgrade to Full Membership</span>
            <span className="text-[11px] text-muted-foreground">Starting at $14.99/mo — less than a gym membership</span>
          </div>
          <ArrowRight size={16} className="text-muted-foreground flex-shrink-0 group-hover:translate-x-1 transition-transform" />
        </Link>
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
