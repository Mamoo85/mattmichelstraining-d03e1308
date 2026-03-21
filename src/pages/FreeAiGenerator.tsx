import { useState, useEffect } from "react";
import { Dumbbell, Loader2, Zap, ChevronRight, ArrowRight, Sparkles, Lock, ShieldAlert } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import AppNavbar from "@/components/layout/AppNavbar";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { safeLocalStorage } from "@/lib/browserStorage";

const GENERATION_LIMIT = 3;
const STORAGE_KEY = "m2_ai_generations_count";

const EXPERIENCE = [
  { value: "beginner", label: "Beginner (0-6 months)" },
  { value: "intermediate", label: "Intermediate (6mo-3yrs)" },
  { value: "advanced", label: "Advanced (3+ years)" },
];
const GOALS = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Hypertrophy (Muscle Growth)" },
  { value: "endurance", label: "Endurance & Conditioning" },
  { value: "sport_performance", label: "Sport Performance" },
];
const DAYS = ["2", "3", "4", "5", "6"];
const EQUIPMENT = [
  { value: "full_gym", label: "Full Gym (Barbell, Rack, Dumbbells)" },
  { value: "home_gym", label: "Home Gym (Dumbbells, Bench, Rack)" },
  { value: "dumbbells_only", label: "Dumbbells Only" },
  { value: "bodyweight", label: "Bodyweight Only" },
  { value: "school_gym", label: "School / Team Weight Room" },
  { value: "bands_bodyweight", label: "Resistance Bands + Bodyweight" },
];

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
  const [experience, setExperience] = useState("");
  const [goal, setGoal] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState("3");
  const [equipment, setEquipment] = useState("");
  const [loading, setLoading] = useState(false);
  const [program, setProgram] = useState<GeneratedProgram | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [genCount, setGenCount] = useState(0);

  // Load generation count from localStorage
  useEffect(() => {
    const stored = safeLocalStorage.getItem(STORAGE_KEY);
    if (stored) setGenCount(parseInt(stored, 10) || 0);
  }, []);

  const isLimitReached = !user && genCount >= GENERATION_LIMIT;

  const handleGenerate = async () => {
    if (!experience || !goal || !equipment) return;
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
        body: JSON.stringify({ experience, goal, daysPerWeek, equipment }),
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error(d.error || "Generation failed. Try again.");
      }
      const data = await resp.json();
      setProgram(data);
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

  const phaseColors: Record<string, string> = {
    "Rolling/Soft Tissue": "bg-blue-500/20 text-blue-300",
    "Dynamic Warmup": "bg-amber-500/20 text-amber-300",
    "Main Work": "bg-primary/20 text-primary",
    "Finisher/Conditioning": "bg-red-500/20 text-red-300",
    Cooldown: "bg-green-500/20 text-green-300",
  };

  return (
    <>
      <SEOHead
        title="Free AI Workout Generator | Custom Training Programs"
        description="Generate a free, custom 7-day workout plan based on your exact equipment, goals, and experience level using advanced sports-science AI."
        path="/free-ai-generator"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Free AI Workout Generator",
          applicationCategory: "HealthApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description: "Generate a free, custom workout plan based on your exact equipment, goals, and experience level.",
          provider: { "@type": "Organization", name: "M² Training", url: "https://www.mattmichelstraining.com" },
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
              Get a custom training program built on real sports-science principles — compound movements,
              progressive overload, and Coach Matt's methodology. No fluff, no machines.
            </p>
          </motion.div>
        </section>

        {/* Form */}
        <AnimatePresence mode="wait">
          {!program ? (
            <motion.section
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-lg mx-auto px-4"
            >
              <div className="bg-card border border-border rounded-lg p-6 shadow-lg space-y-5">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Experience Level *</label>
                  <Select value={experience} onValueChange={setExperience}>
                    <SelectTrigger><SelectValue placeholder="Select your experience..." /></SelectTrigger>
                    <SelectContent>
                      {EXPERIENCE.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Primary Goal *</label>
                  <Select value={goal} onValueChange={setGoal}>
                    <SelectTrigger><SelectValue placeholder="What's your goal?" /></SelectTrigger>
                    <SelectContent>
                      {GOALS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Days Per Week</label>
                  <Select value={daysPerWeek} onValueChange={setDaysPerWeek}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map(d => <SelectItem key={d} value={d}>{d} days</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Available Equipment *</label>
                  <Select value={equipment} onValueChange={setEquipment}>
                    <SelectTrigger><SelectValue placeholder="What do you have access to?" /></SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {error && <p className="text-destructive text-xs text-center">{error}</p>}

                <Button
                  onClick={handleGenerate}
                  disabled={loading || !experience || !goal || !equipment}
                  className="w-full h-14 text-base font-black uppercase tracking-wider relative overflow-hidden group"
                  size="lg"
                >
                  {loading ? (
                    <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Building Your Program...</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles size={18} /> Generate Free Workout
                    </span>
                  )}
                  <span className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
                </Button>

                <p className="text-[10px] text-muted-foreground text-center">
                  Powered by Coach Matt's sports-science methodology • Starting Strength & Supple Leopard principles
                </p>
              </div>
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

              {/* Upsell CTA */}
              <div className="bg-gradient-to-br from-primary/20 via-card to-primary/10 border-2 border-primary/40 rounded-lg p-6 md:p-8 text-center mb-6">
                <h3 className="text-lg md:text-xl font-black text-foreground mb-2">
                  This Is Just Week 1.
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                  Coach Matt's system built this baseline. To unlock the <span className="text-foreground font-bold">full 8-week progression</span>,
                  live weight tracking, form analysis, and direct coach feedback — load this directly into <span className="text-primary font-bold">The M² Portal</span>.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto">
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleTrialStart} className="w-full sm:w-auto font-bold gap-2">
                    Start Free Trial <ArrowRight size={16} />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3">
                  14-day free trial • $12.99/mo after • Cancel anytime
                </p>
              </div>

              <button
                onClick={() => setProgram(null)}
                className="text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors mx-auto block"
              >
                ← Generate Another Workout
              </button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </>
  );
};

export default FreeAiGenerator;
