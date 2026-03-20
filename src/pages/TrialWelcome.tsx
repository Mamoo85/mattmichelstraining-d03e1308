import { useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell, Shield, Zap, ArrowRight, Loader2, Flag, BookOpen,
  Users, User, AlertTriangle, Star, Video, Calendar, Upload,
  CheckCircle2, CreditCard, MessageSquare, Camera,
} from "lucide-react";
import AppNavbar from "@/components/layout/AppNavbar";
import { useAuth, TIERS } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import m2Logo from "@/assets/m2-logo.jpg";

type TrialPath = "parent" | "basic" | "foundation" | null;

const TRIAL_PROGRAMS = [
  {
    id: "a1b2c3d4-0001-4000-8000-000000000001",
    title: "Youth Athlete Foundation",
    subtitle: "Ages 11–14",
    description: "Bodyweight mastery, core control, and perfect movement patterns.",
    icon: Shield,
    tags: ["3 Days/Week", "Bodyweight", "Core"],
    color: "text-emerald-500",
    forPaths: ["basic", "parent", "foundation"] as TrialPath[],
  },
  {
    id: "a1b2c3d4-0002-4000-8000-000000000002",
    title: "The Desk Jockey Reset",
    subtitle: "Adults & Parents",
    description: "Posture restoration, joint mobility, and foundational strength.",
    icon: Zap,
    tags: ["3 Days/Week", "Mobility", "Strength"],
    color: "text-amber-500",
    forPaths: ["basic", "parent", "foundation"] as TrialPath[],
  },
  {
    id: "a1b2c3d4-0003-4000-8000-000000000003",
    title: "HS Senior In-Season Recovery",
    subtitle: "High School Athletes",
    description: "CNS recovery, joint centration, and blood flow for game day.",
    icon: Dumbbell,
    tags: ["2 Days/Week", "Recovery", "In-Season"],
    color: "text-blue-500",
    forPaths: ["basic", "parent", "foundation"] as TrialPath[],
  },
  {
    id: "custom",
    title: "Custom Program — Built by Matt",
    subtitle: "Foundation & Youth Dev Only",
    description: "Matt builds your program from scratch after reviewing your postural assessment. Start with a free assessment.",
    icon: Star,
    tags: ["Personalized", "Assessment Included", "1-on-1"],
    color: "text-primary",
    forPaths: ["parent", "foundation"] as TrialPath[],
  },
];

