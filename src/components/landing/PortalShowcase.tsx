import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Monitor, MessageSquare, TrendingUp, Shield, Zap, User } from "lucide-react";
import portalPrograms from "@/assets/portal-programs.png";
import portalChat from "@/assets/portal-chat.png";
import portalProgress from "@/assets/portal-progress.png";

const FEATURES = [
  {
    icon: Monitor,
    title: "Your program, ready to go",
    desc: "Purchase a program and it loads into your portal instantly — exercises, sets, reps, all ready to log.",
    image: portalPrograms,
    alt: "M2 Training portal showing purchased program with exercise logging",
  },
  {
    icon: MessageSquare,
    title: "Direct line to Matt",
    desc: "Tap 'Ask Matt' on any lift. He sees it, replies personally, and you get notified. Not a bot — Matt.",
    image: portalChat,
    alt: "M2 Training lift chat showing conversation between athlete and Coach Matt",
  },
  {
    icon: TrendingUp,
    title: "Watch the gains stack up",
    desc: "Every session tracked. PR markers, estimated 1RMs, and trend lines that prove it's working.",
    image: portalProgress,
    alt: "M2 Training progress chart showing strength gains over 8 weeks",
  },
];

const VALUE_POINTS = [
  { icon: User, text: "Matt personally reviews every athlete's progress" },
  { icon: Shield, text: "20 years of injury-free training methodology" },
  { icon: Zap, text: "Programs built for your sport, level, and equipment" },
];

const PortalShowcase = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.32 }}
    className="mb-10"
  >
    {/* Header */}
    <div className="mb-6">
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-2">
        What makes M² different
      </span>
      <h3 className="text-xl md:text-2xl font-bold text-foreground leading-tight mb-2">
        A real coach. In your corner.<br className="hidden sm:block" /> For less than a gym membership.
      </h3>
      <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
        Other online programs hand you a PDF and disappear. At M², every program comes with a training portal 
        and a direct line to Matt Michels — a coach who's spent 20 years developing 50+ college athletes 
        without a single injury. He reads every message, reviews every log, and coaches your athlete 
        like they're standing in his gym.
      </p>
    </div>

    {/* Feature cards with screenshots */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
      {FEATURES.map((f) => (
        <div key={f.title} className="bg-card shadow-m2 overflow-hidden">
          <div className="aspect-[9/16] max-h-[280px] overflow-hidden bg-background">
            <img
              src={f.image}
              alt={f.alt}
              className="w-full h-full object-cover object-top"
              loading="lazy"
            />
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <f.icon size={14} className="text-primary flex-shrink-0" />
              <span className="text-xs font-bold text-foreground">{f.title}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        </div>
      ))}
    </div>

    {/* Value points */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
      {VALUE_POINTS.map((v) => (
        <div key={v.text} className="flex items-center gap-2 bg-primary/5 border border-primary/10 p-3">
          <v.icon size={14} className="text-primary flex-shrink-0" />
          <span className="text-[11px] text-foreground font-medium">{v.text}</span>
        </div>
      ))}
    </div>

    {/* The pitch */}
    <div className="bg-card shadow-m2 border-l-4 border-primary p-5 mb-5">
      <p className="text-sm text-muted-foreground leading-relaxed">
        <span className="text-foreground font-bold">Here's the truth:</span> Most online training is a template 
        dressed up as coaching. M² is different because Matt actually coaches. He builds your program around 
        your athlete's sport, body, and goals. He watches their numbers. He answers their questions — personally. 
        The only things missing are his squat rack and his jokes. Everything else you'd get training in his gym, 
        you get here — starting at <span className="text-primary font-bold">$9</span>.
      </p>
    </div>

    {/* Dual CTAs */}
    <div className="flex flex-col sm:flex-row gap-3">
      <Link
        to="/shop"
        className="inline-flex items-center justify-center gap-2 flex-1 bg-primary text-primary-foreground px-5 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        Get a Custom Program — $20
        <ArrowRight size={14} />
      </Link>
      <Link
        to="/pricing"
        className="inline-flex items-center justify-center gap-2 flex-1 border-2 border-primary/40 text-primary px-5 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
      >
        Subscribe from $12.99/mo
        <ArrowRight size={14} />
      </Link>
    </div>
  </motion.div>
);

export default PortalShowcase;
