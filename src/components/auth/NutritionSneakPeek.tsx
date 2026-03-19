import { Camera, TrendingUp, Lock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const NutritionSneakPeek = () => {
  return (
    <div className="relative overflow-hidden bg-card border border-border mt-6">
      {/* Header */}
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Subscriber Feature
          </span>
        </div>
        <Lock size={12} className="text-muted-foreground" />
      </div>

      <div className="p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground">AI Nutrition Tracker</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Snap a photo of your meal. AI counts every calorie and macro instantly — no manual entry.
        </p>

        {/* Blurred mock graph */}
        <div className="relative">
          <div className="blur-[6px] pointer-events-none select-none" aria-hidden="true">
            {/* Mock macro donut */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full border-[6px] border-primary/60 border-t-accent/60 border-r-secondary/60 flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Protein</span>
                  <span className="font-bold text-foreground">142g / 180g</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: "79%" }} />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Carbs</span>
                  <span className="font-bold text-foreground">210g / 250g</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: "84%" }} />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Fat</span>
                  <span className="font-bold text-foreground">58g / 70g</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: "83%" }} />
                </div>
              </div>
            </div>

            {/* Mock weekly trend bars */}
            <div className="mt-3 flex items-end gap-1 justify-between h-10">
              {[65, 80, 45, 90, 72, 55, 85].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/40 rounded-t"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} className="text-[8px] text-muted-foreground flex-1 text-center">{d}</span>
              ))}
            </div>
          </div>

          {/* Lock overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="bg-background/80 backdrop-blur-sm border border-border px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Camera size={14} className="text-primary" />
                <TrendingUp size={14} className="text-primary" />
              </div>
              <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Photo → Macros in seconds
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                Available with any subscription
              </p>
            </div>
          </div>
        </div>

        <Link
          to="/pricing"
          className="flex items-center justify-center gap-2 w-full bg-primary/10 border border-primary/20 text-primary px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-colors"
        >
          View Plans
        </Link>
      </div>
    </div>
  );
};

export default NutritionSneakPeek;
