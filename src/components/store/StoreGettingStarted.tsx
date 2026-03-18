import { Link } from "react-router-dom";
import { ArrowRight, Gift, Star, Trophy, Users, LogIn, Dumbbell, Shield, Zap, Heart, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AiIntakeAnalyzer from "../programs/AiIntakeAnalyzer";
import TrialCTA from "../TrialCTA";

const SignUpButton = ({ size = "default" }: { size?: "default" | "small" }) => (
  <Link
    to="/auth"
    className={`inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold uppercase tracking-widest hover:opacity-90 transition-m2 ${
      size === "small" ? "px-4 py-2 text-[10px] mt-2" : "px-6 py-3 text-xs"
    }`}
  >
    Create Free Account
    <ArrowRight size={size === "small" ? 12 : 14} />
  </Link>
);

const StoreGettingStarted = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Hero banner with gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-background border border-primary/20 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2 relative">
          Everyone Is an Athlete.
        </h1>
        <p className="text-sm text-muted-foreground max-w-lg leading-relaxed relative">
          Age 14 or 60. First weight room visit or 20 years in. Same foundation. Same results. Just add weight.
        </p>
        {!user && (
          <div className="mt-4 relative">
            <SignUpButton />
          </div>
        )}
        {user && (
          <Link
            to="/progress"
            className="inline-flex items-center gap-2 border-2 border-primary/40 text-primary px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2 mt-4 relative"
          >
            <LogIn size={12} />
            Go to Portal
          </Link>
        )}
      </div>

      {/* 3 steps — visual cards, minimal text */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card shadow-m2 p-5 border-t-4 border-primary/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-mono font-bold text-primary">1</span>
            </div>
            <h3 className="text-sm font-bold text-foreground">Free Account</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            30 seconds. Instant access to workout logging, monthly challenges, and focus plans.
          </p>
          {!user ? (
            <SignUpButton size="small" />
          ) : (
            <span className="text-xs text-primary font-bold flex items-center gap-1">✓ Done</span>
          )}
        </div>

        <div className="bg-card shadow-m2 p-5 border-t-4 border-primary/60">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-mono font-bold text-primary">2</span>
            </div>
            <h3 className="text-sm font-bold text-foreground">Subscribe</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-1">
            Direct access to Matt — his library, coaching, and programming.
          </p>
          <p className="text-xs text-primary font-bold mb-3">Starting at $15.99/mo</p>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            Compare Plans <ArrowRight size={12} />
          </Link>
        </div>

        <div className="bg-card shadow-m2 p-5 border-t-4 border-primary">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-mono font-bold text-primary">3</span>
            </div>
            <h3 className="text-sm font-bold text-foreground">Buy a Program</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-1">
            No subscription needed. Standalone programs from $20 — download, print, keep forever.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("switch-shop-tab", { detail: "store" }))}
            className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 mt-2"
          >
            Browse Programs <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Market comparison — compact */}
      <div className="bg-secondary/50 border border-border p-4 flex items-start gap-3">
        <Shield size={18} className="text-primary flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-foreground mb-1">The Math</h4>
          <p className="text-[11px] text-muted-foreground">
            In-person training: <span className="text-foreground font-bold">$40–$150/session</span>. Online coaching: <span className="text-foreground font-bold">$100–$300/mo</span>. M² subscription: <span className="text-primary font-bold">$15.99/mo</span>. Same 20 years of expertise.
          </p>
        </div>
      </div>

      {/* Who Matt trains — visual grid instead of text blob */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Dumbbell size={16} className="text-primary" />
          Who Matt Trains
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icon: Target, label: "Youth Athletes", sub: "Build it right from day one" },
            { icon: Users, label: "Parents", sub: "Train with — or for — your kids" },
            { icon: Heart, label: "Adults", sub: "Feel strong again at any age" },
            { icon: Zap, label: "Coaches", sub: "Practice what you preach" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="bg-card shadow-m2 p-3 text-center">
              <Icon size={20} className="text-primary mx-auto mb-1.5" />
              <p className="text-xs font-bold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Subscription tiers — scannable */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-3">What Each Tier Unlocks</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="bg-card shadow-m2 p-4 flex gap-3">
            <div className="text-primary font-mono font-bold text-lg leading-none mt-0.5">$16</div>
            <div>
              <p className="text-xs font-bold text-foreground">Basic</p>
              <p className="text-[11px] text-muted-foreground">Full 85+ exercise library. Filtered by level, sport, and focus.</p>
            </div>
          </div>
          <div className="bg-card shadow-m2 p-4 flex gap-3 border border-primary/20">
            <div className="text-primary font-mono font-bold text-lg leading-none mt-0.5">$50</div>
            <div>
              <p className="text-xs font-bold text-foreground">Pro / Youth Dev <span className="text-[8px] bg-primary text-primary-foreground px-1.5 py-0.5 uppercase ml-1">Popular</span></p>
              <p className="text-[11px] text-muted-foreground">Custom programming + Fix It library + form review + child invites.</p>
            </div>
          </div>
          <div className="bg-card shadow-m2 p-4 flex gap-3">
            <div className="text-primary font-mono font-bold text-lg leading-none mt-0.5">$70</div>
            <div>
              <p className="text-xs font-bold text-foreground">Elite</p>
              <p className="text-[11px] text-muted-foreground">Monthly 1-on-1 check-ins + priority coaching + direct messaging.</p>
            </div>
          </div>
          <div className="bg-card shadow-m2 p-4 flex gap-3">
            <div className="text-primary font-mono font-bold text-lg leading-none mt-0.5">$90</div>
            <div>
              <p className="text-xs font-bold text-foreground">Team</p>
              <p className="text-[11px] text-muted-foreground">Full-roster programming for coaches and organizations.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trial CTA — strategic placement after tier info */}
      <TrialCTA variant="banner" />

      {/* AI Program Finder */}
      {user && (
        <div>
          <AiIntakeAnalyzer />
        </div>
      )}

      {/* Free features — compact row */}
      <div className="bg-card shadow-m2 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Free With Every Account</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-1.5">
            <Star size={12} className="text-primary flex-shrink-0" />
            <span className="text-[11px] text-foreground">Monthly Focus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trophy size={12} className="text-primary flex-shrink-0" />
            <span className="text-[11px] text-foreground">Challenges</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Dumbbell size={12} className="text-primary flex-shrink-0" />
            <span className="text-[11px] text-foreground">Workout Log</span>
          </div>
        </div>
        {!user && (
          <div className="mt-3 pt-3 border-t border-border">
            <SignUpButton size="small" />
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      {!user && (
        <div className="text-center py-6 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
          <p className="text-sm font-bold text-foreground mb-1">Don't overthink it.</p>
          <p className="text-xs text-muted-foreground mb-4">Free account. See for yourself.</p>
          <SignUpButton />
        </div>
      )}
    </div>
  );
};

export default StoreGettingStarted;
