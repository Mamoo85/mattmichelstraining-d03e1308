import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Monitor, MessageSquare, TrendingUp, Bell } from "lucide-react";
import portalPrograms from "@/assets/portal-programs.png";
import portalChat from "@/assets/portal-chat.png";
import portalProgress from "@/assets/portal-progress.png";

const FEATURES = [
  {
    icon: Monitor,
    title: "Your program loads automatically",
    desc: "Buy a guide or custom program — it appears in your portal instantly. Every exercise, set, and rep is ready to log.",
    image: portalPrograms,
    alt: "M2 Training portal showing purchased program with exercise logging",
  },
  {
    icon: MessageSquare,
    title: "Ask Matt about any lift",
    desc: "Confused about form? Not sure if you should add weight? Tap 'Ask Matt' on any lift. He gets notified, replies, and you get notified back.",
    image: portalChat,
    alt: "M2 Training lift chat showing conversation between athlete and Coach Matt",
  },
  {
    icon: TrendingUp,
    title: "Watch your athlete get stronger",
    desc: "Progress charts show every lift trending over time. PR markers, session-over-session changes, and estimated 1RMs — all automatic.",
    image: portalProgress,
    alt: "M2 Training progress chart showing strength gains over 8 weeks",
  },
];

const PortalShowcase = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.32 }}
    className="mb-10"
  >
    <div className="flex items-center gap-2 mb-2">
      <Bell size={18} className="text-primary" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
        What You Get — The M² Athlete Portal
      </span>
    </div>
    <h3 className="text-lg md:text-xl font-bold text-foreground mb-1">
      Buy a program. It's in your portal. Log it. Matt watches.
    </h3>
    <p className="text-sm text-muted-foreground mb-6 max-w-2xl leading-relaxed">
      Every program you purchase automatically loads into your training portal. Log weights, track progress over time, 
      and ask Matt questions directly on any lift — he gets notified instantly and replies right there. 
      This is Matt. Not an AI. Not a chatbot. Not a template response. When your athlete has a question about form, 
      loading, or why something hurts — Matt answers personally and walks them through it like he's standing right 
      there. The only things they don't get are his equipment and his sense of humor (and he's hilarious). 
      No other online training program at this price gives your kid direct access to a 20-year veteran coach.
    </p>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      {FEATURES.map((f) => (
        <div key={f.title} className="bg-card shadow-m2 overflow-hidden">
          <div className="aspect-[9/16] max-h-[320px] overflow-hidden bg-background">
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

    <div className="bg-primary/10 border border-primary/20 p-4 mb-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        <span className="text-foreground font-bold">This is what $9–$20 gets you:</span> Not just a PDF — a full training system 
        with a real coach on the other end. Your program loads into the portal, you log every session, Matt personally 
        reviews your progress and leaves coaching notes, and your athlete can ask questions on any lift. Matt runs this. 
        He reads every message. He guides your kid through every issue they hit — almost like he's right there with them, 
        at a fraction of the cost of in-person training. No other platform does this. Period.
      </p>
    </div>

    <div className="flex flex-col sm:flex-row gap-3">
      <Link
        to="/shop"
        className="inline-flex items-center justify-center gap-2 flex-1 bg-primary text-primary-foreground px-5 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        Get a Program — Starts at $9
        <ArrowRight size={14} />
      </Link>
      <Link
        to="/auth"
        className="inline-flex items-center justify-center gap-2 flex-1 border-2 border-primary/40 text-primary px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
      >
        Create Free Account
      </Link>
    </div>
  </motion.div>
);

export default PortalShowcase;
