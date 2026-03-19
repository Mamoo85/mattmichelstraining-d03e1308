import { Link } from "react-router-dom";
import { ArrowRight, Gift, Star, Trophy, Users, Dumbbell, Shield, Zap, Heart, Target, Cpu, Calendar, Brain } from "lucide-react";
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
    <div className="space-y-8">
      {/* ═══════════ HERO: In-Person First ═══════════ */}
      <div className="relative overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/8 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
        <div className="relative p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary bg-primary/10 border border-primary/20 px-2.5 py-1">
              Grosse Pointe Park, MI
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground leading-tight">
            Train With Matt.<br />
            <span className="text-primary">In Person. One-on-One.</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Start with a monthly 1-on-1 session. Matt builds your foundation, tracks your movement with 
            <strong className="text-foreground"> advanced biomechanics technology</strong>, and programs 
            everything around what your body actually needs. Add sessions at a discount as you grow.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              to="/schedule"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
            >
              <Calendar size={14} /> Book Your First Session
            </Link>
            <a
              href="mailto:matthewmichels4@gmail.com?subject=Training%20Inquiry"
              className="inline-flex items-center gap-2 border-2 border-primary/40 text-primary px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
            >
              Email Matt
            </a>
          </div>
        </div>
      </div>

      {/* ═══════════ THE EDGE: Compact Tech Teaser ═══════════ */}
      <Link
        to="/the-edge"
        className="block bg-card border border-primary/20 overflow-hidden hover:border-primary/50 transition-all group"
      >
        <div className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <Cpu size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary bg-primary/10 px-2 py-0.5">
                Cutting-Edge Tech
              </span>
            </div>
            <h2 className="text-sm font-black uppercase tracking-tight text-foreground mb-1">
              The Data Behind Your Program
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Two photos. Instant biomechanics scan. Joint angles, postural alignment, muscle activation patterns — 
              data that gives Matt insight no other trainer has. See exactly what our technology reveals.
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs text-primary font-bold mt-2 group-hover:gap-2.5 transition-all">
              Explore The Technology <ArrowRight size={12} />
            </span>
          </div>
        </div>
      </Link>


      {/* Who Matt trains — moved up */}
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

      {/* Trial CTA — moved up */}
      <TrialCTA variant="banner" />

      {/* ═══════════ NOT LOCAL? Online Options ═══════════ */}
      <div className="border-t border-border pt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Not Local? Train Online.
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-card shadow-m2 p-4 flex gap-3 border border-primary/20">
            <div className="text-primary font-mono font-bold text-lg leading-none mt-0.5">$15</div>
            <div>
              <p className="text-xs font-bold text-foreground">M² Basic <span className="text-[8px] bg-muted text-muted-foreground px-1.5 py-0.5 uppercase ml-1">Starting</span></p>
              <p className="text-[11px] text-muted-foreground">Full 85+ exercise library, workout logging, challenges, monthly focus plans.</p>
            </div>
          </div>
          <div className="bg-card shadow-m2 p-4 flex gap-3 border-2 border-primary/40">
            <div className="text-primary font-mono font-bold text-lg leading-none mt-0.5">$40</div>
            <div>
              <p className="text-xs font-bold text-foreground">M² Foundation <span className="text-[8px] bg-primary text-primary-foreground px-1.5 py-0.5 uppercase ml-1">Popular</span></p>
              <p className="text-[11px] text-muted-foreground">Custom programming + Fix It library + form review + child invites.</p>
            </div>
          </div>
          <div className="bg-card shadow-m2 p-4 flex gap-3">
            <div className="text-primary font-mono font-bold text-lg leading-none mt-0.5">$100</div>
            <div>
              <p className="text-xs font-bold text-foreground">M² Custom</p>
              <p className="text-[11px] text-muted-foreground">Fully custom program from Matt + 1-on-1 video assessment + direct messaging.</p>
            </div>
          </div>
          <div className="bg-card shadow-m2 p-4 flex gap-3">
            <div className="text-primary font-mono font-bold text-lg leading-none mt-0.5">$150</div>
            <div>
              <p className="text-xs font-bold text-foreground">M² Team / Elite</p>
              <p className="text-[11px] text-muted-foreground">Full roster management, team programming, and full-season training plans.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            Compare All Plans <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Program Finder */}
      {user && (
        <div>
          <AiIntakeAnalyzer />
        </div>
      )}



      {/* Free features */}
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