const TrialWelcome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const urlPath = searchParams.get("path") as TrialPath;
  const checkoutDone = searchParams.get("checkout") === "success";

  const [selectedPath, setSelectedPath] = useState<TrialPath>(urlPath);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);

  // After checkout, user can pick a program
  const canSelectProgram = checkoutDone;

  const autoChargeLabel = selectedPath === "basic"
    ? "Basic membership at $12.99/mo"
    : "Foundation membership at $19.99/mo";

  const handleStartTrial = async () => {
    if (!user) {
      navigate(`/auth?redirect=/trial-welcome${selectedPath ? `?path=${selectedPath}` : ""}`);
      return;
    }
    if (!selectedPath) {
      toast({ title: "Choose your trial type first", variant: "destructive" });
      return;
    }

    setCheckingOut(true);
    try {
      const priceId = selectedPath === "basic" ? TIERS.basic.price_id : TIERS.foundation.price_id;

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId,
          trialDays: 14,
          trialPath: selectedPath,
          successUrl: `/trial-welcome?path=${selectedPath}&checkout=success`,
          cancelUrl: `/trial-welcome?path=${selectedPath}`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      toast({ title: "Checkout error", description: e.message, variant: "destructive" });
    } finally {
      setCheckingOut(false);
    }
  };

  const handleSelectProgram = async (programId: string) => {
    // Custom program → show assessment options
    if (programId === "custom") {
      setShowAssessment(true);
      return;
    }

    if (!user) return;

    setSelecting(programId);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          trial_started_at: new Date().toISOString(),
          trial_path: selectedPath,
        } as any)
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
      toast({ title: "You're in! 🎯", description: "Your 14-day trial has started. Let's get to work." });
      navigate("/dashboard");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSelecting(null);
    }
  };

  const visiblePrograms = TRIAL_PROGRAMS.filter(
    (p) => selectedPath && p.forPaths.includes(selectedPath)
  );

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-16 max-w-3xl mx-auto px-4">
        {/* HERO */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <img src={m2Logo} alt="M² Training" className="w-20 h-20 object-contain mx-auto mb-4" />
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground mb-3">
            Real Strength. No Shortcuts.
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            <strong className="text-foreground">14 days free.</strong> Pick your path, enter your card, and start training today.
            You won't be charged until day 15.
          </p>
        </motion.div>

        {/* ─── STEP 1: CHOOSE PATH ─── */}
        {!canSelectProgram && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h2 className="text-sm font-bold text-foreground text-center mb-1">Step 1 — Choose Your Trial Type</h2>
            <p className="text-xs text-muted-foreground text-center mb-4">
              This determines your membership after the 14-day trial.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <TrialPathCard
                selected={selectedPath === "basic"}
                onClick={() => setSelectedPath("basic")}
                icon={User}
                title="Basic Trial"
                charge="$12.99/mo after trial"
                desc="Exercise library, monthly focus, challenges, and workout logging."
                badge={null}
                warning="No child invite · No custom program"
              />
              <TrialPathCard
                selected={selectedPath === "parent"}
                onClick={() => setSelectedPath("parent")}
                icon={Users}
                title="Parent / Youth Dev"
                charge="$19.99/mo (Foundation) after trial"
                desc="Everything in Basic + custom programming, Fix It library, coach form review, and child invite links."
                badge="Includes child linking"
                warning={null}
                bonus="Free postural assessment"
              />
              <TrialPathCard
                selected={selectedPath === "foundation"}
                onClick={() => setSelectedPath("foundation")}
                icon={Star}
                title="Adult Foundation Trial"
                charge="$19.99/mo (Foundation) after trial"
                desc="Everything in Basic + 8-week periodized training, Fix It library, and direct coach form review."
                badge={null}
                warning="No child invite on this plan"
                bonus="Free postural assessment"
              />
            </div>

            {/* WHAT YOU GET DURING TRIAL */}
            <AnimatePresence>
              {selectedPath && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-card shadow-m2 p-5 mb-6 border-l-4 border-primary">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 font-mono">
                      Here's How This Works
                    </p>
                    <div className="space-y-2.5">
                      {[
                        { icon: CreditCard, text: "Enter your card below. You won't be charged for 14 days." },
                        { icon: BookOpen, text: "Your free 2-week starter program is loaded instantly — warmup, workout, rolling, and mobility every session. Pick an additional trial program if you want more." },
                        { icon: Dumbbell, text: "Log every set and rep in the portal." },
                        { icon: Flag, text: "Flag Coach Matt for personal form review on any exercise." },
                      ].map((step, i) => (
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
                        <strong className="text-foreground">You'll auto-start the {autoChargeLabel}.</strong>{" "}
                        <span className="text-primary font-bold">Cancel anytime before day 14 and you won't be charged.</span>
                      </p>
                    </div>
                  </div>

                  {/* START TRIAL CTA — requires credit card */}
                  <div className="text-center mb-8">
                    <button
                      onClick={handleStartTrial}
                      disabled={checkingOut}
                      className="bg-primary text-primary-foreground px-8 py-4 text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-3 mx-auto"
                    >
                      {checkingOut ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <CreditCard size={18} />
                      )}
                      {checkingOut ? "Opening Checkout…" : "Start My 14-Day Free Trial"}
                    </button>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Secure checkout via Stripe. You won't be charged until day 15.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ─── STEP 2: PROGRAM SELECTION (only after checkout) ─── */}
        {canSelectProgram && selectedPath && !showAssessment && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-primary/10 border border-primary/20 p-4 mb-6 text-center">
              <CheckCircle2 size={20} className="text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">You're all set! Your 14-day trial is active.</p>
              <p className="text-xs text-muted-foreground">Now choose a program to start training today.</p>
            </div>

            {/* FREE STARTER PROGRAM EXPLAINER */}
            <div className="bg-card shadow-m2 p-5 mb-6 border-l-4 border-primary">
              <div className="flex items-start gap-3">
                <Dumbbell size={18} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">
                    Your Free 2-Week Starter Program Is Ready
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    Every new athlete gets a <strong className="text-foreground">complete 2-week intro program</strong> loaded 
                    into their dashboard automatically — no purchase needed. It's built to show you exactly what M² Training 
                    looks like from the inside.
                  </p>
                  <div className="bg-muted/50 p-3 mb-3 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono mb-1">What's In It</p>
                    <p className="text-xs text-foreground">• <strong>3 sessions per week</strong> across 2 full weeks (6 total workouts)</p>
                    <p className="text-xs text-foreground">• <strong>Warmup → Workout → Rolling → Mobility</strong> structure every session</p>
                    <p className="text-xs text-foreground">• <strong>Progressive overload</strong> — Week 2 builds on Week 1 with increased reps, holds, and distance</p>
                    <p className="text-xs text-foreground">• <strong>Beginner-level</strong> exercises — no gym experience needed</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    <strong className="text-foreground">How to use it:</strong> Open your Dashboard → find "Today's Program" → 
                    follow the exercises in order, log your weights after each set. Matt reviews every session you log. 
                    Think of it as a sample of what a full membership delivers — except you'll get fresh programs monthly, 
                    sport-specific programming, and direct access to Coach Matt.
                  </p>
                  <p className="text-xs text-primary font-bold">
                    Want more than the sample? Pick a trial program below and go deeper.
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-lg font-bold text-foreground mb-1 text-center">
              Choose Your Intro Program
            </h2>
            <p className="text-xs text-muted-foreground text-center mb-4">
              Pick a program to add alongside your free starter. You start Day 1 immediately.
            </p>

            <div className="grid grid-cols-1 gap-3">
              {visiblePrograms.map((program) => (
                <motion.button
                  key={program.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  disabled={selecting !== null}
                  onClick={() => handleSelectProgram(program.id)}
                  className={`bg-card shadow-m2 p-4 text-left border-2 border-border hover:border-primary transition-all disabled:opacity-60 group ${
                    program.id === "custom" ? "border-primary/30 bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 bg-primary/10 flex items-center justify-center flex-shrink-0 ${program.color}`}>
                      <program.icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
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
          </motion.div>
        )}

        {/* ─── CUSTOM PROGRAM ASSESSMENT FLOW ─── */}
        {canSelectProgram && showAssessment && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <button
              onClick={() => setShowAssessment(false)}
              className="text-xs text-primary font-bold uppercase tracking-widest mb-4 flex items-center gap-1 hover:underline"
            >
              ← Back to programs
            </button>

            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-5 sm:p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Star size={18} className="text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  Your Custom Program Starts With an Assessment
                </h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                Matt builds your program from scratch — no templates, no shortcuts. But first, he needs to see how you move.
                Choose one of the options below to get started. This is <strong className="text-foreground">100% free</strong> as part of your trial.
              </p>

              <div className="grid grid-cols-1 gap-3">
                {/* Option 1: In-person assessment */}
                <AssessmentOptionCard
                  icon={Calendar}
                  title="In-Person Assessment"
                  desc="Come to the studio in Grosse Pointe Park, MI. Matt will walk you through a full movement screen and build your program on the spot."
                  action={
                    <Link
                      to="/schedule"
                      className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                    >
                      <Calendar size={12} /> Book In-Person
                    </Link>
                  }
                />

                {/* Option 2: Online video meeting */}
                <AssessmentOptionCard
                  icon={Video}
                  title="Live Video Assessment"
                  desc="Schedule a free 15-minute video call. Matt will guide you through the movement screen in real time via Google Meet."
                  action={
                    <Link
                      to="/schedule"
                      className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                    >
                      <Video size={12} /> Schedule Video Call
                    </Link>
                  }
                />

                {/* Option 3: Upload a video */}
                <PosturalVideoUpload userId={user?.id || null} />

                {/* Option 4: Just describe it */}
                <TextAssessmentOption userId={user?.id || null} />
              </div>
            </div>

            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">
                Not ready for an assessment? You can always do it later from your dashboard.{" "}
                <button
                  onClick={() => {
                    toast({ title: "No problem!", description: "You can start an assessment from your dashboard any time." });
                    navigate("/dashboard");
                  }}
                  className="text-primary font-bold hover:underline"
                >
                  Skip to Dashboard →
                </button>
              </p>
            </div>
          </motion.div>
        )}

        {/* BOTTOM */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-8"
        >
          <p className="text-[10px] text-muted-foreground">
            © {new Date().getFullYear()} M² Training · Grosse Pointe Park, MI
          </p>
        </motion.div>
      </div>
    </div>
  );
};

/* ─── Postural Video Upload ─── */
const PosturalVideoUpload = ({ userId }: { userId: string | null }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 25MB. Try trimming or compressing.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `postural/${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("form-check-videos").upload(path, file);
      if (error) throw error;
      setUploaded(true);
      toast({ title: "Video uploaded! 🎯", description: "Matt will review it and start building your custom program." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex gap-3 mb-3">
        <div className="w-9 h-9 bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Upload size={16} className="text-primary" />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground mb-0.5">Send a Postural Assessment Video</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Record yourself doing 5 overhead squats and send the video. Matt will review within 48 hours.
          </p>
        </div>
      </div>

      {/* Detailed instructions based on NASM/NFPT guidelines */}
      <div className="bg-muted p-4 mb-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground flex items-center gap-1.5">
          <Camera size={10} /> How to Record Your Video
        </p>
        <div className="text-[11px] text-muted-foreground space-y-2 leading-relaxed">
          <p className="font-bold text-foreground">Setup:</p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li>Wear form-fitting clothes (shorts and a T-shirt) so Matt can see how your body moves</li>
            <li><strong className="text-foreground">Go barefoot</strong> — shoes hide ankle mobility issues</li>
            <li>Grab a broomstick, PVC pipe, dowel, or even a light baseball bat</li>
            <li>Film in a well-lit area with your full body visible head to toe</li>
            <li>Set your phone on a stable surface or have someone hold it still — <strong className="text-foreground">no handheld shaking</strong></li>
          </ul>

          <p className="font-bold text-foreground mt-2">The Movement (Overhead Squat):</p>
          <ol className="list-decimal ml-4 space-y-0.5">
            <li>Stand with feet <strong className="text-foreground">shoulder-width apart</strong>, toes pointed straight ahead</li>
            <li>Raise the stick overhead with arms fully extended, hands about shoulder-width apart, arms in line with your ears</li>
            <li>Keep your eyes focused straight ahead on a fixed point — don't look down</li>
            <li>Slowly squat down as deep as you comfortably can (roughly chair height), then slowly stand back up</li>
            <li>Repeat for <strong className="text-foreground">5 reps</strong> — go slow, Matt is watching for compensations</li>
          </ol>

          <p className="font-bold text-foreground mt-2">Film From Two Angles:</p>
          <ol className="list-decimal ml-4 space-y-0.5">
            <li><strong className="text-foreground">Front view</strong> — camera directly in front of you, at about hip height</li>
            <li><strong className="text-foreground">Side view</strong> — turn 90° and repeat the 5 squats so Matt can see your profile</li>
          </ol>

          <div className="bg-primary/10 border border-primary/20 p-2.5 mt-2">
            <p className="text-[10px] text-foreground font-bold">💡 What Matt is looking for:</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Knee tracking (do your knees cave in?), ankle mobility, hip shift, lower back rounding,
              arm position (do your arms fall forward?), and foot pronation. Don't try to be "perfect" — the
              whole point is for Matt to see your natural movement patterns so he can program around them.
            </p>
          </div>
        </div>
      </div>

      {uploaded ? (
        <div className="flex items-center gap-2 text-xs text-primary font-bold">
          <CheckCircle2 size={14} /> Video uploaded — Matt will review it and build your program
        </div>
      ) : (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !userId}
            className="bg-primary/10 border border-primary/30 text-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? "Uploading…" : userId ? "Upload Video (max 25MB)" : "Sign in to upload"}
          </button>
        </>
      )}
    </div>
  );
};

/* ─── Text-Based Assessment ─── */
const TextAssessmentOption = ({ userId }: { userId: string | null }) => {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim() || !userId) return;
    setSending(true);
    try {
      const { error } = await supabase.from("coach_direct_messages").insert({
        user_id: userId,
        sender_id: userId,
        sender_role: "athlete",
        message: `[POSTURAL ASSESSMENT — TEXT]\n\n${text.trim()}`,
      });
      if (error) throw error;
      setSent(true);
      toast({ title: "Sent! ✅", description: "Matt will review and build your custom program." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex gap-3 mb-3">
        <div className="w-9 h-9 bg-primary/10 flex items-center justify-center flex-shrink-0">
          <MessageSquare size={16} className="text-primary" />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground mb-0.5">Just Tell Matt</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Don't want to record? No problem. Describe your goals, injuries, limitations, equipment, and anything else Matt should know. The more detail, the better.
          </p>
        </div>
      </div>

      {sent ? (
        <div className="flex items-center gap-2 text-xs text-primary font-bold">
          <CheckCircle2 size={14} /> Message sent — Matt will build your program based on this
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="E.g. I'm 16, play baseball and basketball. I have a tight right hip and my left shoulder clicks when I throw. I train at a gym with dumbbells, cables, and a squat rack. My goal is to throw harder and be more durable through the season…"
            className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-28 resize-none placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending || !userId}
            className="bg-primary/10 border border-primary/30 text-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
            {sending ? "Sending…" : "Send to Matt"}
          </button>
        </div>
      )}
    </div>
  );
};

/* ─── Assessment Option Card ─── */
const AssessmentOptionCard = ({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: typeof Calendar;
  title: string;
  desc: string;
  action: React.ReactNode;
}) => (
  <div className="bg-card border border-border p-5">
    <div className="flex gap-3 mb-3">
      <div className="w-9 h-9 bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-primary" />
      </div>
      <div>
        <p className="text-xs font-bold text-foreground mb-0.5">{title}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
    {action}
  </div>
);

/* ─── Trial Path Card ─── */
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
