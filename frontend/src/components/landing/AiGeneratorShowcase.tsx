import { motion } from "framer-motion";
import { Sparkles, Wrench, ArrowRight, Dumbbell, Brain } from "lucide-react";
import { Link } from "react-router-dom";

const WORKOUT_PREVIEW = [
  { num: 1, title: "Adductor Foam Roll", phase: "Rolling/Soft Tissue", sets: "1×60s per side" },
  { num: 2, title: "Cat-Cow / Camel", phase: "Dynamic Warmup", sets: "2×8-10" },
  { num: 3, title: "Goblet Squat with Prying", phase: "Main Work", sets: "3×5-8" },
  { num: 4, title: "DB Floor Press", phase: "Main Work", sets: "3×8-12" },
  { num: 5, title: "DB Romanian Deadlift", phase: "Main Work", sets: "3×8-12" },
  { num: 6, title: "RKC Plank", phase: "Finisher", sets: "3×20-30s" },
  { num: 7, title: "Couch Stretch", phase: "Cooldown", sets: "1×60s per side" },
];

const FIXIT_PREVIEW = [
  { num: 1, title: "Lacrosse Ball Glute Release", phase: "Tissue Release", sets: "2×60s per side" },
  { num: 2, title: "90/90 Hip Switch", phase: "Mobility", sets: "2×8 each" },
  { num: 3, title: "McGill Big 3 — Bird Dog", phase: "Corrective Loading", sets: "3×8 each" },
  { num: 4, title: "Dead Bug — Anti-Extension", phase: "Corrective Loading", sets: "3×8 each" },
];

const phaseColors: Record<string, string> = {
  "Rolling/Soft Tissue": "bg-blue-500/20 text-blue-300",
  "Dynamic Warmup": "bg-amber-500/20 text-amber-300",
  "Main Work": "bg-primary/20 text-primary",
  Finisher: "bg-red-500/20 text-red-300",
  Cooldown: "bg-green-500/20 text-green-300",
  "Tissue Release": "bg-blue-500/20 text-blue-300",
  Mobility: "bg-amber-500/20 text-amber-300",
  "Corrective Loading": "bg-[hsl(270_60%_50%)]/20 text-[hsl(270_60%_65%)]",
};

const AiGeneratorShowcase = () => (
  <motion.section
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-card via-background to-card"
  >
    {/* Glow effects */}
    <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/10 rounded-full blur-[80px]" />
    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[hsl(270_60%_50%)]/10 rounded-full blur-[60px]" />

    <div className="relative p-5 sm:p-8 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-primary">
            <Brain size={11} /> AI-Powered
          </span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
            Included Free · All Plans
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-foreground leading-tight mb-2">
          Tell It What You Need.<br />
          <span className="text-primary">Get a Coach-Grade Program in Seconds.</span>
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
          No forms. No dropdowns. Just tell the AI about yourself in plain English — it builds a phased, 
          sports-science-backed program using Coach Matt's 20 years of training data. Not generic internet fluff.
        </p>
      </div>

      {/* Two mock previews side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Workout Preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Workout Generator</span>
          </div>

          {/* Mock input */}
          <div className="bg-background/60 border border-border p-3 text-xs text-muted-foreground italic">
            "I'm 45 and haven't worked out in 5 years. I have dumbbells and a bench."
          </div>

          {/* Mock output */}
          <div className="bg-card border border-border p-3 space-y-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Dumbbell size={12} className="text-primary" />
              <span className="text-xs font-bold text-foreground">Full Body Workout A</span>
            </div>
            {WORKOUT_PREVIEW.map((ex) => (
              <div key={ex.num} className="flex items-center gap-2 text-[10px]">
                <span className="text-primary font-mono font-bold w-4 text-right">{ex.num}.</span>
                <span className="font-bold text-foreground flex-1 truncate">{ex.title}</span>
                <span className={`text-[7px] font-bold uppercase px-1 py-0.5 rounded shrink-0 ${phaseColors[ex.phase] || "bg-muted text-muted-foreground"}`}>
                  {ex.phase}
                </span>
                <span className="font-mono text-primary shrink-0 text-[9px]">{ex.sets}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fix It Preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Wrench size={14} className="text-[hsl(270_60%_60%)]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[hsl(270_60%_60%)]">Fix It Engine</span>
          </div>

          {/* Mock input */}
          <div className="bg-background/60 border border-border p-3 text-xs text-muted-foreground italic">
            "My lower back tightens up during heavy squats and after sitting all day."
          </div>

          {/* Mock output */}
          <div className="bg-card border border-border p-3 space-y-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Wrench size={12} className="text-[hsl(270_60%_60%)]" />
              <span className="text-xs font-bold text-foreground">Low Back Rehab Protocol</span>
            </div>
            {FIXIT_PREVIEW.map((ex) => (
              <div key={ex.num} className="flex items-center gap-2 text-[10px]">
                <span className="text-[hsl(270_60%_60%)] font-mono font-bold w-4 text-right">{ex.num}.</span>
                <span className="font-bold text-foreground flex-1 truncate">{ex.title}</span>
                <span className={`text-[7px] font-bold uppercase px-1 py-0.5 rounded shrink-0 ${phaseColors[ex.phase] || "bg-muted text-muted-foreground"}`}>
                  {ex.phase}
                </span>
                <span className="font-mono text-[hsl(270_60%_60%)] shrink-0 text-[9px]">{ex.sets}</span>
              </div>
            ))}
            <p className="text-[9px] text-muted-foreground pt-1 italic">Based on McGill protocols + Coach Matt's corrective system</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <Link
          to="/auth?redirect=/trial-welcome"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
        >
          Start 14-Day Free Trial <ArrowRight size={14} />
        </Link>
        <Link
          to="/free-ai-generator"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border-2 border-primary/40 text-primary px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-all"
        >
          <Sparkles size={13} /> Try It Free — One Generation
        </Link>
      </div>

      <p className="text-[9px] text-muted-foreground text-center sm:text-left">
        Every plan includes the AI Workout Generator + Fix It Engine. Starting at $19.99/mo. Cancel anytime.
      </p>
    </div>
  </motion.section>
);

export default AiGeneratorShowcase;
