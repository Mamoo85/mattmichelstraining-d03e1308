import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Shield, TrendingDown, ArrowRight, Dumbbell, Activity, Zap, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import portalProgress from "@/assets/portal-progress.png";

interface ReadinessResult {
  hoursSlept: number;
  weightAdjustmentPct: number;
  swapsApplied: boolean;
}

interface ReadinessGateProps {
  onComplete: (result: ReadinessResult) => void;
  onSkip: () => void;
}

/**
 * Calculate auto-regulation adjustments based on sleep.
 * M² uses 3RM and 5RM — never 1RM.
 */
function calculateAdjustments(hoursSlept: number) {
  if (hoursSlept < 5) return { weightPct: -10, swap: true };
  if (hoursSlept < 6) return { weightPct: -7, swap: false };
  if (hoursSlept < 7) return { weightPct: -5, swap: false };
  return { weightPct: 0, swap: false };
}

const ReadinessGate = ({ onComplete, onSkip }: ReadinessGateProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<"ask" | "result">("ask");
  const [hoursSlept, setHoursSlept] = useState(7);
  const [saving, setSaving] = useState(false);

  const adjustments = calculateAdjustments(hoursSlept);
  const hasAdjustments = adjustments.weightPct !== 0 || adjustments.swap;

  const handleSubmit = async () => {
    if (hasAdjustments) {
      setStep("result");
    } else {
      await saveAndComplete();
    }
  };

  const saveAndComplete = async () => {
    if (!user) return;
    setSaving(true);

    // Save readiness check
    await supabase.from("readiness_checks" as any).insert({
      user_id: user.id,
      hours_slept: hoursSlept,
      weight_adjustment_pct: adjustments.weightPct,
      swaps_applied: adjustments.swap,
    });

    setSaving(false);
    onComplete({
      hoursSlept,
      weightAdjustmentPct: adjustments.weightPct,
      swapsApplied: adjustments.swap,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background flex flex-col"
    >
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            Readiness Check
          </span>
        </div>
        <button
          onClick={onSkip}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {step === "ask" && (
            <motion.div
              key="ask"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full space-y-6"
            >
              {/* Why this matters */}
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                  <Moon size={24} className="text-primary" />
                </div>
                <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
                  How'd you sleep?
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  Sleep directly affects your nervous system's ability to recruit muscle fibers.
                  Under-recovered athletes who push prescribed 3RM/5RM loads risk form breakdown and injury.
                </p>
              </div>

              {/* Preview card showing what data looks like */}
              <div className="relative overflow-hidden bg-card border border-border">
                <img
                  src={portalProgress}
                  alt="Recovery tracking data visualization"
                  className="w-full h-28 object-cover object-top opacity-40"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shield size={10} className="text-primary" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-primary">
                      Auto-Protection
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Your working weights and exercise selection adjust automatically based on readiness — protecting joints when you're compromised.
                  </p>
                </div>
              </div>

              {/* Sleep slider */}
              <div className="space-y-4 bg-card border border-border p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-foreground">
                    Hours Slept
                  </span>
                  <span className="text-2xl font-mono font-black text-primary">
                    {hoursSlept}h
                  </span>
                </div>
                <Slider
                  value={[hoursSlept]}
                  onValueChange={([v]) => setHoursSlept(v)}
                  min={2}
                  max={12}
                  step={0.5}
                  className="w-full"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                  <span>2h</span>
                  <span>5h</span>
                  <span>7h</span>
                  <span>9h</span>
                  <span>12h</span>
                </div>

                {/* Live adjustment preview */}
                {hasAdjustments && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="bg-primary/5 border border-primary/20 p-3 space-y-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <TrendingDown size={12} className="text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        Adjustments Preview
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-foreground flex items-center gap-2">
                        <Dumbbell size={12} className="text-muted-foreground" />
                        Working weights reduced by{" "}
                        <span className="font-mono font-bold text-primary">
                          {Math.abs(adjustments.weightPct)}%
                        </span>
                      </p>
                      {adjustments.swap && (
                        <p className="text-xs text-foreground flex items-center gap-2">
                          <Zap size={12} className="text-muted-foreground" />
                          Barbell exercises → dumbbell/machine alternatives
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                      Based on your logged 3RM/5RM history. Your joints will thank you.
                    </p>
                  </motion.div>
                )}
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full gap-2 text-xs font-bold uppercase tracking-widest"
                size="lg"
              >
                {hasAdjustments ? "See Adjustments" : "Let's Train"}
                <ArrowRight size={14} />
              </Button>
            </motion.div>
          )}

          {step === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                  <Shield size={24} className="text-primary" />
                </div>
                <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
                  Your Program Adjusted
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {hoursSlept < 5
                    ? "Under 5 hours of sleep means your CNS is seriously compromised. We've scaled back to protect you."
                    : hoursSlept < 7
                    ? "Not fully recovered. We've dialed back the intensity to keep you progressing safely."
                    : "You're good to go. No adjustments needed today."}
                </p>
              </div>

              {/* Adjustment cards */}
              <div className="space-y-3">
                <div className="bg-card border border-border p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <TrendingDown size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      Weight Reduced {Math.abs(adjustments.weightPct)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      All prescribed working weights (3RM/5RM based) dropped proportionally
                    </p>
                  </div>
                </div>

                {adjustments.swap && (
                  <div className="bg-card border border-border p-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                      <Zap size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        Exercise Swaps Active
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Complex barbell movements → dumbbell/machine equivalents mapped by Coach Matt
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-card border border-border p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <Moon size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {hoursSlept}h Sleep Logged
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      This data feeds your recovery trends on the Progress page
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={saveAndComplete}
                disabled={saving}
                className="w-full gap-2 text-xs font-bold uppercase tracking-widest"
                size="lg"
              >
                {saving ? "Saving…" : "Start Training"}
                <ArrowRight size={14} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  );
};

export { calculateAdjustments };
export type { ReadinessResult };
export default ReadinessGate;
