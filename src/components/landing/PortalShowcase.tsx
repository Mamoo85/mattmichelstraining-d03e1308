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
    desc: "Buy a program → it appears in your portal with every exercise, set, and rep ready to log. No PDFs to manage.",
    image: portalPrograms,
    alt: "M2 Training portal showing purchased program with exercise logging",
  },
  {
    icon: MessageSquare,
    title: "Message Matt on any exercise",
    desc: "Tap 'Ask Matt' on any lift. Upload a video. He sees it, replies personally. Not a chatbot — Matt.",
    image: portalChat,
    alt: "M2 Training lift chat showing conversation between athlete and Coach Matt",
  },
  {
    icon: TrendingUp,
    title: "Track every session",
    desc: "PR markers, estimated 1RMs, trend lines. See the progress in real numbers — not guesswork.",
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
    <div className="mb-6">
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-2">
        What you actually get
      </span>
      <h3 className="text-xl md:text-2xl font-bold text-foreground leading-tight mb-2">
        A real coach in your corner.<br className="hidden sm:block" /> Not a PDF and a "good luck."
      </h3>
      <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
        Every program comes with a training portal and direct access to Matt. He reads every message, 
        reviews every log, and coaches your athlete like they're in his gym. The only difference is location.
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
        <span className="text-foreground font-bold">Most online training is a template dressed up as coaching.</span> M² 
        is different because Matt actually coaches. He builds your program around your athlete's sport, body, and goals. 
        He watches their numbers. He answers their questions — personally. Everything you'd get training in his gym, 
        you get here — starting at <span className="text-primary font-bold">$15</span> for a guide or <span className="text-primary font-bold">$20</span> for a custom program.
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
