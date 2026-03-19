import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import portalPrograms from "@/assets/portal-programs.png";
import portalChat from "@/assets/portal-chat.png";
import portalProgress from "@/assets/portal-progress.png";

const FEATURES = [
  {
    title: "Your program loads instantly",
    desc: "Buy a program → it appears in your portal with every exercise, set, and rep ready to log.",
    image: portalPrograms,
    alt: "M2 Training portal showing purchased program",
  },
  {
    title: "Message Matt on any exercise",
    desc: "Tap 'Ask Matt' on any lift. Upload a video. He sees it, replies personally.",
    image: portalChat,
    alt: "Coach chat between athlete and Coach Matt",
  },
  {
    title: "Track every session",
    desc: "PR markers, estimated 1RMs, trend lines. Real numbers — not guesswork.",
    image: portalProgress,
    alt: "Progress chart showing strength gains",
  },
];

const M2Difference = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.2 }}
    className="mb-10"
  >
    <div className="mb-5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-2">
        The M² Difference
      </span>
      <h2 className="text-xl md:text-2xl font-bold text-foreground leading-tight mb-2">
        Most online training is a template dressed up as coaching.
      </h2>
      <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
        Every M² program comes with a training portal and direct access to Matt.
        Not a PDF and a "good luck."
      </p>
    </div>

    {/* Feature cards */}
    <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-4 mb-5">
      {FEATURES.map((f) => (
        <div key={f.title} className="bg-card shadow-m2 overflow-hidden flex md:flex-col">
          <div className="w-28 md:w-full shrink-0 bg-background overflow-hidden">
            <img
              src={f.image}
              alt={f.alt}
              width={424}
              height={192}
              className="w-full h-full md:h-48 object-cover object-top"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="p-3 flex flex-col justify-center min-w-0">
            <span className="text-xs font-bold text-foreground leading-tight mb-1">{f.title}</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        </div>
      ))}
    </div>

    {/* The pitch */}
    <div className="bg-card shadow-m2 border-l-4 border-primary p-5 mb-5">
      <p className="text-sm text-muted-foreground leading-relaxed">
        <span className="text-foreground font-bold">Matt personally reviews every athlete's logs.</span> Custom
        programs start at <span className="text-primary font-bold">$20</span>. Monthly coaching
        from <span className="text-primary font-bold">$12.99/mo</span>. The same coach whether you're
        in Grosse Pointe or across the country.
      </p>
    </div>

    {/* Dual CTAs */}
    <div className="flex flex-col sm:flex-row gap-3">
      <Link
        to="/shop"
        className="inline-flex items-center justify-center gap-2 flex-1 bg-primary text-primary-foreground px-5 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        <Star size={14} />
        Browse Programs
        <ArrowRight size={14} />
      </Link>
      <Link
        to="/pricing"
        className="inline-flex items-center justify-center gap-2 flex-1 border-2 border-primary/40 text-primary px-5 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
      >
        Compare Monthly Plans
        <ArrowRight size={14} />
      </Link>
    </div>
  </motion.div>
);

export default M2Difference;
