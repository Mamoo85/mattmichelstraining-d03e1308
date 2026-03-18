import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, Shield, Zap, ArrowRight, Loader2, Flag, Video, BookOpen, Users, User, AlertTriangle } from "lucide-react";
import AppNavbar from "@/components/AppNavbar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import m2Logo from "@/assets/m2-logo-official.jpg";

type TrialPath = "parent" | "basic" | null;

const TRIAL_PROGRAMS = [
  {
    id: "a1b2c3d4-0001-4000-8000-000000000001",
    title: "Youth Athlete Foundation",
    subtitle: "Ages 11–14",
    description: "Bodyweight mastery, core control, and perfect movement patterns.",
    icon: Shield,
    tags: ["3 Days/Week", "Bodyweight", "Core"],
    color: "text-emerald-500",
    paths: ["parent", "basic"] as TrialPath[],
  },
  {
    id: "a1b2c3d4-0002-4000-8000-000000000002",
    title: "The Desk Jockey Reset",
    subtitle: "Adults & Parents",
    description: "Posture restoration, joint mobility, and foundational strength.",
    icon: Zap,
    tags: ["3 Days/Week", "Mobility", "Strength"],
    color: "text-amber-500",
    paths: ["parent", "basic"] as TrialPath[],
  },
  {
    id: "a1b2c3d4-0003-4000-8000-000000000003",
    title: "HS Senior In-Season Recovery",
    subtitle: "High School Athletes",
    description: "CNS recovery, joint centration, and blood flow for game day.",
    icon: Dumbbell,
    tags: ["2 Days/Week", "Recovery", "In-Season"],
    color: "text-blue-500",
    paths: ["parent", "basic"] as TrialPath[],
  },
];

const HOW_IT_WORKS = [
  { icon: BookOpen, text: "Select your 2-week intro track below." },
  { icon: Dumbbell, text: "Log every set and rep in the portal." },
  { icon: Flag, text: "Flag Coach Matt for personal form review on any exercise." },
];

const TrialWelcome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const urlPath = searchParams.get("path") as TrialPath;

  const [selectedPath, setSelectedPath] = useState<TrialPath>(urlPath);
  const [selecting, setSelecting] = useState<string | null>(null);

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
      // Set trial_started_at and store trial path in profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ trial_started_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Check if already enrolled
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

      toast({ title: "You're in! 🎯", description: `Your 14-day ${selectedPath === "parent" ? "Parent" : "Basic"} trial has started.` });
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Basic Trial */}
            <button
              onClick={() => setSelectedPath("basic")}
              className={`relative p-5 text-left border-2 transition-all ${
                selectedPath === "basic"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {selectedPath === "basic" && (
                <div className="absolute -top-2.5 left-4 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-2 py-0.5">
                  Selected
                </div>
              )}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary/10 flex items-center justify-center">
                  <User size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Basic Trial</h3>
                  <p className="text-[10px] text-muted-foreground">Auto-charges $15.99/mo after trial</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Individual membership. Exercise library, monthly focus, challenges, and workout logging.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <AlertTriangle size={10} className="text-amber-500" />
                No child invite feature on this plan
              </div>
            </button>

            {/* Parent Trial */}
            <button
              onClick={() => setSelectedPath("parent")}
              className={`relative p-5 text-left border-2 transition-all ${
                selectedPath === "parent"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {selectedPath === "parent" && (
                <div className="absolute -top-2.5 left-4 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-2 py-0.5">
                  Selected
                </div>
              )}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary/10 flex items-center justify-center">
                  <Users size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Parent / Youth Development Trial</h3>
                  <p className="text-[10px] text-muted-foreground">Auto-charges $49.99/mo (Pro) after trial</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Everything in Basic + custom programming, Fix It library, coach form review, and child invite links.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-primary font-bold">
                <Users size={10} />
                Includes child account linking
              </div>
            </button>
          </div>
        </motion.div>

        {/* HOW IT WORKS */}
        <AnimatePresence>
          {selectedPath && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
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
                    {selectedPath === "parent" ? (
                      <strong className="text-foreground">You'll auto-start the Pro membership at $49.99/mo unless you cancel.</strong>
                    ) : (
                      <strong className="text-foreground">You'll auto-start the Basic membership at $15.99/mo unless you cancel.</strong>
                    )}{" "}
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

export default TrialWelcome;
