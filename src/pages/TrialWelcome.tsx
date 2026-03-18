import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Dumbbell, Shield, Zap, ArrowRight, Loader2, CheckCircle2, Flag, Video, BookOpen } from "lucide-react";
import AppNavbar from "@/components/AppNavbar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import m2Logo from "@/assets/m2-logo-official.jpg";

const TRIAL_PROGRAMS = [
  {
    id: "a1b2c3d4-0001-4000-8000-000000000001",
    title: "Youth Athlete Foundation",
    subtitle: "Ages 11–14",
    description: "Build the engine before you add the horsepower. Two weeks of bodyweight mastery, core control, and perfect movement patterns.",
    icon: Shield,
    tags: ["3 Days/Week", "Bodyweight", "Core"],
    color: "text-emerald-500",
  },
  {
    id: "a1b2c3d4-0002-4000-8000-000000000002",
    title: "The Desk Jockey Reset",
    subtitle: "Adults & Parents",
    description: "Undo the damage of the office chair and the steering wheel. Two weeks of posture restoration, joint lubrication, and foundational strength.",
    icon: Zap,
    tags: ["3 Days/Week", "Mobility", "Strength"],
    color: "text-amber-500",
  },
  {
    id: "a1b2c3d4-0003-4000-8000-000000000003",
    title: "HS Senior In-Season Recovery",
    subtitle: "High School Athletes",
    description: "You don't build absolute strength in-season; you survive. Two weeks of CNS recovery, joint centration, and blood flow for game day.",
    icon: Dumbbell,
    tags: ["2 Days/Week", "Recovery", "In-Season"],
    color: "text-blue-500",
  },
];

const HOW_IT_WORKS = [
  { icon: BookOpen, text: "Select your 2-week intro track below." },
  { icon: Dumbbell, text: "Log every set and rep in the portal." },
  { icon: Flag, text: 'Use the "Flag Coach Matt" button. Upload a video of your toughest set, and I will personally review your form.' },
];

const TrialWelcome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selecting, setSelecting] = useState<string | null>(null);

  const handleSelectProgram = async (programId: string) => {
    if (!user) {
      navigate("/auth?redirect=/trial-welcome");
      return;
    }

    setSelecting(programId);
    try {
      // Set trial_started_at on profile
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

      toast({ title: "You're in! 🎯", description: "Your 14-day trial has started. Let's get to work." });
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
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <img src={m2Logo} alt="M² Training" className="w-20 h-20 object-contain mx-auto mb-4" />
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground mb-3">
            Real Strength. No Shortcuts.
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Welcome to the M² Training system. You have <strong className="text-foreground">14 days</strong> to see how
            we do things the right way. No fake influencer workouts, just proven mechanics.
          </p>
        </motion.div>

        {/* HOW IT WORKS */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="bg-card shadow-m2 p-6 mb-8 border-l-4 border-primary"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 font-mono">
            Here's How This Works
          </p>
          <div className="space-y-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <step.icon size={12} className="text-primary" />
                </div>
                <p className="text-sm text-foreground leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-primary/5 border border-primary/20 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              When your 14 days are up, you decide: <strong className="text-foreground">walk away</strong>, or subscribe to keep your
              progress, unlock the full library, and keep my eyes on your training.{" "}
              <span className="text-primary font-bold">Let's get to work.</span>
            </p>
          </div>
        </motion.div>

        {/* PROGRAM SELECTION */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mb-8"
        >
          <h2 className="text-lg font-bold text-foreground mb-1 text-center">
            Select Your 2-Week Intro Track
          </h2>
          <p className="text-xs text-muted-foreground text-center mb-4">
            Pick the program that fits you best. You'll start Day 1 immediately.
          </p>

          <div className="grid grid-cols-1 gap-4">
            {TRIAL_PROGRAMS.map((program) => (
              <motion.button
                key={program.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={selecting !== null}
                onClick={() => handleSelectProgram(program.id)}
                className="bg-card shadow-m2 p-5 text-left border-2 border-border hover:border-primary transition-all disabled:opacity-60 group"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 bg-primary/10 flex items-center justify-center flex-shrink-0 ${program.color}`}>
                    <program.icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-bold text-foreground">{program.title}</h3>
                      <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 font-bold uppercase tracking-widest">
                        {program.subtitle}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">{program.description}</p>
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
        </motion.div>

        {/* BOTTOM CTA */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="text-center"
        >
          <p className="text-[10px] text-muted-foreground mb-2">
            No credit card required. 7 days of real training, on us.
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
