import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell, Shield, Zap, ArrowRight, Loader2, Flag, BookOpen,
  Users, User, AlertTriangle, Star, Video, Calendar, Upload, CheckCircle2,
} from "lucide-react";
import AppNavbar from "@/components/AppNavbar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import m2Logo from "@/assets/m2-logo-official.jpg";

type TrialPath = "parent" | "basic" | "pro" | null;

const TRIAL_PROGRAMS = [
  {
    id: "a1b2c3d4-0001-4000-8000-000000000001",
    title: "Youth Athlete Foundation",
    subtitle: "Ages 11–14",
    description: "Bodyweight mastery, core control, and perfect movement patterns.",
    icon: Shield,
    tags: ["3 Days/Week", "Bodyweight", "Core"],
    color: "text-emerald-500",
  },
  {
    id: "a1b2c3d4-0002-4000-8000-000000000002",
    title: "The Desk Jockey Reset",
    subtitle: "Adults & Parents",
    description: "Posture restoration, joint mobility, and foundational strength.",
    icon: Zap,
    tags: ["3 Days/Week", "Mobility", "Strength"],
    color: "text-amber-500",
  },
  {
    id: "a1b2c3d4-0003-4000-8000-000000000003",
    title: "HS Senior In-Season Recovery",
    subtitle: "High School Athletes",
    description: "CNS recovery, joint centration, and blood flow for game day.",
    icon: Dumbbell,
    tags: ["2 Days/Week", "Recovery", "In-Season"],
    color: "text-blue-500",
  },
];

const HOW_IT_WORKS = [
  { icon: BookOpen, text: "Select your 2-week intro track below." },
  { icon: Dumbbell, text: "Log every set and rep in the portal." },
  { icon: Flag, text: "Flag Coach Matt for personal form review on any exercise." },
];

const ASSESSMENT_OPTIONS = [
  {
    icon: Upload,
    title: "Send a Video",
    desc: "Record 5 overhead squats (front & side). Upload through the portal and Matt reviews within 48 hours.",
  },
  {
    icon: Calendar,
    title: "Schedule a Live Assessment",
    desc: "Book a free 15-min video call. In-person available in Grosse Pointe Park, MI.",
    link: "/schedule",
  },
];

