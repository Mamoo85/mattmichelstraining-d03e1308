import { Link } from "react-router-dom";
import { ArrowRight, Shield, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface TrialCTAProps {
  /** "banner" = full-width gradient block, "inline" = compact button-only, "comparison" = with sneak peek details */
  variant?: "banner" | "inline" | "comparison";
  className?: string;
}

const TrialCTA = ({ variant = "banner", className = "" }: TrialCTAProps) => {
  const { user, subscribed } = useAuth();

  // Don't show to subscribed users
  if (subscribed) return null;

  if (variant === "inline") {
    return (
      <Link
        to={user ? "/trial-welcome" : "/auth?redirect=/trial-welcome"}
        className={`inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 ${className}`}
      >
        <Zap size={12} />
        Start 14-Day Free Trial
        <ArrowRight size={12} />
      </Link>
    );
  }

  if (variant === "comparison") {
    return (
      <div className={`bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-5 sm:p-6 ${className}`}>
        <div className="flex items-start gap-3 mb-4">
          <Shield size={20} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-foreground mb-1">Try the M² App Free for 14 Days</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Full Foundation portal access. Programs. Progress tracking. Plus a{" "}
              <strong className="text-foreground">free 2-week starter program</strong> loaded into your dashboard 
              on Day 1 — warmup, workout, rolling, and mobility every session. Looking for custom coaching? Check out Pro or Elite.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            { label: "Free Starter Program", detail: "2 weeks, 6 sessions" },
            { label: "Exercise Library", detail: "190+ exercises" },
            { label: "Workout Logging", detail: "Track every set" },
            { label: "Coach Access", detail: "Message Matt" },
          ].map((item) => (
            <div key={item.label} className="bg-background/60 p-2.5 text-center">
              <p className="text-[10px] font-bold text-foreground">{item.label}</p>
              <p className="text-[9px] text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
        <Link
          to={user ? "/trial-welcome" : "/auth?redirect=/trial-welcome"}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 w-full justify-center"
        >
          <Zap size={14} />
          Start Free 14-Day Trial
          <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  // Default: banner
  return (
    <div className={`bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 p-5 text-center ${className}`}>
      <div className="flex items-center justify-center gap-2 mb-2">
        <Zap size={16} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground">14 Days Free. Cancel Anytime.</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
        Full access to everything — plus a free 2-week starter program loaded on Day 1 with warmup, workout, rolling, and mobility every session.
      </p>
      <Link
        to={user ? "/trial-welcome" : "/auth?redirect=/trial-welcome"}
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        Start Free Trial
        <ArrowRight size={14} />
      </Link>
    </div>
  );
};

export default TrialCTA;
