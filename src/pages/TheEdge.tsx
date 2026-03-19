import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, Camera, Zap, Brain, Dumbbell, TrendingUp, Shield, Lock,
  ArrowRight, ChevronDown, ChevronUp, Sparkles, BarChart3, MessageCircle,
  ScanLine, Activity, Target, Eye, Smartphone, LineChart,
} from "lucide-react";
import SEOHead from "@/components/SEOHead";
import AppNavbar from "@/components/AppNavbar";
import TrialCTA from "@/components/TrialCTA";
import { useAuth } from "@/hooks/useAuth";

/* ─── Tech Feature Data ─── */
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
}

/* ─── Live Mini-Demo Components ─── */

const PostureDemo = () => (
  <div className="relative bg-[hsl(var(--synth-bg))] border border-border overflow-hidden">
    <div className="aspect-[3/4] relative">
      {/* Simulated skeleton overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--synth-bg))] to-card" />
      <svg viewBox="0 0 200 300" className="absolute inset-0 w-full h-full p-4">
        {/* Skeleton figure */}
        <circle cx="100" cy="40" r="16" fill="none" stroke="hsl(var(--synth-cyan))" strokeWidth="2" opacity="0.8" />
        {/* Spine */}
        <line x1="100" y1="56" x2="100" y2="160" stroke="hsl(var(--synth-cyan))" strokeWidth="2" opacity="0.6" />
        {/* Shoulders */}
        <line x1="60" y1="80" x2="140" y2="80" stroke="hsl(var(--synth-cyan))" strokeWidth="2" opacity="0.6" />
        {/* Arms */}
        <line x1="60" y1="80" x2="45" y2="130" stroke="hsl(var(--synth-cyan))" strokeWidth="1.5" opacity="0.5" />
        <line x1="140" y1="80" x2="155" y2="130" stroke="hsl(var(--synth-cyan))" strokeWidth="1.5" opacity="0.5" />
        {/* Hips */}
        <line x1="75" y1="160" x2="125" y2="160" stroke="hsl(var(--synth-cyan))" strokeWidth="2" opacity="0.6" />
        {/* Legs */}
        <line x1="75" y1="160" x2="70" y2="240" stroke="hsl(var(--synth-cyan))" strokeWidth="1.5" opacity="0.5" />
        <line x1="125" y1="160" x2="130" y2="240" stroke="hsl(var(--synth-cyan))" strokeWidth="1.5" opacity="0.5" />
        {/* Feet */}
        <line x1="70" y1="240" x2="60" y2="260" stroke="hsl(var(--synth-cyan))" strokeWidth="1.5" opacity="0.5" />
        <line x1="130" y1="240" x2="140" y2="260" stroke="hsl(var(--synth-cyan))" strokeWidth="1.5" opacity="0.5" />
        {/* Joint dots */}
        {[
          [100, 40], [60, 80], [140, 80], [100, 160], [75, 160], [125, 160],
          [45, 130], [155, 130], [70, 240], [130, 240],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4" fill="hsl(var(--synth-cyan))" opacity="0.9" />
        ))}
        {/* Angle measurement */}
        <path d="M 85 140 A 20 20 0 0 1 100 125" fill="none" stroke="hsl(var(--synth-orange))" strokeWidth="1.5" />
        <text x="78" y="138" fill="hsl(var(--synth-orange))" fontSize="10" fontWeight="bold">12°</text>
        {/* Warning indicator */}
        <rect x="55" y="72" width="8" height="16" fill="hsl(0, 80%, 55%)" opacity="0.4" rx="2" />
        <text x="30" y="84" fill="hsl(0, 80%, 55%)" fontSize="8" fontWeight="bold">Uneven</text>
      </svg>
      {/* HUD overlay */}
      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-2 py-1">
        <p className="text-[8px] uppercase tracking-widest text-[hsl(var(--synth-cyan))]">Front View</p>
      </div>
      <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur-sm px-2 py-1.5 space-y-1">
        <div className="flex justify-between text-[8px]">
          <span className="text-muted-foreground">Shoulder Level</span>
          <span className="text-red-400 font-bold">Asymmetric</span>
        </div>
        <div className="flex justify-between text-[8px]">
          <span className="text-muted-foreground">Anterior Tilt</span>
          <span className="text-[hsl(var(--synth-orange))] font-bold">12° — Moderate</span>
        </div>
        <div className="flex justify-between text-[8px]">
          <span className="text-muted-foreground">Knee Alignment</span>
          <span className="text-green-400 font-bold">Normal</span>
        </div>
      </div>
    </div>
  </div>
);

