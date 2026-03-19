import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import m2Logo from "@/assets/m2-logo.jpg";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

interface Props {
  cms: Record<string, string>;
}

const ForParentsHero = ({ cms }: Props) => (
  <motion.div {...fade(0.05)} className="py-8 md:py-14">
    <div className="flex items-start gap-4 mb-6">
      <img src={m2Logo} alt="M² Training — Youth Strength Training" className="w-14 h-14 md:w-20 md:h-20 object-contain rounded-md flex-shrink-0" />
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-0.5 h-4 bg-primary" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary font-mono">
            Youth Strength Training for Parents
          </span>
        </div>
        <h1 className="text-2xl md:text-5xl lg:text-6xl font-bold tracking-display text-foreground leading-[1.1]">
          <motion.span {...fade(0.15)} className="block">{cms.hero_line_1 || "3.5 million youth sports injuries"}</motion.span>
          <motion.span {...fade(0.25)} className="block text-primary">{cms.hero_line_2 || "per year. Half are preventable."}</motion.span>
        </h1>
      </div>
    </div>

    {/* Stat proof bar */}
    <div className="flex flex-wrap gap-4 sm:gap-8 mb-5">
      {[
        { val: "20+", lbl: "Years Coaching Youth" },
        { val: "50+", lbl: "College Athletes Produced" },
        { val: "0", lbl: "Training Injuries" },
      ].map((s) => (
        <div key={s.lbl} className="flex items-center gap-2">
          <span className="text-xl font-black text-primary font-mono">{s.val}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-tight">{s.lbl}</span>
        </div>
      ))}
    </div>

    <p className="text-sm md:text-base text-muted-foreground max-w-2xl mb-6 leading-relaxed">
      {cms.hero_subtitle || "Most youth training programs are built by people who learned from social media — not from 20 years of watching what actually breaks down in a young athlete's body. Matt has trained thousands of kids. 50+ went on to compete at the college level. Zero got injured. That's not a slogan — it's a track record."}
    </p>
    <div className="flex flex-wrap gap-3">
      <Link
        to="/auth?redirect=/trial-welcome"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        Start Your 14-Day Free Trial
        <ArrowRight size={15} />
      </Link>
      <Link
        to="/shop"
        className="inline-flex items-center gap-2 border-2 border-primary/40 text-primary px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
      >
        {cms.hero_cta_secondary || "Browse $20 Programs"}
      </Link>
    </div>
  </motion.div>
);

export default ForParentsHero;
