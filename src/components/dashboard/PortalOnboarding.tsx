import { useCallback } from "react";
import { useState } from "react";
import { safeLocalStorage } from "@/lib/browserStorage";
import {
  X, Dumbbell, Trophy, Sparkles, Timer, BarChart3, Users, Wrench, Zap
} from "lucide-react";
import portalImg from "@/assets/portal-overview.jpg";

const STORAGE_KEY = "m2-portal-tour-seen-v2";

const FEATURES = [
  { icon: <Dumbbell size={18} />, text: "Structured programs & daily workouts" },
  { icon: <Sparkles size={18} />, text: "AI-powered workout & Fix-It generators" },
  { icon: <BarChart3 size={18} />, text: "Track every PR and see your progress" },
  { icon: <Trophy size={18} />, text: "Monthly challenges & leaderboards" },
  { icon: <Timer size={18} />, text: "Built-in interval timers & food scanner" },
  { icon: <Users size={18} />, text: "Community workout bank & sharing" },
  { icon: <Wrench size={18} />, text: "Injury prevention & recovery tools" },
];

const PortalOnboarding = () => {
  const [visible, setVisible] = useState(
    () => safeLocalStorage.getItem(STORAGE_KEY) !== "1"
  );

  const dismiss = useCallback(() => {
    safeLocalStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-card border border-border w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Close button */}
        <div className="flex justify-end px-4 pt-3">
          <button
            onClick={dismiss}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          {/* Hero image */}
          <img
            src={portalImg}
            alt="M2 Training Portal overview"
            className="w-full rounded border border-border object-cover"
            width={800}
            height={512}
          />

          {/* Welcome heading */}
          <div className="text-center space-y-2">
            <h2 className="text-xl font-black uppercase tracking-widest text-foreground">
              Welcome to M2
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your all-in-one training hub — built to help you get stronger, stay consistent, and prove it.
            </p>
          </div>

          {/* Feature bullets */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              What's inside your portal
            </p>
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
                  {f.icon}
                </div>
                <p className="text-sm font-semibold text-foreground">{f.text}</p>
              </div>
            ))}
          </div>

          {/* Thank you */}
          <div className="text-center pt-2 space-y-3">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Zap size={16} />
              <p className="text-xs font-bold uppercase tracking-widest">
                Thank you for being part of the M2 team
              </p>
              <Zap size={16} />
            </div>

            {/* CTA */}
            <button
              onClick={dismiss}
              className="w-full h-12 bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <Dumbbell size={16} /> Let's Get To Work
            </button>

            {/* Don't show again */}
            <button
              onClick={dismiss}
              className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 py-1"
            >
              Don't show this again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalOnboarding;
