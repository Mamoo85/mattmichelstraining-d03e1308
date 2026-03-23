import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import portalPrograms from "@/assets/portal-programs.jpg";
import portalChat from "@/assets/portal-chat.jpg";
import portalProgress from "@/assets/portal-progress.jpg";

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
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className="mb-10"
  >
    <div className="flex items-end justify-between mb-5">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-2">
          The M² Difference
        </span>
        <h2 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
          Most online training is a template dressed up as coaching.
        </h2>
      </div>
      <Link
        to="/the-edge"
        className="text-[10px] font-bold uppercase tracking-widest text-primary hover:gap-2 transition-all flex items-center gap-1 shrink-0 hidden sm:flex"
      >
        Learn More <ArrowRight size={10} />
      </Link>
    </div>

    <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed mb-5">
      Every M² program comes with a training portal and direct access to Matt.
      Not a PDF and a "good luck."
    </p>

    {/* Horizontal scroll row */}
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible">
      {FEATURES.map((f) => (
        <div
          key={f.title}
          className="bg-card rounded-lg ring-1 ring-white/5 overflow-hidden shrink-0 w-[260px] sm:w-auto snap-start flex flex-col"
        >
          <div className="h-40 bg-background overflow-hidden">
            <img
              src={f.image}
              alt={f.alt}
              width={424}
              height={192}
              className="w-full h-full object-cover object-top"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="p-3.5 flex flex-col justify-center min-w-0">
            <span className="text-xs font-bold text-foreground leading-tight mb-1">{f.title}</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        </div>
      ))}
    </div>

    {/* The pitch */}
    <div className="bg-card rounded-lg ring-1 ring-white/5 border-l-4 border-primary p-5 mt-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        <span className="text-foreground font-bold">Matt personally reviews every athlete's logs.</span> Custom
        programs start at <span className="text-primary font-bold">$20</span>. Monthly coaching
        from <span className="text-primary font-bold">$12.99/mo</span>. The same coach whether you're
        in Grosse Pointe or across the country.
      </p>
    </div>
  </motion.div>
);

export default M2Difference;
