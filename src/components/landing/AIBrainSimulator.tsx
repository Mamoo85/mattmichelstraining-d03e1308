import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Zap, Wrench, Dumbbell, Plus, Printer,
  Upload, Shield, Activity, ChevronRight,
} from "lucide-react";

type Phase = "idle" | "typing" | "processing" | "output";
type Tab = "fixit" | "garage";

const FIXIT_INPUT = "My right shoulder hurts when I put on my shirt in the morning.";
const FIXIT_PROCESSING = [
  "Cross-referencing injury history...",
  "Scanning 85+ rehab protocols...",
  "Building corrective program...",
];
const GARAGE_PROCESSING = [
  "Analyzing equipment...",
  "Scaling wave-loading percentages for advanced lifter...",
  "Generating 3-day split...",
];

/* ── Fix It Output ── */
const FixItOutput = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="space-y-3"
  >
    <div className="border border-[hsl(var(--synth-cyan))]/30 bg-[hsl(var(--synth-cyan))]/5 p-3">
      <p className="text-[10px] uppercase tracking-[3px] text-[hsl(var(--synth-cyan))] font-bold mb-0.5">Generated Protocol</p>
      <h4 className="text-sm font-black text-foreground">Anterior Shoulder Impingement Protocol</h4>
      <p className="text-[10px] text-muted-foreground">4 Weeks · 3 Phases · Progressive Loading</p>
    </div>
    {[
      { phase: "Phase 1 — Tissue Release", color: "synth-pink", exercises: ["Lacrosse Ball Pec Minor — 90s each side", "Thoracic Foam Roll — 2×15 passes", "Cross-Body Lat Stretch — 30s hold"] },
      { phase: "Phase 2 — Mobility", color: "synth-orange", exercises: ["Band Pull-Apart — 3×15", "Wall Slide — 3×10 (slow tempo)", "Open Book Rotation — 2×8 each side"] },
      { phase: "Phase 3 — Isometric Loading", color: "synth-cyan", exercises: ["Side-Lying External Rotation Hold — 3×20s", "High Plank Protraction — 3×12", "Face Pull ISO — 3×15s hold at peak"] },
    ].map((p) => (
      <motion.div
        key={p.phase}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="border border-border bg-card/50 p-3"
      >
        <p className={`text-[9px] uppercase tracking-widest font-bold text-[hsl(var(--${p.color}))] mb-1.5`}>{p.phase}</p>
        <ul className="space-y-1">
          {p.exercises.map((e) => (
            <li key={e} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ChevronRight size={10} className="text-primary mt-0.5 shrink-0" />{e}
            </li>
          ))}
        </ul>
      </motion.div>
    ))}
    <div className="flex gap-2 pt-1">
      <button className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/20 transition-colors">
        <Plus size={12} /> Save to My Library
      </button>
      <button className="flex items-center gap-1.5 bg-secondary/60 border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-foreground hover:bg-secondary transition-colors">
        <Printer size={12} /> Print PDF
      </button>
    </div>
  </motion.div>
);

/* ── Garage Output ── */
const GarageOutput = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="space-y-3"
  >
    <div className="border border-[hsl(var(--synth-orange))]/30 bg-[hsl(var(--synth-orange))]/5 p-3">
      <p className="text-[10px] uppercase tracking-[3px] text-[hsl(var(--synth-orange))] font-bold mb-0.5">Generated Program</p>
      <h4 className="text-sm font-black text-foreground">Garage Strength — 3-Day Wave Loading Split</h4>
      <p className="text-[10px] text-muted-foreground">Equipment: Barbell + Flat Bench + 300lb Plates</p>
    </div>
    {[
      { day: "Day 1 — Squat & Press", exercises: ["Back Squat — 5/3/1 Wave (75-90%)", "Strict Press — 4×5 @ RPE 8", "Front Squat — 3×6 @ 70%", "Floor Press — 3×8"] },
      { day: "Day 2 — Deadlift & Row", exercises: ["Conventional Deadlift — 5/3/1 Wave", "Barbell Row — 4×8 @ RPE 7", "RDL — 3×8 @ 65%", "Pendlay Row — 3×6 heavy"] },
      { day: "Day 3 — Bench & Accessories", exercises: ["Bench Press — 5/3/1 Wave (75-90%)", "Close-Grip Bench — 4×6", "Barbell Curl — 3×12", "Skull Crushers — 3×12"] },
    ].map((d) => (
      <motion.div
        key={d.day}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="border border-border bg-card/50 p-3"
      >
        <p className="text-[9px] uppercase tracking-widest font-bold text-primary mb-1.5">{d.day}</p>
        <ul className="space-y-1">
          {d.exercises.map((e) => (
            <li key={e} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Dumbbell size={10} className="text-[hsl(var(--synth-orange))] mt-0.5 shrink-0" />{e}
            </li>
          ))}
        </ul>
      </motion.div>
    ))}
    <div className="flex gap-2 pt-1">
      <button className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/20 transition-colors">
        <Plus size={12} /> Save to My Library
      </button>
      <button className="flex items-center gap-1.5 bg-secondary/60 border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-foreground hover:bg-secondary transition-colors">
        <Printer size={12} /> Print PDF
      </button>
    </div>
  </motion.div>
);

