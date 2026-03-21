import { Link } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";

const EmailCapture = () => {
  return (
    <div className="mb-10 bg-card shadow-m2 p-5 md:p-8 border-t-4 border-primary">
      <div className="flex items-center gap-2 mb-1">
        <Zap size={16} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
          14-Day Free Trial
        </span>
      </div>
      <h3 className="text-base md:text-lg font-bold text-foreground mb-1">
        Train with Matt — free for 2 weeks
      </h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-lg leading-relaxed">
        Full access to the exercise library, structured workouts, progress tracking,
        and real coaching feedback. Cancel anytime — $12.99/mo after trial.
      </p>
      <Link
        to="/auth?redirect=/trial-welcome"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        Start Free Trial
        <ArrowRight size={14} />
      </Link>
      <p className="text-[10px] text-muted-foreground mt-2">
        Plans start at $12.99/mo after trial. No contracts.
      </p>
    </div>
  );
};

export default EmailCapture;
