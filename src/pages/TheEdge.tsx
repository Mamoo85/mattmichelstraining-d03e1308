import { useState, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, Camera, Zap, Brain, Dumbbell, Shield, Lock,
  ArrowRight, ChevronDown, ChevronUp, BarChart3, MessageCircle,
  ScanLine, Activity, Target, Eye, Smartphone, LineChart, Search,
} from "lucide-react";
import SEOHead from "@/components/layout/SEOHead";
import AppNavbar from "@/components/layout/AppNavbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import techWorkoutLogger from "@/assets/tech-workout-logger.jpg";
import techVelocity from "@/assets/tech-velocity-tracker.jpg";
import techNutrition from "@/assets/tech-nutrition-scanner.jpg";
import techPosture from "@/assets/tech-posture-analysis.jpg";
const DoNotPressButton = lazy(() => import("@/components/landing/DoNotPressButton"));
const AIBrainSimulator = lazy(() => import("@/components/landing/AIBrainSimulator"));

/* ─── Live Mini-Demo Components ─── */

const PostureDemo = () => (
  <div className="relative bg-[hsl(var(--synth-bg))] border border-border overflow-hidden">
    <div className="aspect-[3/4] relative">
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--synth-bg))] to-card" />
      <svg viewBox="0 0 200 300" className="absolute inset-0 w-full h-full p-4">
        <circle cx="100" cy="40" r="16" fill="none" stroke="hsl(var(--synth-cyan))" strokeWidth="2" opacity="0.8" />
        <line x1="100" y1="56" x2="100" y2="160" stroke="hsl(var(--synth-cyan))" strokeWidth="2" opacity="0.6" />
        <line x1="60" y1="80" x2="140" y2="80" stroke="hsl(var(--synth-cyan))" strokeWidth="2" opacity="0.6" />
        <line x1="60" y1="80" x2="45" y2="130" stroke="hsl(var(--synth-cyan))" strokeWidth="1.5" opacity="0.5" />
        <line x1="140" y1="80" x2="155" y2="130" stroke="hsl(var(--synth-cyan))" strokeWidth="1.5" opacity="0.5" />
        <line x1="75" y1="160" x2="125" y2="160" stroke="hsl(var(--synth-cyan))" strokeWidth="2" opacity="0.6" />
        <line x1="75" y1="160" x2="70" y2="240" stroke="hsl(var(--synth-cyan))" strokeWidth="1.5" opacity="0.5" />
        <line x1="125" y1="160" x2="130" y2="240" stroke="hsl(var(--synth-cyan))" strokeWidth="1.5" opacity="0.5" />
        <line x1="70" y1="240" x2="60" y2="260" stroke="hsl(var(--synth-cyan))" strokeWidth="1.5" opacity="0.5" />
        <line x1="130" y1="240" x2="140" y2="260" stroke="hsl(var(--synth-cyan))" strokeWidth="1.5" opacity="0.5" />
        {[[100,40],[60,80],[140,80],[100,160],[75,160],[125,160],[45,130],[155,130],[70,240],[130,240]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="4" fill="hsl(var(--synth-cyan))" opacity="0.9" />
        ))}
        <path d="M 85 140 A 20 20 0 0 1 100 125" fill="none" stroke="hsl(var(--synth-orange))" strokeWidth="1.5" />
        <text x="78" y="138" fill="hsl(var(--synth-orange))" fontSize="10" fontWeight="bold">12°</text>
        <rect x="55" y="72" width="8" height="16" fill="hsl(0, 80%, 55%)" opacity="0.4" rx="2" />
        <text x="30" y="84" fill="hsl(0, 80%, 55%)" fontSize="8" fontWeight="bold">Uneven</text>
      </svg>
      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-2 py-1">
        <p className="text-[8px] uppercase tracking-widest text-[hsl(var(--synth-cyan))]">Front View</p>
      </div>
      <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur-sm px-2 py-1.5 space-y-1">
        <div className="flex justify-between text-[8px]"><span className="text-muted-foreground">Shoulder Level</span><span className="text-red-400 font-bold">Asymmetric</span></div>
        <div className="flex justify-between text-[8px]"><span className="text-muted-foreground">Anterior Tilt</span><span className="text-[hsl(var(--synth-orange))] font-bold">12° — Moderate</span></div>
        <div className="flex justify-between text-[8px]"><span className="text-muted-foreground">Knee Alignment</span><span className="text-green-400 font-bold">Normal</span></div>
      </div>
    </div>
  </div>
);

