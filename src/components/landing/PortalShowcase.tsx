import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Monitor, MessageSquare, TrendingUp, Shield, Zap, User } from "lucide-react";
import portalPrograms from "@/assets/portal-programs.png";
import portalChat from "@/assets/portal-chat.png";
import portalProgress from "@/assets/portal-progress.png";

const FEATURES = [
  {
    icon: Monitor,
    title: "Your program loads instantly",
    desc: "Buy a program → it appears in your portal with every exercise, set, and rep ready to log.",
    image: portalPrograms,
    alt: "M2 Training portal showing purchased program with exercise logging",
  },
  {
    icon: MessageSquare,
    title: "Message Matt on any exercise",
    desc: "Tap 'Ask Matt' on any lift. Upload a video. He sees it, replies personally.",
    image: portalChat,
    alt: "M2 Training lift chat showing conversation between athlete and Coach Matt",
  },
  {
    icon: TrendingUp,
    title: "Track every session",
    desc: "PR markers, estimated 1RMs, trend lines. Real numbers — not guesswork.",
    image: portalProgress,
    alt: "M2 Training progress chart showing strength gains over 8 weeks",
  },
];

const VALUE_POINTS = [
  { icon: User, text: "Matt personally reviews every athlete's logs" },
  { icon: Shield, text: "20 years. 50+ college athletes. Zero injuries." },
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
    <div className="mb-5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-2">
        What you actually get
      </span>
      <h3 className="text-xl md:text-2xl font-bold text-foreground leading-tight mb-2">
        A real coach in your corner.
      </h3>
      <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
        Every program comes with a training portal and direct access to Matt. Not a PDF and a "good luck."
      </p>
    </div>

    {/* Feature cards — vertical stack on mobile, 3-col on desktop */}
    <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-4 mb-5">
      {FEATURES.map((f) => (
        <div key={f.title} className="bg-card shadow-m2 overflow-hidden flex md:flex-col">
          {/* Screenshot — constrained, clean crop */}
          <div className="w-28 md:w-full shrink-0 bg-background overflow-hidden">
            <img
              src={f.image}
              alt={f.alt}
              className="w-full h-full md:h-48 object-cover object-top"
              loading="lazy"
            />
          </div>
          {/* Text */}
          <div className="p-3 flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <f.icon size={14} className="text-primary flex-shrink-0" />
              <span className="text-xs font-bold text-foreground leading-tight">{f.title}</span>
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
        <span className="text-foreground font-bold">Most online training is a template dressed up as coaching.</span> M² 
        is different because Matt actually coaches — starting at <span className="text-primary font-bold">$20</span> for a custom program.
      </p>
    </div>

    {/* Dual CTAs */}
    <div className="flex flex-col sm:flex-row gap-3">
      <Link
        to="/shop"
        className="inline-flex items-center justify-center gap-2 flex-1 bg-primary text-primary-foreground px-5 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        Browse Programs
        <ArrowRight size={14} />
      </Link>
      <Link
        to="/pricing"
        className="inline-flex items-center justify-center gap-2 flex-1 border-2 border-primary/40 text-primary px-5 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
      >
        Monthly Plans from $12.99
        <ArrowRight size={14} />
      </Link>
    </div>
  </motion.div>
);

export default PortalShowcase;