const VelocityDemo = () => (
  <div className="relative bg-[hsl(var(--synth-bg))] border border-border overflow-hidden">
    <div className="p-4 space-y-3">
      {/* HUD Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap size={12} className="text-primary" />
          <span className="text-[10px] font-bold text-foreground">Bench Press — Set 3</span>
        </div>
        <span className="text-[9px] text-muted-foreground">Rep 5 of 5</span>
      </div>

      {/* Velocity gauges */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Speed", value: "0.72", unit: "m/s", color: "text-green-400" },
          { label: "Peak", value: "0.91", unit: "m/s", color: "text-primary" },
          { label: "Avg", value: "0.78", unit: "m/s", color: "text-foreground" },
          { label: "Reps", value: "5", unit: "", color: "text-foreground" },
        ].map((g) => (
          <div key={g.label} className="text-center">
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground">{g.label}</p>
            <p className={`text-sm font-black tabular-nums ${g.color}`}>
              {g.value}<span className="text-[7px] text-muted-foreground ml-0.5">{g.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Phase bar */}
      <div className="bg-green-500/20 text-center py-1 text-[9px] font-bold uppercase tracking-widest text-green-400">
        ↑ Concentric — Push!
      </div>

      {/* Rep velocity chart */}
      <div className="space-y-1">
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Rep Velocities</p>
        <div className="flex items-end gap-1 h-16">
          {[0.85, 0.82, 0.78, 0.74, 0.72].map((v, i) => {
            const pct = (v / 1.0) * 100;
            const isLast = i === 4;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[7px] tabular-nums text-muted-foreground">{v}</span>
                <div
                  className={`w-full rounded-sm ${isLast ? "bg-yellow-500/70" : v > 0.75 ? "bg-green-500/70" : "bg-red-500/70"}`}
                  style={{ height: `${pct}%` }}
                />
                <span className="text-[7px] text-muted-foreground">R{i + 1}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[8px] text-yellow-400">
          ⚠ Velocity dropping — consider stopping set
        </p>
      </div>
    </div>
  </div>
);

const NutritionDemo = () => (
  <div className="relative bg-card border border-border overflow-hidden">
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ScanLine size={14} className="text-[hsl(var(--synth-pink))]" />
        <span className="text-[10px] font-bold text-foreground">Photo Scan Result</span>
        <span className="text-[8px] text-muted-foreground ml-auto">2 sec ago</span>
      </div>

      {/* Mock food scan */}
      <div className="bg-muted/30 border border-border p-3">
        <p className="text-xs font-bold text-foreground mb-1">Grilled Chicken Bowl</p>
        <p className="text-[10px] text-muted-foreground">Brown rice, grilled chicken, avocado, black beans, salsa</p>
      </div>

      {/* Macros */}
      <div className="space-y-2">
        {[
          { label: "Calories", value: "620", goal: "2,400", pct: 26, color: "bg-primary" },
          { label: "Protein", value: "48g", goal: "180g", pct: 27, color: "bg-[hsl(var(--synth-cyan))]" },
          { label: "Carbs", value: "62g", goal: "250g", pct: 25, color: "bg-[hsl(var(--synth-orange))]" },
          { label: "Fat", value: "18g", goal: "70g", pct: 26, color: "bg-[hsl(var(--synth-pink))]" },
        ].map((m) => (
          <div key={m.label} className="space-y-0.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">{m.label}</span>
              <span className="font-bold text-foreground">{m.value} <span className="text-muted-foreground font-normal">/ {m.goal}</span></span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${m.color}`} style={{ width: `${m.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[8px] text-muted-foreground text-center">
        Daily totals update in real-time after each scan
      </p>
    </div>
  </div>
);

const WorkoutLoggerDemo = () => (
  <div className="relative bg-card border border-border overflow-hidden">
    <div className="p-4 space-y-3">
      {/* Exercise header */}
      <div className="flex items-center gap-2">
        <Dumbbell size={14} className="text-primary" />
        <div>
          <p className="text-xs font-bold text-foreground">Barbell Back Squat</p>
          <p className="text-[9px] text-muted-foreground">Week 3 · Day 1 · Foundation Block</p>
        </div>
      </div>

      {/* Video placeholder */}
      <div className="aspect-video bg-muted/30 border border-border flex items-center justify-center">
        <div className="text-center space-y-1">
          <Eye size={20} className="text-muted-foreground mx-auto" />
          <p className="text-[9px] text-muted-foreground">HD Instructional Video</p>
        </div>
      </div>

      {/* The Why */}
      <div className="bg-primary/5 border-l-2 border-primary px-3 py-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-0.5">The Why</p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Full-depth squats build quad, glute, and core strength simultaneously. Keep chest up, drive knees out.
        </p>
      </div>

      {/* Logging grid */}
      <div className="space-y-1">
        <div className="grid grid-cols-4 gap-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground px-1">
          <span>Set</span><span>Reps</span><span>Weight</span><span>RPE</span>
        </div>
        {[
          { set: 1, reps: 8, weight: 185, rpe: 7 },
          { set: 2, reps: 8, weight: 185, rpe: 8 },
          { set: 3, reps: 6, weight: 195, rpe: 9 },
        ].map((s) => (
          <div key={s.set} className="grid grid-cols-4 gap-1">
            {[s.set, s.reps, `${s.weight}lb`, s.rpe].map((val, i) => (
              <div key={i} className="bg-muted/30 border border-border px-2 py-1.5 text-center text-[10px] font-bold text-foreground">
                {val}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Tools row */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { icon: Camera, label: "Form Check" },
          { icon: Zap, label: "Velocity" },
          { icon: MessageCircle, label: "Ask Coach" },
          { icon: Activity, label: "AI Sub" },
        ].map((t) => (
          <div key={t.label} className="flex items-center gap-1 bg-secondary/60 px-2 py-1 border border-border text-[8px] font-bold text-foreground">
            <t.icon size={10} className="text-primary" /> {t.label}
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ProgressDemo = () => (
  <div className="relative bg-card border border-border overflow-hidden">
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <LineChart size={14} className="text-[hsl(var(--synth-cyan))]" />
        <span className="text-xs font-bold text-foreground">Lift Progress — Bench Press</span>
      </div>
      {/* Mock chart */}
      <div className="h-28 flex items-end gap-1 px-1">
        {[135, 145, 150, 155, 155, 165, 170, 175, 180, 185, 190, 195].map((w, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full bg-gradient-to-t from-primary/40 to-primary rounded-t-sm"
              style={{ height: `${((w - 130) / 70) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[8px] text-muted-foreground px-1">
        <span>Week 1</span><span>Week 12</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Current 1RM", value: "225 lb" },
          { label: "12-Week Gain", value: "+40 lb" },
          { label: "Trend", value: "↑ Climbing" },
        ].map((s) => (
          <div key={s.label} className="bg-muted/30 border border-border px-2 py-1.5">
            <p className="text-[7px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className="text-[11px] font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const CoachDMDemo = () => (
  <div className="relative bg-card border border-border overflow-hidden">
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle size={14} className="text-primary" />
        <span className="text-xs font-bold text-foreground">Coach Matt — Direct Message</span>
      </div>
      <div className="space-y-2">
        {/* Coach message */}
        <div className="flex gap-2">
          <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
            <span className="text-[8px] font-bold text-primary">M</span>
          </div>
          <div className="bg-muted/30 border border-border px-3 py-2 max-w-[80%]">
            <p className="text-[10px] text-foreground leading-relaxed">
              Great job on the squats today. Your depth is improving — next week we're adding 10lb. Keep the brace tight at the bottom.
            </p>
            <p className="text-[8px] text-muted-foreground mt-1">Coach Matt · 2h ago</p>
          </div>
        </div>
        {/* User message */}
        <div className="flex gap-2 justify-end">
          <div className="bg-primary/20 border border-primary/30 px-3 py-2 max-w-[80%]">
            <p className="text-[10px] text-foreground leading-relaxed">
              Thanks Coach! Should I keep the tempo slow on the eccentric?
            </p>
            <p className="text-[8px] text-muted-foreground mt-1">You · 1h ago</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const FEATURES: TechFeature[] = [
  {
    id: "posture-ai",
    icon: Camera,
    title: "Posture & Biomechanics Analysis",
    tagline: "Two photos. Full skeletal scan. Data Matt can't get any other way.",
    color: "text-[hsl(var(--synth-cyan))]",
    glowColor: "bg-[hsl(var(--synth-cyan))]/10",
    tier: "custom",
    description: "Take a front and side photo from your phone. Advanced computer vision maps 17 skeletal keypoints, measures joint angles, and detects asymmetries — giving Matt data that used to require $10,000+ sports lab equipment. He uses this data to build your corrective program from scratch, tailored to exactly what your body needs.",
    howItWorks: [
      "Stand in front of your phone camera — front view, then side view",
      "The system detects 17 skeletal keypoints using on-device processing",
      "Joint angles, postural deviations, and asymmetries are measured to sub-degree accuracy",
      "Matt receives the full diagnostic data — postural tilt, alignment scores, compensation patterns",
      "Matt builds your corrective program personally based on the analysis",
    ],
    techSpecs: [
      "On-device skeletal tracking — runs 100% on your phone",
      "Zero data leaves your phone until you share it with Matt",
      "17-point skeletal mapping with confidence scoring",
      "Anterior/posterior tilt, valgus, shoulder asymmetry detection",
    ],
    demoComponent: PostureDemo,
  },
  {
    id: "velocity",
    icon: Zap,
    title: "Velocity-Based Training",
    tagline: "Real-time bar speed. Auto-regulate your load. Train smarter.",
    color: "text-[hsl(var(--synth-orange))]",
    glowColor: "bg-[hsl(var(--synth-orange))]/10",
    tier: "foundation",
    description: "Your phone camera tracks the barbell in real-time, measuring concentric and eccentric velocity for every rep. When bar speed drops below your target, the system tells you to stop — preventing junk volume and overtraining. This is the same method used by elite powerlifters and Olympic programs. Matt uses this data to adjust your programming week to week.",
    howItWorks: [
      "Prop your phone to see the barbell from the side",
      "The system tracks wrist position at 30+ frames per second",
      "Real-time velocity displayed in m/s with color-coded feedback",
      "Automatic rep counting and concentric/eccentric phase detection",
      "Set-over-set velocity trends warn you when fatigue is too high",
    ],
    techSpecs: [
      "On-device pose detection at 30+ FPS",
      "Rolling velocity averaging with 5-frame smoothing",
      "Approximate m/s conversion from pixel displacement",
      "Automatic rep detection via Y-axis direction changes",
    ],
    demoComponent: VelocityDemo,
  },
  {
    id: "nutrition",
    icon: Brain,
    title: "Instant Nutrition Scanner",
    tagline: "Snap a photo. Get every macro. No manual entry.",
    color: "text-[hsl(var(--synth-pink))]",
    glowColor: "bg-[hsl(var(--synth-pink))]/10",
    tier: "foundation",
    description: "Take a photo of your meal and the system identifies every food item, estimates portions, and calculates calories, protein, carbs, fat, and fiber — instantly. Daily totals update in real-time, and you can track 7-day trends, set personal macro goals, and print weekly nutrition reports. Matt can see your nutrition data too, so he can adjust your programming if needed.",
    howItWorks: [
      "Point your camera at any meal or snack",
      "Food items are identified and portion sizes estimated automatically",
      "Macros calculated: calories, protein, carbs, fat, fiber",
      "Daily running totals update immediately with progress bars",
      "7-day trend charts show macro adherence over time",
    ],
    techSpecs: [
      "Computer vision food recognition",
      "Sub-3-second processing time",
      "Persistent nutrition logs with 30-day history",
      "Custom daily goals per macro with profile settings",
    ],
    demoComponent: NutritionDemo,
  },
  {
    id: "workout-logger",
    icon: Dumbbell,
    title: "Smart Workout Logger",
    tagline: "HD video demos. Coach cues. One-tap logging. OCR scanning.",
    color: "text-primary",
    glowColor: "bg-primary/10",
    tier: "free",
    description: "Every exercise includes HD video demonstrations, Matt's coaching cues ('The Why'), and an intuitive logging interface designed for the gym floor. Log sets, reps, weight, and RPE. Scan handwritten workout notes with OCR. Add voice memos. Flag exercises for coach review. Your entire training history, searchable and graphable.",
    howItWorks: [
      "Open your program — exercises are loaded in order",
      "Watch the HD demo video and read Matt's coaching cues",
      "Log each set: reps, weight, RPE — with huge touch targets",
      "Use the camera to OCR-scan handwritten workout sheets",
      "Flag any exercise to get direct coach feedback",
    ],
    techSpecs: [
      "200+ exercise library with instructional videos",
      "OCR workout scanning via AI vision",
      "Voice-to-text notes via SpeechRecognition API",
      "Offline-first: logs sync when reconnected",
    ],
    demoComponent: WorkoutLoggerDemo,
  },
  {
    id: "progress",
    icon: LineChart,
    title: "Progress Tracking & Insights",
    tagline: "Estimated 1RM. Trend analysis. Recovery data.",
    color: "text-[hsl(var(--synth-cyan))]",
    glowColor: "bg-[hsl(var(--synth-cyan))]/10",
    tier: "foundation",
    description: "Every lift you log feeds into estimated 1RM calculations, trend graphs, and performance insights. The system detects plateaus and flags overreaching patterns — data Matt uses to adjust your programming. He can add notes directly to your progress charts so you always know what's next.",
    howItWorks: [
      "Log your lifts — 1RM is estimated automatically (Epley formula)",
      "Track progress over weeks and months with visual charts",
      "The system analyzes trends and flags stalls or overreaching",
      "Recovery advisor suggests deload or sleep adjustments",
      "Coach Matt can annotate your charts with personal notes",
    ],
    techSpecs: [
      "Epley 1RM estimation with trend regression",
      "Interactive progress graphs",
      "Recovery advisor based on training volume analysis",
      "Coach notes system linked to individual progress logs",
    ],
    demoComponent: ProgressDemo,
  },
  {
    id: "coach-dm",
    icon: MessageCircle,
    title: "Direct Coach Messaging",
    tagline: "Message Coach Matt directly. Get answers within 24 hours.",
    color: "text-primary",
    glowColor: "bg-primary/10",
    tier: "custom",
    description: "Have a question about your form? Not sure about a substitution? Message Coach Matt directly from your dashboard. He reviews every message personally and responds within 24 hours. This is Matt, looking at your video, giving you real feedback.",
    howItWorks: [
      "Open Coach Messaging from your dashboard",
      "Type your question or attach a video clip",
      "Matt gets notified and reviews your message",
      "You get a personal response — typically within 24 hours",
      "Full conversation history is saved in your profile",
    ],
    techSpecs: [
      "Realtime messaging via database subscriptions",
      "Video attachment support for form checks",
      "Read receipts and notification system",
      "Smart inbox with priority routing for urgent questions",
    ],
    demoComponent: CoachDMDemo,
  },
];

/* ─── Feature Section Component ─── */
const FeatureSection = ({ feature, index }: { feature: TechFeature; index: number }) => {
  const [expanded, setExpanded] = useState(false);
  const { subscriptionTier } = useAuth();
  const Demo = feature.demoComponent;

  const tierLabels: Record<string, string> = {
    free: "All Members",
    foundation: "Foundation+",
    custom: "Custom+",
  };

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
        {/* Header */}
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

          {/* Live Demo */}
          <div className="mb-4">
            <Demo />
          </div>

          <p className="text-xs text-foreground-soft leading-relaxed mb-4">{feature.description}</p>

          {/* Expand/Collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-all"
          >
            {expanded ? "Hide Details" : "How It Works & Tech Specs"}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-4">
                  {/* How it works */}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground mb-2 flex items-center gap-1.5">
                      <Target size={12} className="text-primary" /> How It Works
                    </h3>
                    <ol className="space-y-1.5">
                      {feature.howItWorks.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
                          <span className="bg-primary/10 text-primary text-[9px] font-bold w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Tech specs */}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground mb-2 flex items-center gap-1.5">
                      <Cpu size={12} className="text-[hsl(var(--synth-cyan))]" /> Under the Hood
                    </h3>
                    <ul className="space-y-1">
                      {feature.techSpecs.map((spec, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
                          <span className="text-[hsl(var(--synth-cyan))] mt-0.5">▸</span>
                          {spec}
                        </li>
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

/* ─── Page ─── */
const TheEdge = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="The M² Edge — Training Technology Suite"
        description="AI posture analysis, velocity-based training, nutrition scanning, smart workout logging — all running on your phone. Technology that's 5 years ahead."
        path="/the-edge"
      />
      <AppNavbar />

      <div className="container pt-20 pb-12 px-4 sm:px-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          {/* Hero */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={18} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                The M² Edge
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground mb-2">
              Training Technology<br />
              <span className="text-primary">5 Years Ahead</span>
            </h1>
            <p className="text-sm text-foreground-soft max-w-xl leading-relaxed">
              Matt's two passions — computer engineering and exercise science — fused into a platform
              no other trainer can match. Advanced analysis, real-time tracking, and intelligent
              tools that give Matt data no one else has — and give you results no one else can deliver.
            </p>
          </div>

          {/* Quick nav */}
          <div className="flex flex-wrap gap-2 mb-8">
            {FEATURES.map((f) => (
              <a
                key={f.id}
                href={`#${f.id}`}
                className="flex items-center gap-1.5 bg-secondary/60 px-2.5 py-1.5 border border-border hover:border-primary/40 transition-all text-[10px] font-bold text-foreground"
              >
                <f.icon size={12} className={f.color} />
                {f.title.split(" ").slice(0, 3).join(" ")}
              </a>
            ))}
          </div>

          {/* On-device badge */}
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-4 py-2.5 mb-8">
            <Shield size={16} className="text-green-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-green-400">Privacy-First Technology</p>
              <p className="text-[10px] text-muted-foreground">
                All camera-based features process on your device. No video or photos are uploaded unless you explicitly share them with your coach.
              </p>
            </div>
          </div>

          {/* Feature sections */}
          <div className="space-y-6">
            {FEATURES.map((f, i) => (
              <FeatureSection key={f.id} feature={f} index={i} />
            ))}
          </div>

          {/* CTA */}
          <section className="mt-10">
            <TrialCTA variant="comparison" />
          </section>
        </motion.div>
      </div>
    </div>
  );
};

export default TheEdge;