const VelocityDemo = () => (
  <div className="relative bg-[hsl(var(--synth-bg))] border border-border overflow-hidden">
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5"><Zap size={12} className="text-primary" /><span className="text-[10px] font-bold text-foreground">Bench Press — Set 3</span></div>
        <span className="text-[9px] text-muted-foreground">Rep 5 of 5</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[{label:"Speed",value:"0.72",unit:"m/s",color:"text-green-400"},{label:"Peak",value:"0.91",unit:"m/s",color:"text-primary"},{label:"Avg",value:"0.78",unit:"m/s",color:"text-foreground"},{label:"Reps",value:"5",unit:"",color:"text-foreground"}].map(g => (
          <div key={g.label} className="text-center">
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground">{g.label}</p>
            <p className={`text-sm font-black tabular-nums ${g.color}`}>{g.value}<span className="text-[7px] text-muted-foreground ml-0.5">{g.unit}</span></p>
          </div>
        ))}
      </div>
      <div className="bg-green-500/20 text-center py-1 text-[9px] font-bold uppercase tracking-widest text-green-400">↑ Concentric — Push!</div>
      <div className="space-y-1">
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Rep Velocities</p>
        <div className="flex items-end gap-1 h-16">
          {[0.85,0.82,0.78,0.74,0.72].map((v,i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <span className="text-[7px] tabular-nums text-muted-foreground">{v}</span>
              <div className={`w-full rounded-sm ${i===4?"bg-yellow-500/70":v>0.75?"bg-green-500/70":"bg-red-500/70"}`} style={{height:`${(v/1.0)*100}%`}} />
              <span className="text-[7px] text-muted-foreground">R{i+1}</span>
            </div>
          ))}
        </div>
        <p className="text-[8px] text-yellow-400">⚠ Velocity dropping — consider stopping set</p>
      </div>
    </div>
  </div>
);

