import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Dumbbell,
  Zap,
  CheckCircle2,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  Trophy,
  Users,
  Smartphone,
} from "lucide-react";
import AppNavbar from "@/components/layout/AppNavbar";
import m2Logo from "@/assets/m2-logo.jpg";

const isLocalArrival =
  new URLSearchParams(window.location.search).get("src") === "local";

/* ─── Lane 1 — Local / Google Maps arrival ─── */
const LocalLane = () => (
  <>
    {/* HERO */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center mb-8"
    >
      <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mb-2">
        Grosse Pointe's <span className="text-primary">Strength Coach.</span>
      </h1>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Youth athletes. Adults. Real programming. No guesswork.
      </p>
      <div className="flex gap-3 justify-center mt-5">
        <Link
          to="/schedule"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
        >
          <Calendar size={16} />
          Schedule a Session
        </Link>
        <a
          href="sms:3138064952"
          className="inline-flex items-center gap-2 border border-primary text-primary px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-all"
        >
          <MessageSquare size={16} />
          Text Matt Now
        </a>
      </div>
    </motion.div>

    {/* WHAT MATT DOES */}
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="space-y-3 mb-8"
    >
      <h2 className="text-xs font-black uppercase tracking-widest text-primary text-center">
        What Matt Does
      </h2>

      {[
        {
          icon: Trophy,
          title: "Youth Sports Performance",
          desc: "High school and college prep. Squat, bench, deadlift, speed. Sport-specific programming that keeps athletes healthy and fast.",
        },
        {
          icon: Users,
          title: "Adult Strength Training",
          desc: "Not a weight loss gym. This is for people who want to get genuinely strong and stay that way.",
        },
        {
          icon: Smartphone,
          title: "Online Coaching",
          desc: "Can't make it to the studio? Full coaching via the app. Programs, form checks, and AI tools — all remote.",
        },
      ].map((c) => (
        <div
          key={c.title}
          className="flex items-start gap-4 bg-card border border-border p-4"
        >
          <c.icon size={20} className="text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-foreground block">
              {c.title}
            </span>
            <span className="text-[11px] text-muted-foreground leading-snug">
              {c.desc}
            </span>
          </div>
        </div>
      ))}
    </motion.div>

    {/* QUICK CONTACT STRIP */}
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4 }}
      className="grid grid-cols-4 gap-2 mb-8"
    >
      {[
        { icon: Phone, label: "Call", href: "tel:3138064952" },
        { icon: MessageSquare, label: "Text", href: "sms:3138064952" },
        { icon: Mail, label: "Email", href: "mailto:matthewmichels4@gmail.com" },
        { icon: Calendar, label: "Schedule", href: "/schedule", isLink: true },
      ].map((b) =>
        b.isLink ? (
          <Link
            key={b.label}
            to={b.href}
            className="flex flex-col items-center gap-1.5 bg-card border border-border py-3 hover:border-primary transition-all"
          >
            <b.icon size={18} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
              {b.label}
            </span>
          </Link>
        ) : (
          <a
            key={b.label}
            href={b.href}
            className="flex flex-col items-center gap-1.5 bg-card border border-border py-3 hover:border-primary transition-all"
          >
            <b.icon size={18} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
              {b.label}
            </span>
          </a>
        )
      )}
    </motion.div>

    {/* SHORT BIO */}
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="bg-card border border-border p-5 mb-8"
    >
      <p className="text-sm text-foreground leading-relaxed">
        <span className="font-black">20 years. 50+ college athletes. Zero training injuries.</span>{" "}
        Based in Grosse Pointe Park — training adults and athletes who want to
        get strong and stay strong.
      </p>
    </motion.div>
  </>
);

/* ─── Lane 3 — App / default arrival ─── */
const AppLane = () => (
  <>
    {/* HERO */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center mb-8"
    >
      <img
        src={m2Logo}
        alt="M2 Training"
        className="w-20 mx-auto mb-3 object-contain rounded-lg ring-1 ring-border"
      />
      <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mb-2">
        You're In. <span className="text-primary">Let's Get to Work.</span>
      </h1>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Your free 2-week program is loaded. Real training starts now.
      </p>
    </motion.div>

    {/* CREDIBILITY */}
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
        <div
          key={p}
          className="flex items-start gap-2 bg-card border border-border p-3"
        >
          <CheckCircle2
            size={12}
            className="text-primary flex-shrink-0 mt-0.5"
          />
          <span className="text-[11px] text-foreground leading-snug font-medium">
            {p}
          </span>
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
          <span className="text-sm font-bold text-foreground block">
            Parent? Link Your Child's Account
          </span>
          <span className="text-[11px] text-muted-foreground">
            Track workouts, message Coach Matt, video form checks
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card border border-border p-4">
        <Dumbbell size={20} className="text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-foreground block">
            Programs Built by Matt
          </span>
          <span className="text-[11px] text-muted-foreground">
            Sport-specific or foundation. Real coaching, not an algorithm.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card border border-border p-4">
        <Zap size={20} className="text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-foreground block">
            All Technology Included
          </span>
          <span className="text-[11px] text-muted-foreground">
            Posture analysis, velocity tracking, nutrition scanning — in the app
          </span>
        </div>
      </div>
    </motion.div>

    {/* PRIMARY CTA */}
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
        6 sessions · warmup → strength → rolling → mobility · Coach Matt
        reviews every log
      </p>
    </motion.div>
  </>
);

/* ─── Welcome Page ─── */
const Welcome = () => (
  <div className="min-h-screen bg-background">
    <AppNavbar />
    <div className="container pt-20 pb-16 max-w-2xl mx-auto px-4">
      {isLocalArrival ? <LocalLane /> : <AppLane />}

      {/* SHARED FOOTER */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-center"
      >
        <p className="text-[10px] text-muted-foreground">
          © {new Date().getFullYear()} M2 Training · Grosse Pointe Park, MI ·
          Real training, real results.
        </p>
      </motion.div>
    </div>
  </div>
);

export default Welcome;