/* ── Main Component ── */
const AIBrainSimulator = () => {
  const [tab, setTab] = useState<Tab>("fixit");
  const [phase, setPhase] = useState<Phase>("idle");
  const [typedText, setTypedText] = useState("");
  const [procLines, setProcLines] = useState<string[]>([]);

  const inputText = tab === "fixit" ? FIXIT_INPUT : "";
  const processingLines = tab === "fixit" ? FIXIT_PROCESSING : GARAGE_PROCESSING;

  const reset = useCallback(() => {
    setPhase("idle");
    setTypedText("");
    setProcLines([]);
  }, []);

  // Auto-start on mount / tab change
  useEffect(() => {
    reset();
    const t = setTimeout(() => setPhase("typing"), 600);
    return () => clearTimeout(t);
  }, [tab, reset]);

  // Typing phase
  useEffect(() => {
    if (phase !== "typing") return;
    if (tab === "garage") {
      // No typing for garage — skip to processing after showing upload
      const t = setTimeout(() => setPhase("processing"), 1500);
      return () => clearTimeout(t);
    }
    if (typedText.length >= inputText.length) {
      const t = setTimeout(() => setPhase("processing"), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setTypedText((prev) => inputText.slice(0, prev.length + 1));
    }, 30);
    return () => clearTimeout(t);
  }, [phase, typedText, inputText, tab]);

  // Processing phase
  useEffect(() => {
    if (phase !== "processing") return;
    setProcLines([]);
    const timers: ReturnType<typeof setTimeout>[] = [];
    processingLines.forEach((line, i) => {
      timers.push(
        setTimeout(() => setProcLines((prev) => [...prev, line]), i * 800)
      );
    });
    timers.push(
      setTimeout(() => setPhase("output"), processingLines.length * 800 + 600)
    );
    return () => timers.forEach(clearTimeout);
  }, [phase, processingLines]);

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    reset();
    setTab(t);
  };

  return (
    <div className="bg-[hsl(var(--synth-bg))] border border-border overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-black/30">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <p className="text-[9px] uppercase tracking-[3px] text-muted-foreground font-bold">M² AI Generator</p>
        <Brain size={14} className="text-primary" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {([
          { key: "fixit" as Tab, label: "The Fix It Engine", icon: Wrench, color: "synth-pink" },
          { key: "garage" as Tab, label: "The Smart Garage Gym", icon: Dumbbell, color: "synth-orange" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
              tab === t.key
                ? `text-[hsl(var(--${t.color}))] border-b-2 border-[hsl(var(--${t.color}))] bg-[hsl(var(--${t.color}))]/5`
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 md:p-5 min-h-[420px]">
        <AnimatePresence mode="wait">
          {/* ── Input Phase ── */}
          {(phase === "typing" || phase === "idle") && (
            <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {tab === "fixit" ? (
                /* Fix It — typing input */
                <div className="bg-card/50 border border-border p-3">
                  <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-2">What's bothering you?</p>
                  <div className="bg-muted/20 border border-border px-3 py-2.5 min-h-[40px] flex items-center">
                    <p className="text-xs text-foreground">
                      {typedText}
                      <span className="inline-block w-[2px] h-3.5 bg-primary ml-0.5 animate-pulse" />
                    </p>
                  </div>
                </div>
              ) : (
                /* Garage — image upload mock */
                <div className="space-y-3">
                  <div className="bg-card/50 border border-border p-3">
                    <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-2">Upload Your Gym</p>
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4 }}
                      className="aspect-video bg-gradient-to-br from-muted/40 via-muted/20 to-muted/40 border border-dashed border-border flex items-center justify-center relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_60%,hsl(var(--synth-orange)/0.08),transparent_50%)]" />
                      <div className="text-center space-y-2 relative z-10">
                        <Upload size={20} className="text-muted-foreground mx-auto" />
                        <p className="text-[10px] text-muted-foreground font-bold">garage_gym.jpg</p>
                        <div className="flex gap-2 justify-center flex-wrap">
                          {["Barbell", "Flat Bench", "300lb Plates"].map((eq) => (
                            <span key={eq} className="text-[8px] bg-[hsl(var(--synth-orange))]/10 text-[hsl(var(--synth-orange))] px-1.5 py-0.5 font-bold uppercase tracking-wider">{eq}</span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center gap-2 bg-[hsl(var(--synth-cyan))]/5 border border-[hsl(var(--synth-cyan))]/20 px-3 py-2"
                  >
                    <Shield size={12} className="text-[hsl(var(--synth-cyan))] shrink-0" />
                    <p className="text-[9px] text-[hsl(var(--synth-cyan))] font-bold">
                      System Note: <span className="text-muted-foreground font-normal">Advanced (4+ years) · No injury history · Goal: Raw Strength</span>
                    </p>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Processing Phase ── */}
          {phase === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                >
                  <Activity size={16} className="text-primary" />
                </motion.div>
                <p className="text-xs font-bold text-foreground">Processing...</p>
              </div>
              <div className="space-y-2">
                {procLines.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <Zap size={10} className="text-[hsl(var(--synth-cyan))]" />
                    <span className="text-muted-foreground">{line}</span>
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-green-400 text-[9px] font-bold"
                    >
                      ✓
                    </motion.span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Output Phase ── */}
          {phase === "output" && (
            <motion.div key="output" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {tab === "fixit" ? <FixItOutput /> : <GarageOutput />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AIBrainSimulator;
