import { memo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Zap, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * $4.99 first-month promo banner for logged-out new visitors.
 * Shown on homepage and shop page only.
 */
const FirstMonthPromo = memo(() => {
  const { user } = useAuth();

  // Only show to non-logged-in visitors
  if (user) return null;

  return (
    <div className="relative overflow-hidden border-2 border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-background">
      <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
      <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <Zap size={22} className="text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-black text-primary font-mono">$4.99</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground line-through">$19.99</span>
              <span className="text-[9px] font-bold uppercase tracking-widest bg-primary text-primary-foreground px-2 py-0.5">
                First Month
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Start training with Matt for <strong className="text-foreground">$4.99 your first month</strong>. 
              Full exercise library, workout logging, and monthly coaching. Auto-renews at $19.99/mo — cancel anytime.
            </p>
          </div>
        </div>
        <Link
          to="/auth?redirect=/trial-welcome&promo=FIRST499"
          className="shrink-0 inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 w-full sm:w-auto justify-center"
        >
          Claim $4.99 Deal <ArrowRight size={12} />
        </Link>
      </div>
      <div className="px-5 pb-3 flex items-center gap-1.5">
        <Clock size={10} className="text-muted-foreground" />
        <span className="text-[9px] text-muted-foreground">Limited time offer · New members only</span>
      </div>
    </div>
  );
});

FirstMonthPromo.displayName = "FirstMonthPromo";

export default FirstMonthPromo;
