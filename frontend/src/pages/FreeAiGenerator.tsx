import { useState, useEffect } from "react";
import { Dumbbell, Loader2, Zap, ArrowRight, Sparkles, Lock, ShieldAlert, Mail, CheckCircle2, ArrowLeft, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import AppNavbar from "@/components/layout/AppNavbar";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { safeLocalStorage } from "@/lib/browserStorage";
import EmailWorkoutModal from "@/components/generator/EmailWorkoutModal";
import TechShowcaseMarketing from "@/components/landing/TechShowcaseMarketing";
import GymPhotoUpload from "@/components/generator/GymPhotoUpload";

const GENERATION_LIMIT = 1;
const STORAGE_KEY = "m2_ai_generations_count";

type Path = null | "workout" | "fixit";

interface GeneratedDay {
  dayLabel: string;
  exercises: { title: string; sets: string; reps: string; notes?: string; phase?: string }[];
}
interface GeneratedProgram {
  title: string;
  description: string;
  days: GeneratedDay[];
}

const FreeAiGenerator = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [path, setPath] = useState<Path>(null);
  const [userText, setUserText] = useState("");
  const [gymImageBase64, setGymImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [program, setProgram] = useState<GeneratedProgram | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [genCount, setGenCount] = useState(0);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const stored = safeLocalStorage.getItem(STORAGE_KEY);
    if (stored) setGenCount(parseInt(stored, 10) || 0);
  }, []);

  const isLimitReached = !user && genCount >= GENERATION_LIMIT;

  const handleGenerate = async () => {
    if (!userText.trim()) return;
    setLoading(true);
    setError(null);
    setProgram(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/free-workout-generator`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          path,
          userText: userText.trim(),
          gymImageBase64: gymImageBase64 || undefined,
        }),
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        if (d.limit_reached) {
          setGenCount(GENERATION_LIMIT);
          safeLocalStorage.setItem(STORAGE_KEY, String(GENERATION_LIMIT));
        }
        throw new Error(d.error || "Generation failed. Try again.");
      }
      const data = await resp.json();
      setProgram(data);
      if (!user) {
        const newCount = genCount + 1;
        setGenCount(newCount);
        safeLocalStorage.setItem(STORAGE_KEY, String(newCount));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTrialStart = () => {
    if (email) {
      navigate(`/auth?trial=true&email=${encodeURIComponent(email)}`);
    } else {
      navigate("/auth?trial=true");
    }
  };

  const handleBack = () => {
    setPath(null);
    setUserText("");
    setGymImageBase64(null);
    setError(null);
  };

  const phaseColors: Record<string, string> = {
    "Rolling/Soft Tissue": "bg-blue-500/20 text-blue-300",
    "Tissue Release": "bg-blue-500/20 text-blue-300",
    "Dynamic Warmup": "bg-amber-500/20 text-amber-300",
    Mobility: "bg-amber-500/20 text-amber-300",
    "Main Work": "bg-primary/20 text-primary",
    "Isometric Loading": "bg-primary/20 text-primary",
    "Isometric/Corrective Loading": "bg-primary/20 text-primary",
    "Finisher/Conditioning": "bg-red-500/20 text-red-300",
    Cooldown: "bg-green-500/20 text-green-300",
  };

  return (
    <>
      <SEOHead
        title="Free AI Workout Generator | Custom Training Programs"
        description="Generate a free, custom workout plan or rehab protocol based on your exact situation using advanced sports-science AI."
        path="/free-ai-generator"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Free AI Workout Generator",
          applicationCategory: "HealthApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description: "Generate a free, custom workout plan or rehab protocol based on your situation.",
          provider: { "@type": "Organization", name: "M2 Training", url: "https://www.mattmichelstraining.com" },
        }}
      />

      <AppNavbar />

      <main className="min-h-screen bg-background pt-20 pb-16">
        {/* Hero */}
        <section className="max-w-3xl mx-auto px-4 text-center mb-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
              <Zap size={14} /> 100% Free — No Login Required
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-foreground leading-tight mb-3">
              Free AI Workout <span className="text-primary">Generator</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
              Get a custom training program or rehab protocol built on real sports-science principles — powered by Coach Matt's 20+ years of methodology.
            </p>
          </motion.div>
        </section>

        {/* Form / Fork / Results */}
        <AnimatePresence mode="wait">
          {!program ? (
            <motion.section
              key={path ?? "fork"}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-lg mx-auto px-4"
            >
              {/* === FORK: choose path === */}
              {path === null && (
                <div className="space-y-4">
                  <button
                    onClick={() => setPath("workout")}
                    className="w-full bg-card border-2 border-border hover:border-primary rounded-lg p-8 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">🏋️‍♂️</span>
                      <div>
                        <p className="text-lg font-black text-foreground group-hover:text-primary transition-colors">
                          Build a Workout
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Get a full training program tailored to your equipment, goals, and experience.
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setPath("fixit")}
                    className="w-full bg-card border-2 border-border hover:border-primary rounded-lg p-8 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">🩹</span>
                      <div>
                        <p className="text-lg font-black text-foreground group-hover:text-primary transition-colors">
                          Fix a Pain Point
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Describe what hurts — get a corrective rehab protocol from the Fix It Engine.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* === PATH: workout or fixit === */}
              {path !== null && (
                <div className="bg-card border border-border rounded-lg p-6 shadow-lg space-y-5">
                  <button
                    onClick={handleBack}
                    className="text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft size={12} /> Choose different path
                  </button>

                  {path === "workout" && (
                    <>
                      <GymPhotoUpload onImageChange={setGymImageBase64} />
                      <Textarea
                        value={userText}
                        onChange={(e) => setUserText(e.target.value)}
                        placeholder="Tell me about yourself. (e.g., I'm 35, been lifting for a year, want to get stronger, and I only have 3 days a week with dumbbells and a bench.)"
                        className="min-h-[112px] bg-background"
                      />
                    </>
                  )}

                  {path === "fixit" && (
                    <Textarea
                      value={userText}
                      onChange={(e) => setUserText(e.target.value)}
                      placeholder="Where does it hurt and when does it happen? (e.g., My lower back tightens up during heavy squats, or my right shoulder hurts when I put on my shirt.)"
                      className="min-h-[112px] bg-background"
                    />
                  )}

                  {error && <p className="text-destructive text-xs text-center">{error}</p>}

                  {isLimitReached && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-primary/10 border-2 border-primary/40 rounded-lg p-5 text-center space-y-3"
                    >
                      <Zap size={28} className="text-primary mx-auto" />
                      <p className="text-xl font-black text-foreground">Want the full 8-week program?</p>
                      <p className="text-xs text-muted-foreground">
                        You've used your free generation. Start for <span className="text-foreground font-bold">$4.99</span> to unlock unlimited AI programs, the full M2 portal, and direct access to Coach Matt.
                      </p>
                      <Button onClick={() => navigate("/auth?redirect=/trial-welcome")} className="w-full h-12 font-black uppercase tracking-wider text-sm" size="lg">
                        Start for $4.99 <ArrowRight size={16} />
                      </Button>
                      <p className="text-[10px] text-muted-foreground">then $19.99/mo · Cancel anytime</p>
                    </motion.div>
                  )}

                  <Button
                    onClick={handleGenerate}
                    disabled={loading || !userText.trim() || isLimitReached}
                    className="w-full h-14 text-base font-black uppercase tracking-wider relative overflow-hidden group"
                    size="lg"
                  >
                    {isLimitReached ? (
                      <span className="flex items-center gap-2">
                        <Lock size={18} /> Free Limit Reached ({GENERATION_LIMIT}/{GENERATION_LIMIT})
                      </span>
                    ) : loading ? (
                      <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> {path === "fixit" ? "Building Protocol..." : "Building Your Program..."}</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {path === "fixit" ? <Wrench size={18} /> : <Sparkles size={18} />}
                        {path === "fixit" ? "Generate Rehab Protocol" : "Generate Program"}
                        {!user && ` (${genCount}/${GENERATION_LIMIT})`}
                      </span>
                    )}
                    <span className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
                  </Button>

                  <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                    I built this AI engine myself and tested it a million times. It is fueled exclusively by my 20 years of in-the-trenches sports science data. No generic internet fluff. I guarantee its effectiveness. — Coach Matt
                  </p>
                </div>
              )}
            </motion.section>
          ) : (
            <motion.section
              key="results"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto px-4"
            >
              {/* Program Header */}
              <div className="bg-card border border-border rounded-lg p-6 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Dumbbell size={20} className="text-primary" />
                  <h2 className="text-lg font-black text-foreground">{program.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{program.description}</p>
              </div>

              {/* Days */}
              <div className="space-y-4 mb-8">
                {program.days.map((day, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-5 py-3 border-b border-border">
                      <h3 className="text-sm font-black uppercase tracking-wider text-foreground">{day.dayLabel}</h3>
                    </div>
                    <div className="divide-y divide-border">
                      {day.exercises.map((ex, j) => (
                        <div key={j} className="px-5 py-3 flex items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-bold text-foreground">{ex.title}</span>
                              {ex.phase && (
                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${phaseColors[ex.phase] || "bg-muted text-muted-foreground"}`}>
                                  {ex.phase}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {ex.sets} × {ex.reps}{ex.notes ? ` — ${ex.notes}` : ""}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Email / Save */}
              <div className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto mb-6">
                <Button
                  variant={emailSent ? "secondary" : "outline"}
                  onClick={() => !emailSent && setEmailModalOpen(true)}
                  disabled={emailSent}
                  className="w-full sm:w-auto font-bold gap-2"
                >
                  {emailSent ? (
                    <><CheckCircle2 size={16} className="text-primary" /> Workout Sent!</>
                  ) : (
                    <><Mail size={16} /> Email This to Me</>
                  )}
                </Button>
              </div>

              {/* Upsell CTA */}
              <div className="bg-gradient-to-br from-primary/20 via-card to-primary/10 border-2 border-primary/40 rounded-lg p-6 md:p-8 text-center mb-6">
                <div className="inline-flex items-center gap-1.5 bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                  <Zap size={11} /> This is just Week 1 of 8
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-foreground mb-2">
                  Get the full 8-week program<br />
                  <span className="text-primary">for $4.99.</span>
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                  Load this into The M2 Portal — with progressive overload built in, automatic weight tracking, form analysis, and direct access to Coach Matt. Your first month is <span className="text-foreground font-bold">$4.99</span>, then $19.99/mo. Cancel anytime.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto mb-3">
                  <Input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
                  <Button onClick={handleTrialStart} className="w-full sm:w-auto font-black gap-2 text-base px-6 py-3" size="lg">
                    Start for $4.99 <ArrowRight size={16} />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">First month $4.99 · then $19.99/mo · Cancel anytime · No contracts</p>
              </div>

              <button
                onClick={() => { setProgram(null); setEmailSent(false); setPath(null); setUserText(""); setGymImageBase64(null); }}
                className="text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors mx-auto block mb-10"
              >
                ← Generate Another
              </button>

              <TechShowcaseMarketing variant="full" />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {program && (
        <EmailWorkoutModal
          open={emailModalOpen}
          onOpenChange={setEmailModalOpen}
          program={program}
          onSent={() => setEmailSent(true)}
        />
      )}
    </>
  );
};

export default FreeAiGenerator;
