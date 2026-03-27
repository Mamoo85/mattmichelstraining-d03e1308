import {
  Dumbbell, Timer, Zap, BarChart3, Sparkles, Wrench, Trophy, Camera, Target, Users,
  Brain, Play, MessageCircle, Home, Flame, Activity
} from "lucide-react";
import type { FeatureTip } from "./FeatureLearningModal";

import tipPortalImg from "@/assets/tip-workout-portal.jpg";
import tipGeneratorImg from "@/assets/tip-workout-generator.jpg";
import tipFixitImg from "@/assets/tip-fixit-engine.jpg";
import tipProveItImg from "@/assets/tip-prove-it.jpg";

export const WORKOUT_PORTAL_TIP: FeatureTip = {
  storageKey: "m2-tip-workout-portal-v2",
  image: tipPortalImg,
  title: "The Workout Portal",
  subtitle: "Your live training session — log every set, track rest times, and crush it.",
  bullets: [
    { icon: <Dumbbell size={18} />, text: "Log sets, reps & weight in real-time" },
    { icon: <Timer size={18} />, text: "Built-in rest timer between sets" },
    { icon: <Zap size={18} />, text: "Swap exercises based on your equipment" },
    { icon: <BarChart3 size={18} />, text: "See previous performance for every lift" },
  ],
};

export const WORKOUT_GENERATOR_TIP: FeatureTip = {
  storageKey: "m2-tip-workout-generator-v2",
  image: tipGeneratorImg,
  title: "AI Workout Generator",
  subtitle: "Tell the AI your goal, equipment, and time — it builds the workout for you.",
  bullets: [
    { icon: <Sparkles size={18} />, text: "Generates a full workout in seconds" },
    { icon: <Target size={18} />, text: "Customized to your goals and gear" },
    { icon: <Dumbbell size={18} />, text: "Launch it straight into the Portal" },
    { icon: <Users size={18} />, text: "Share your creations with the community" },
  ],
};

export const FIXIT_ENGINE_TIP: FeatureTip = {
  storageKey: "m2-tip-fixit-engine-v3",
  image: tipFixitImg,
  title: "Fix It Engine",
  subtitle: "Something hurting? Tell Coach Matt's system where it hurts and get a corrective protocol built for you.",
  bullets: [
    { icon: <Wrench size={18} />, text: "Select your pain point or problem area" },
    { icon: <Sparkles size={18} />, text: "Get targeted corrective exercises from Matt's protocols" },
    { icon: <Dumbbell size={18} />, text: "Follow along with guided exercises" },
    { icon: <Target size={18} />, text: "Built from Coach Matt's Fix It protocols" },
  ],
};

export const PROVE_IT_TIP: FeatureTip = {
  storageKey: "m2-tip-prove-it-v2",
  image: tipProveItImg,
  title: "Prove It — PR Submissions",
  subtitle: "Think you hit a new best? Record it, submit it, and make it official.",
  bullets: [
    { icon: <Trophy size={18} />, text: "Select the lift and enter your numbers" },
    { icon: <Camera size={18} />, text: "Upload or record your video proof" },
    { icon: <Target size={18} />, text: "Coach Matt reviews and approves it" },
    { icon: <Zap size={18} />, text: "Approved PRs show on your profile forever" },
  ],
};

/* ── Zone Dashboard Tab Tips ── */

export const ZONE_LIFTS_TIP: FeatureTip = {
  storageKey: "m2-tip-zone-lifts-v1",
  fallbackIcon: <BarChart3 size={32} style={{ color: "#f97316" }} />,
  fallbackGradient: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.08))",
  title: "Lift Tracker",
  subtitle: "Track your compound lifts, view progress charts, and submit PRs — all in one place.",
  bullets: [
    { icon: <BarChart3 size={18} />, text: "Progress charts for every major lift" },
    { icon: <Trophy size={18} />, text: "Submit PRs for Coach Matt to verify" },
    { icon: <Zap size={18} />, text: "See the power of progressive overload" },
    { icon: <Activity size={18} />, text: "Your training history visualized" },
  ],
};

export const ZONE_GENERATE_TIP: FeatureTip = {
  storageKey: "m2-tip-zone-generate-v1",
  fallbackIcon: <Brain size={32} style={{ color: "#a855f7" }} />,
  fallbackGradient: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(0,240,255,0.08))",
  title: "AI Generator",
  subtitle: "Build perfect workouts, corrective protocols, and access your full AI toolbox.",
  bullets: [
    { icon: <Sparkles size={18} />, text: "AI-powered workout builder in seconds" },
    { icon: <Wrench size={18} />, text: "Fix It Engine for pain & rehab" },
    { icon: <Camera size={18} />, text: "AI camera tools for form analysis" },
    { icon: <Timer size={18} />, text: "Auto-configured interval timers" },
  ],
};

export const ZONE_TRAIN_TIP: FeatureTip = {
  storageKey: "m2-tip-zone-train-v1",
  fallbackIcon: <Dumbbell size={32} style={{ color: "#00f0ff" }} />,
  fallbackGradient: "linear-gradient(135deg, rgba(0,240,255,0.12), rgba(6,182,212,0.06))",
  title: "Your Training Hub",
  subtitle: "Today's training, your workout library, and all your active programs.",
  bullets: [
    { icon: <Play size={18} />, text: "Today's Training picks up where you left off" },
    { icon: <Flame size={18} />, text: "Browse coach-built & community workouts" },
    { icon: <Target size={18} />, text: "Track active training programs" },
    { icon: <Dumbbell size={18} />, text: "Launch any workout into the Portal" },
  ],
};

export const ZONE_HOME_TIP: FeatureTip = {
  storageKey: "m2-tip-zone-home-v1",
  fallbackIcon: <Home size={32} style={{ color: "#22c55e" }} />,
  fallbackGradient: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(249,115,22,0.08))",
  title: "Home Base",
  subtitle: "Stay connected with Coach Matt, join challenges, and see what the community is doing.",
  bullets: [
    { icon: <MessageCircle size={18} />, text: "Direct message Coach Matt anytime" },
    { icon: <Trophy size={18} />, text: "Monthly challenges & leaderboards" },
    { icon: <Users size={18} />, text: "Community activity & shared workouts" },
    { icon: <Target size={18} />, text: "Monthly focus topics from Coach Matt" },
  ],
};