const NutritionDemo = () => (
  <div className="relative bg-card border border-border overflow-hidden">
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2"><ScanLine size={14} className="text-[hsl(var(--synth-pink))]" /><span className="text-[10px] font-bold text-foreground">Photo Scan Result</span><span className="text-[8px] text-muted-foreground ml-auto">2 sec ago</span></div>
      <div className="bg-muted/30 border border-border p-3"><p className="text-xs font-bold text-foreground mb-1">Grilled Chicken Bowl</p><p className="text-[10px] text-muted-foreground">Brown rice, grilled chicken, avocado, black beans, salsa</p></div>
      <div className="space-y-2">
        {[{label:"Calories",value:"620",goal:"2,400",pct:26,color:"bg-primary"},{label:"Protein",value:"48g",goal:"180g",pct:27,color:"bg-[hsl(var(--synth-cyan))]"},{label:"Carbs",value:"62g",goal:"250g",pct:25,color:"bg-[hsl(var(--synth-orange))]"},{label:"Fat",value:"18g",goal:"70g",pct:26,color:"bg-[hsl(var(--synth-pink))]"}].map(m => (
          <div key={m.label} className="space-y-0.5">
            <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">{m.label}</span><span className="font-bold text-foreground">{m.value} <span className="text-muted-foreground font-normal">/ {m.goal}</span></span></div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${m.color}`} style={{width:`${m.pct}%`}} /></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const WorkoutLoggerDemo = () => (
  <div className="relative bg-card border border-border overflow-hidden">
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2"><Dumbbell size={14} className="text-primary" /><div><p className="text-xs font-bold text-foreground">Barbell Back Squat</p><p className="text-[9px] text-muted-foreground">Week 3 · Day 1 · Foundation Block</p></div></div>
      <div className="aspect-video bg-muted/30 border border-border flex items-center justify-center"><div className="text-center space-y-1"><Eye size={20} className="text-muted-foreground mx-auto" /><p className="text-[9px] text-muted-foreground">HD Instructional Video</p></div></div>
      <div className="bg-primary/5 border-l-2 border-primary px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-0.5">The Why</p><p className="text-[10px] text-muted-foreground leading-relaxed">Full-depth squats build quad, glute, and core strength simultaneously. Keep chest up, drive knees out.</p></div>
      <div className="space-y-1">
        <div className="grid grid-cols-4 gap-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground px-1"><span>Set</span><span>Reps</span><span>Weight</span><span>RPE</span></div>
        {[{set:1,reps:8,weight:185,rpe:7},{set:2,reps:8,weight:185,rpe:8},{set:3,reps:6,weight:195,rpe:9}].map(s => (
          <div key={s.set} className="grid grid-cols-4 gap-1">{[s.set,s.reps,`${s.weight}lb`,s.rpe].map((val,i) => (<div key={i} className="bg-muted/30 border border-border px-2 py-1.5 text-center text-[10px] font-bold text-foreground">{val}</div>))}</div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {[{icon:Camera,label:"Form Check"},{icon:Zap,label:"Velocity"},{icon:MessageCircle,label:"Ask Coach"},{icon:Activity,label:"Smart Sub"}].map(t => (
          <div key={t.label} className="flex items-center gap-1 bg-secondary/60 px-2 py-1 border border-border text-[8px] font-bold text-foreground"><t.icon size={10} className="text-primary" /> {t.label}</div>
        ))}
      </div>
    </div>
  </div>
);

interface TechFeature {
  id: string;
  icon: any;
  title: string;
  tagline: string;
  color: string;
  glowColor: string;
  tier: "free" | "foundation" | "custom";
  description: string;
  howItWorks: string[];
  techSpecs: string[];
  demoComponent: () => JSX.Element;
  screenshot: string;
}

const FEATURES: TechFeature[] = [
  {
    id: "posture-ai", icon: Camera, title: "Posture & Biomechanics Analysis",
    tagline: "Two photos. Full skeletal scan. Data Matt can't get any other way.",
    color: "text-[hsl(var(--synth-cyan))]", glowColor: "bg-[hsl(var(--synth-cyan))]/10", tier: "custom",
    description: "Take a front and side photo from your phone. Advanced computer vision maps 17 skeletal keypoints, measures joint angles, and detects asymmetries — giving Matt data that used to require $10,000+ sports lab equipment.",
    howItWorks: ["Stand in front of your phone camera — front view, then side view","The system detects 17 skeletal keypoints using on-device processing","Joint angles, postural deviations, and asymmetries are measured to sub-degree accuracy","Matt receives the full diagnostic data and builds your corrective program personally"],
    techSpecs: ["On-device skeletal tracking — runs 100% on your phone","Zero data leaves your phone until you share it with Matt","17-point skeletal mapping with confidence scoring","Anterior/posterior tilt, valgus, shoulder asymmetry detection"],
    demoComponent: PostureDemo, screenshot: techPosture,
  },
  {
    id: "velocity", icon: Zap, title: "Velocity-Based Training",
    tagline: "Real-time bar speed. Auto-regulate your load. Train smarter.",
    color: "text-[hsl(var(--synth-orange))]", glowColor: "bg-[hsl(var(--synth-orange))]/10", tier: "foundation",
    description: "Your phone camera tracks the barbell in real-time, measuring concentric and eccentric velocity for every rep. When bar speed drops below your target, the system tells you to stop — preventing junk volume and overtraining.",
    howItWorks: ["Prop your phone to see the barbell from the side","The system tracks wrist position at 30+ frames per second","Real-time velocity displayed in m/s with color-coded feedback","Automatic rep counting and set-over-set velocity trends"],
    techSpecs: ["On-device pose detection at 30+ FPS","Rolling velocity averaging with 5-frame smoothing","Approximate m/s conversion from pixel displacement","Automatic rep detection via Y-axis direction changes"],
    demoComponent: VelocityDemo, screenshot: techVelocity,
  },
  {
    id: "nutrition", icon: Brain, title: "Instant Nutrition Scanner",
    tagline: "Snap a photo. Get every macro. No manual entry.",
    color: "text-[hsl(var(--synth-pink))]", glowColor: "bg-[hsl(var(--synth-pink))]/10", tier: "foundation",
    description: "Take a photo of your meal and the system identifies every food item, estimates portions, and calculates calories, protein, carbs, fat, and fiber — instantly. Daily totals update in real-time.",
    howItWorks: ["Point your camera at any meal or snack","Food items are identified and portion sizes estimated automatically","Macros calculated: calories, protein, carbs, fat, fiber","Daily running totals update immediately with progress bars"],
    techSpecs: ["Computer vision food recognition","Sub-3-second processing time","Persistent nutrition logs with 30-day history","Custom daily goals per macro with profile settings"],
    demoComponent: NutritionDemo, screenshot: techNutrition,
  },
  {
    id: "workout-logger", icon: Dumbbell, title: "Smart Workout Logger",
    tagline: "HD video demos. Coach cues. One-tap logging. OCR scanning.",
    color: "text-primary", glowColor: "bg-primary/10", tier: "free",
    description: "Every exercise includes HD video demonstrations, Matt's coaching cues ('The Why'), and an intuitive logging interface. Log sets, reps, weight, and RPE. Scan handwritten workout notes with OCR. Voice memos. Flag exercises for coach review.",
    howItWorks: ["Open your program — exercises are loaded in order","Watch the HD demo video and read Matt's coaching cues","Log each set: reps, weight, RPE — with huge touch targets","Flag any exercise to get direct coach feedback"],
    techSpecs: ["200+ exercise library with instructional videos","OCR workout scanning via computer vision","Voice-to-text notes via SpeechRecognition API","Offline-first: logs sync when reconnected"],
    demoComponent: WorkoutLoggerDemo, screenshot: techWorkoutLogger,
  },
];

const tierLabels: Record<string, string> = { free: "All Members", foundation: "Foundation+", custom: "Custom+" };

const FeatureSection = ({ feature, index }: { feature: TechFeature; index: number }) => {
  const [expanded, setExpanded] = useState(false);
  const Demo = feature.demoComponent;
  const isEven = index % 2 === 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      id={feature.id}
      className="scroll-mt-20"
    >
      <div className="bg-card border border-border overflow-hidden">
        {/* Screenshot + Demo side by side on desktop */}
        <div className={`md:grid md:grid-cols-2 ${isEven ? "" : "md:direction-rtl"}`}>
          {/* Screenshot */}
          <div className="relative aspect-square md:aspect-auto overflow-hidden">
            <img src={feature.screenshot} alt={feature.title} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
          {/* Demo */}
          <div className="p-1 md:p-2">
            <Demo />
          </div>
        </div>

        {/* Content */}
        <div className="p-5 md:p-6">
          <div className="flex items-start gap-3 mb-3">
            <div className={`${feature.glowColor} p-2.5 shrink-0`}>
              <feature.icon size={20} className={feature.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-base md:text-lg font-bold text-foreground">{feature.title}</h2>
                <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 ${
                  feature.tier === "free" ? "bg-green-500/10 text-green-400" :
                  feature.tier === "foundation" ? "bg-primary/10 text-primary" :
                  "bg-[hsl(var(--synth-pink))]/10 text-[hsl(var(--synth-pink))]"
                }`}>
                  {tierLabels[feature.tier]}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.tagline}</p>
            </div>
          </div>

          <p className="text-xs text-[hsl(var(--foreground-soft))] leading-relaxed mb-4">{feature.description}</p>

          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-all">
            {expanded ? "Hide Details" : "How It Works & Tech Specs"}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="pt-4 space-y-4">
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground mb-2 flex items-center gap-1.5"><Target size={12} className="text-primary" /> How It Works</h3>
                    <ol className="space-y-1.5">
                      {feature.howItWorks.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
                          <span className="bg-primary/10 text-primary text-[9px] font-bold w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>{step}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground mb-2 flex items-center gap-1.5"><Cpu size={12} className="text-[hsl(var(--synth-cyan))]" /> Under the Hood</h3>
                    <ul className="space-y-1">
                      {feature.techSpecs.map((spec, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed"><span className="text-[hsl(var(--synth-cyan))] mt-0.5">▸</span>{spec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  );
};

/* ─── CTA Block ─── */
const TrialCTABlock = () => (
  <div className="bg-gradient-to-br from-primary/20 via-card to-primary/10 border-2 border-primary/40 p-6 md:p-8 text-center">
    <h3 className="text-lg md:text-xl font-black text-foreground mb-1">
      All of This. <span className="text-primary">Inside Your App.</span>
    </h3>
    <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
      Every feature on this page is included free with any M² membership — no add-ons, no upsells.
      Just open the app and start training smarter.
    </p>
    <Button asChild size="lg" className="h-12 font-black uppercase tracking-wider text-sm px-8">
      <Link to="/auth?mode=signup&trial=true">
        Start Your 14-Day Free Trial <ArrowRight size={16} />
      </Link>
    </Button>
    <p className="text-[10px] text-muted-foreground mt-2">Credit card required • $19.99/mo after trial • Cancel anytime</p>
  </div>
);

/* ─── Page ─── */
const TheEdge = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="M² Technology — Advanced Training Tech Built Into Your App"
      description="Posture analysis, velocity tracking, nutrition scanning, smart workout logging — all built into the M² member app. Included free with every membership starting at $19.99/mo."
      path="/the-edge"
    />
    <AppNavbar />

    <div className="container pt-20 pb-12 px-4 sm:px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        {/* Hero */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1 mb-3">
            <Cpu size={14} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[3px] text-primary">M² Technology</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-foreground mb-3">
            Training Technology<br />
            <span className="text-primary">Built Into Your App</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed mb-2">
            Every feature below lives inside the M² member app — no extra downloads, no extra hardware, no extra cost.
            Just open your phone and it's all there. Matt's two passions — computer engineering and exercise science —
            fused into one platform no other trainer can match.
          </p>
          <p className="text-xs text-primary font-bold">
            All technology included free with every membership tier — starting at $19.99/mo.
          </p>
        </div>

        {/* Top CTA */}
        <div className="mb-8">
          <TrialCTABlock />
        </div>

        {/* AI Brain Simulator */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={18} className="text-[hsl(var(--synth-cyan))]" />
            <h2 className="text-base md:text-lg font-black uppercase tracking-tight text-foreground">See the AI in Action</h2>
          </div>
          <Suspense fallback={<div className="h-[420px] bg-card border border-border animate-pulse" />}>
            <AIBrainSimulator />
          </Suspense>
        </div>

        {/* Quick nav */}
        <div className="flex flex-wrap gap-2 mb-8">
          {FEATURES.map(f => (
            <a key={f.id} href={`#${f.id}`} className="flex items-center gap-1.5 bg-secondary/60 px-2.5 py-1.5 border border-border hover:border-primary/40 transition-all text-[10px] font-bold text-foreground">
              <f.icon size={12} className={f.color} /> {f.title.split(" ").slice(0,3).join(" ")}
            </a>
          ))}
        </div>

        {/* Privacy badge */}
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-4 py-2.5 mb-8">
          <Shield size={16} className="text-green-400 shrink-0" />
          <div>
            <p className="text-xs font-bold text-green-400">Privacy-First Technology</p>
            <p className="text-[10px] text-muted-foreground">All camera-based features process on your device. No video or photos are uploaded unless you explicitly share them.</p>
          </div>
        </div>

        {/* Feature sections */}
        <div className="space-y-6">
          {FEATURES.map((f, i) => <FeatureSection key={f.id} feature={f} index={i} />)}
        </div>

        {/* Instant Knowledge callout */}
        <div className="bg-primary/5 border border-primary/20 p-6 my-8 text-center">
          <Search size={24} className="text-primary mx-auto mb-2" />
          <h3 className="text-base font-black uppercase text-foreground mb-2">Instant Knowledge at Your Fingertips</h3>
          <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
            No more digging through random YouTube videos from years ago. Type any topic — mobility, squat depth,
            shoulder impingement, nutrition timing — and get Coach Matt's current, proven answer.
            20+ years of the best of the best information, always up to date. Information Matt stands behind 100%.
          </p>
        </div>

        {/* Bottom CTA */}
        <TrialCTABlock />

        <Suspense fallback={null}><DoNotPressButton /></Suspense>
      </motion.div>
    </div>
  </div>
);

export default TheEdge;