const TrialWelcome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const urlPath = searchParams.get("path") as TrialPath;

  const [selectedPath, setSelectedPath] = useState<TrialPath>(urlPath);
  const [selecting, setSelecting] = useState<string | null>(null);

  const showAssessment = selectedPath === "parent" || selectedPath === "pro";

  const autoChargeLabel = selectedPath === "basic"
    ? "Basic membership at $15.99/mo"
    : "Pro membership at $49.99/mo";

  const handleSelectProgram = async (programId: string) => {
    if (!user) {
      navigate(`/auth?redirect=/trial-welcome${selectedPath ? `?path=${selectedPath}` : ""}`);
      return;
    }
    if (!selectedPath) {
      toast({ title: "Choose your trial type first", variant: "destructive" });
      return;
    }

    setSelecting(programId);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ trial_started_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      const { data: existing } = await supabase
        .from("user_active_programs")
        .select("id")
        .eq("user_id", user.id)
        .eq("program_id", programId)
        .maybeSingle();

      if (!existing) {
        const { error: enrollError } = await supabase
          .from("user_active_programs")
          .insert({ user_id: user.id, program_id: programId, status: "active" });
        if (enrollError) throw enrollError;
      }

      queryClient.invalidateQueries({ queryKey: ["trial-status"] });

      const pathLabel = selectedPath === "parent" ? "Parent" : selectedPath === "pro" ? "Pro" : "Basic";
      toast({ title: "You're in! 🎯", description: `Your 14-day ${pathLabel} trial has started.` });
      navigate("/dashboard");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSelecting(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-16 max-w-3xl mx-auto px-4">
        {/* HERO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <img src={m2Logo} alt="M² Training" className="w-20 h-20 object-contain mx-auto mb-4" />
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground mb-3">
            Real Strength. No Shortcuts.
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            <strong className="text-foreground">14 days free.</strong> Pick your trial path, choose a program, and start training today.
          </p>
        </motion.div>

        {/* TRIAL PATH SELECTION */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h2 className="text-sm font-bold text-foreground text-center mb-1">
            Step 1 — Choose Your Trial Type
          </h2>
          <p className="text-xs text-muted-foreground text-center mb-4">
            This determines which membership you'll auto-start after 14 days if you don't cancel.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Basic Trial */}
            <TrialPathCard
              selected={selectedPath === "basic"}
              onClick={() => setSelectedPath("basic")}
              icon={User}
              title="Basic Trial"
              charge="$15.99/mo after trial"
              desc="Exercise library, monthly focus, challenges, and workout logging."
              badge={null}
              warning="No child invite · No custom program"
            />

            {/* Parent / Youth Dev Trial */}
            <TrialPathCard
              selected={selectedPath === "parent"}
              onClick={() => setSelectedPath("parent")}
              icon={Users}
              title="Parent / Youth Dev"
              charge="$49.99/mo (Pro) after trial"
              desc="Everything in Basic + custom programming, Fix It library, coach form review, and child invite links."
              badge="Includes child linking"
              warning={null}
              bonus="Free postural assessment"
            />

            {/* Adult Pro Trial */}
            <TrialPathCard
              selected={selectedPath === "pro"}
              onClick={() => setSelectedPath("pro")}
              icon={Star}
              title="Adult Pro Trial"
              charge="$49.99/mo (Pro) after trial"
              desc="Everything in Basic + custom programming built for you, Fix It library, and direct coach form review."
              badge={null}
              warning="No child invite on this plan"
              bonus="Free postural assessment"
            />
          </div>
        </motion.div>

        {/* CONTENT AFTER SELECTION */}
        <AnimatePresence>
          {selectedPath && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {/* FREE ASSESSMENT — only for parent & pro */}
              {showAssessment && (
                <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-5 sm:p-6 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Video size={18} className="text-primary" />
                    <h3 className="text-sm font-bold text-foreground">Free Postural Assessment — Included With Your Trial</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    Because your trial includes a custom program from Matt, we start with an assessment so your program is built around <strong className="text-foreground">your</strong> body, not a template. Choose how you'd like to do it:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ASSESSMENT_OPTIONS.map((opt) => (
                      <div key={opt.title} className="bg-card border border-border p-4 flex gap-3">
                        <div className="w-9 h-9 bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <opt.icon size={16} className="text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-foreground mb-0.5">{opt.title}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{opt.desc}</p>
                          {opt.link && (
                            <Link
                              to={opt.link}
                              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary mt-2 hover:underline"
                            >
                              Book Now <ArrowRight size={10} />
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] text-primary font-bold">
                    <CheckCircle2 size={12} />
                    100% free during your trial — no strings attached
                  </div>
                </div>
              )}

              {/* HOW IT WORKS */}
              <div className="bg-card shadow-m2 p-5 mb-8 border-l-4 border-primary">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 font-mono">
                  Here's How This Works
                </p>
                <div className="space-y-2.5">
                  {HOW_IT_WORKS.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <step.icon size={12} className="text-primary" />
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{step.text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 bg-primary/5 border border-primary/20 p-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    After 14 days:{" "}
                    <strong className="text-foreground">You'll auto-start the {autoChargeLabel} unless you cancel.</strong>{" "}
                    <span className="text-primary font-bold">Cancel anytime.</span>
                  </p>
                </div>
              </div>

              {/* PROGRAM SELECTION */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-foreground mb-1 text-center">
                  Step 2 — Select Your 2-Week Intro Track
                </h2>
                <p className="text-xs text-muted-foreground text-center mb-4">
                  Pick the program that fits. You start Day 1 immediately.
                </p>

                <div className="grid grid-cols-1 gap-3">
                  {TRIAL_PROGRAMS.map((program) => (
                    <motion.button
                      key={program.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      disabled={selecting !== null}
                      onClick={() => handleSelectProgram(program.id)}
                      className="bg-card shadow-m2 p-4 text-left border-2 border-border hover:border-primary transition-all disabled:opacity-60 group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 bg-primary/10 flex items-center justify-center flex-shrink-0 ${program.color}`}>
                          <program.icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-sm font-bold text-foreground">{program.title}</h3>
                            <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 font-bold uppercase tracking-widest">
                              {program.subtitle}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mb-1.5">{program.description}</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {program.tags.map((tag) => (
                              <span key={tag} className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 font-bold uppercase tracking-widest">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex-shrink-0 self-center">
                          {selecting === program.id ? (
                            <Loader2 size={18} className="text-primary animate-spin" />
                          ) : (
                            <ArrowRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTTOM */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <p className="text-[10px] text-muted-foreground mb-2">
            No credit card required to start. Cancel before day 14 to avoid charges.
          </p>
          <p className="text-[10px] text-muted-foreground">
            © {new Date().getFullYear()} M² Training · Grosse Pointe Park, MI
          </p>
        </motion.div>
      </div>
    </div>
  );
};

/* ---------- Trial Path Card ---------- */
interface TrialPathCardProps {
  selected: boolean;
  onClick: () => void;
  icon: typeof User;
  title: string;
  charge: string;
  desc: string;
  badge: string | null;
  warning: string | null;
  bonus?: string;
}

const TrialPathCard = ({ selected, onClick, icon: Icon, title, charge, desc, badge, warning, bonus }: TrialPathCardProps) => (
  <button
    onClick={onClick}
    className={`relative p-4 text-left border-2 transition-all ${
      selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
    }`}
  >
    {selected && (
      <div className="absolute -top-2.5 left-4 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-2 py-0.5">
        Selected
      </div>
    )}
    <div className="flex items-center gap-3 mb-2">
      <div className="w-9 h-9 bg-primary/10 flex items-center justify-center">
        <Icon size={18} className="text-primary" />
      </div>
      <div>
        <h3 className="text-xs font-bold text-foreground leading-tight">{title}</h3>
        <p className="text-[10px] text-muted-foreground">{charge}</p>
      </div>
    </div>
    <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
    {bonus && (
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-primary font-bold">
        <Video size={10} />
        {bonus}
      </div>
    )}
    {badge && (
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-primary font-bold">
        <Users size={10} />
        {badge}
      </div>
    )}
    {warning && (
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <AlertTriangle size={10} className="text-amber-500" />
        {warning}
      </div>
    )}
  </button>
);

export default TrialWelcome;
