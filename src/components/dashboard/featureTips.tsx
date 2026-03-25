import {
  Dumbbell, Timer, Zap, BarChart3, Sparkles, Wrench, Trophy, Camera, Target, Users
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
  storageKey: "m2-tip-fixit-engine-v2",
  image: tipFixitImg,
  title: "Fix It Engine",
  subtitle: "Something hurting? Tell the AI where, and get corrective exercises instantly.",
  bullets: [
    { icon: <Wrench size={18} />, text: "Select your pain point or problem area" },
    { icon: <Sparkles size={18} />, text: "AI recommends targeted corrective work" },
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
