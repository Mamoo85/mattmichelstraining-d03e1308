import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Camera, Zap, Brain, Dumbbell, ArrowRight, Shield,
  LineChart, MessageCircle, Smartphone, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import techWorkoutLogger from "@/assets/tech-workout-logger.jpg";
import techVelocity from "@/assets/tech-velocity-tracker.jpg";
import techNutrition from "@/assets/tech-nutrition-scanner.jpg";
import techPosture from "@/assets/tech-posture-analysis.jpg";

const TECH_FEATURES = [
  {
    icon: Camera,
    title: "Posture & Biomechanics Analysis",
    desc: "Two photos from your phone. Full skeletal scan. 17 joint points mapped. Matt gets data that used to require a $10,000 sports lab.",
    color: "text-[hsl(var(--synth-cyan))]",
    bg: "bg-[hsl(var(--synth-cyan))]/10",
    img: techPosture,
  },
  {
    icon: Zap,
    title: "Velocity-Based Training",
    desc: "Real-time bar speed tracking. Auto-regulate load. Your phone camera measures concentric velocity every rep — same tech used by Olympic programs.",
    color: "text-[hsl(var(--synth-orange))]",
    bg: "bg-[hsl(var(--synth-orange))]/10",
    img: techVelocity,
  },
  {
    icon: Brain,
    title: "Instant Nutrition Scanner",
    desc: "Snap a photo of any meal. Get calories, protein, carbs, fat in under 3 seconds. No manual entry. Daily totals update in real-time.",
    color: "text-[hsl(var(--synth-pink))]",
    bg: "bg-[hsl(var(--synth-pink))]/10",
    img: techNutrition,
  },
  {
    icon: Dumbbell,
    title: "Smart Workout Logger",
    desc: "HD video demos, Coach Matt's cues, one-tap logging, OCR scanning, voice notes. 200+ exercise library. Your entire training history, searchable.",
    color: "text-primary",
    bg: "bg-primary/10",
    img: techWorkoutLogger,
  },
];

const EXTRAS = [
  { icon: LineChart, label: "Progress Graphs & 1RM Tracking" },
  { icon: MessageCircle, label: "Direct Coach Messaging" },
  { icon: Search, label: "Instant Knowledge Search" },
  { icon: Shield, label: "Privacy-First: All On-Device" },
];

interface Props {
  variant?: "full" | "compact";
}

const TechShowcaseMarketing = ({ variant = "full" }: Props) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden"
    >
      {/* Glow accents */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[hsl(var(--synth-cyan))]/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative bg-gradient-to-b from-card via-background to-card border border-border p-6 md:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1 mb-3">
            <Smartphone size={12} className="text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-[3px] text-primary">
              M2 Technology Suite
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground mb-2">
            20 Years of Expertise.{" "}
            <span className="text-primary">One App.</span>
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            No searching through old videos. No guessing. Just type the topic and get
            proven, up-to-date information Coach Matt stands behind 100%.
            Real gym. Real trainer. Real results.
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <span className="text-xs font-bold text-foreground">All this for</span>
            <span className="text-2xl font-black text-primary">$19.99<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
            <span className="text-[9px] bg-primary/20 text-primary font-bold px-2 py-0.5 uppercase tracking-widest">14-Day Free Trial</span>
          </div>
        </div>

        {/* Top CTA */}
        <div className="text-center mb-8">
          <Button asChild size="lg" className="h-12 font-black uppercase tracking-wider text-sm px-8">
            <Link to="/auth?mode=signup&trial=true">
              Start Free Trial <ArrowRight size={16} />
            </Link>
          </Button>
        </div>

        {/* Feature Grid with Screenshots */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {TECH_FEATURES.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="bg-secondary/40 border border-border overflow-hidden group hover:border-primary/30 transition-colors"
            >
              {/* Screenshot */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={feat.img}
                  alt={feat.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="flex items-center gap-1.5">
                    <div className={`${feat.bg} p-1.5`}>
                      <feat.icon size={14} className={feat.color} />
                    </div>
                    <span className="text-xs font-bold text-white drop-shadow-lg">{feat.title}</span>
                  </div>
                </div>
              </div>
              {/* Description */}
              <div className="p-4">
                <p className="text-[11px] text-muted-foreground leading-relaxed">{feat.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Extras row */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {EXTRAS.map((ex) => (
            <div key={ex.label} className="flex items-center gap-1.5 bg-muted/50 border border-border px-3 py-2">
              <ex.icon size={12} className="text-primary shrink-0" />
              <span className="text-[10px] font-bold text-foreground">{ex.label}</span>
            </div>
          ))}
        </div>

        {/* Instant Knowledge callout */}
        <div className="bg-primary/5 border border-primary/20 p-5 mb-8 text-center">
          <Search size={20} className="text-primary mx-auto mb-2" />
          <h3 className="text-sm font-black uppercase text-foreground mb-1">
            Instant Knowledge at Your Fingertips
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            No more digging through random YouTube videos from 3 years ago.
            Type any topic — mobility, squat depth, shoulder impingement — and get
            Coach Matt's current, proven answer. 20+ years of the best information,
            always up to date, always accurate.
          </p>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <div className="bg-gradient-to-br from-primary/20 via-card to-primary/10 border-2 border-primary/40 p-6 inline-block w-full max-w-md">
            <p className="text-lg font-black text-foreground mb-1">
              All of This. <span className="text-primary">$19.99/mo.</span>
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              All technology is built into the M2 member app — included free with every membership.
            </p>
            <Button asChild size="lg" className="w-full h-12 font-black uppercase tracking-wider text-sm">
              <Link to="/auth?mode=signup&trial=true">
                Start Your 14-Day Free Trial <ArrowRight size={16} />
              </Link>
            </Button>
            <p className="text-[10px] text-muted-foreground mt-2">
              Credit card required • $19.99/mo after trial • Cancel anytime
            </p>
          </div>
        </div>

        {variant === "full" && (
          <div className="text-center mt-6">
            <Link
              to="/the-edge"
              className="text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
            >
              See Full Technology Breakdown →
            </Link>
          </div>
        )}
      </div>
    </motion.section>
  );
};

export default TechShowcaseMarketing;
