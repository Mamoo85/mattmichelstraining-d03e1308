import { Link } from "react-router-dom";
import { ArrowRight, Gift, Star, Trophy, Users, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SectionHeader from "../SectionHeader";

const STEPS = [
  {
    num: "01",
    title: "Create Your Free Account",
    desc: "Sign up in 30 seconds. No credit card needed. You'll get access to monthly focus plans, member challenges, and workout logging immediately.",
    ctaType: "signup" as const,
  },
  {
    num: "02",
    title: "Grab a Guide or Custom Program",
    desc: "Browse the Store tab for sport-specific PDF guides ($9) or get a fully custom program built by Matt ($20). Every guide teaches the WHY behind each movement.",
    ctaType: "store" as const,
  },
  {
    num: "03",
    title: "Subscribe, Train, & Connect",
    desc: "Pick a plan and unlock Matt's full exercise library—20 years of hands-on coaching, zero filler. Filter by client type, age, sport, or target area (Mobility, Strength, Core, Flexibility). Log every workout, leave notes on exercises, and flag anything for Matt to personally review. This isn't generic internet programming—it's direct access to your coach, wherever you are.",
    ctaType: "pricing" as const,
  },
];

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

const GoToPortalButton = () => (
  <Link
    to="/progress"
    className="inline-flex items-center justify-center gap-2 border-2 border-primary/40 text-primary px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2 mt-2"
  >
    <LogIn size={12} />
    Go to Client Portal
  </Link>
);

const StoreGettingStarted = () => {
  const { user } = useAuth();

  return (
    <div>
      <SectionHeader title="Getting Started" timestamp="Everything you need to know" />

      {/* Welcome message */}
      <div className="bg-primary/10 border border-primary/20 shadow-m2 p-5 mb-6">
        <p className="text-sm text-foreground leading-relaxed">
          <span className="font-bold">"Whether you're a parent looking for your kid's first real program, an athlete trying to get to the next level, or someone who just wants to stop hurting —</span> you're in the right place. Here's how this works."
        </p>
        <span className="text-[10px] font-mono text-primary mt-2 block">— Matt Michels, M² Training</span>
      </div>

      {/* Logged-in user quick access */}
      {user && (
        <div className="bg-primary/5 border border-primary/20 shadow-m2 p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-bold text-foreground">You're in! 👊</p>
            <p className="text-xs text-muted-foreground">Jump into your client portal to log workouts and track progress.</p>
          </div>
          <GoToPortalButton />
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3 mb-8">
        {STEPS.map((step) => (
          <div key={step.num} className="bg-card shadow-m2 p-5 flex gap-4">
            <span className="text-2xl font-mono font-bold text-primary/30 flex-shrink-0">{step.num}</span>
            <div>
              <h3 className="text-sm font-bold text-foreground mb-1">{step.title}</h3>
              {step.desc.split("\n\n").map((paragraph, i) => (
                <p key={i} className="text-xs text-muted-foreground leading-relaxed mb-2 last:mb-0">{paragraph}</p>
              ))}
              {step.ctaType === "signup" && !user && (
                <SignUpButton size="small" />
              )}
              {step.ctaType === "signup" && user && (
                <div className="mt-2 flex items-center gap-2 text-xs text-primary font-bold">
                  <span>✓</span> Account created
                </div>
              )}
              {step.ctaType === "store" && (
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("switch-shop-tab", { detail: "store" }));
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 mt-2"
                >
                  Shop Guides & Programs
                  <ArrowRight size={12} />
                </button>
              )}
              {step.ctaType === "pricing" && (
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 mt-2"
                >
                  View Subscription Plans
                  <ArrowRight size={12} />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Free member banner */}
      <div className="bg-card shadow-m2 p-5 mb-6">
        <div className="flex items-start gap-3 mb-3">
          <Gift size={20} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-foreground mb-1">Free With Every Account</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">No subscription required. Just sign up.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-primary flex-shrink-0" />
            <span className="text-xs text-foreground">Monthly Focus Plans</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy size={14} className="text-primary flex-shrink-0" />
            <span className="text-xs text-foreground">Member Challenges</span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-primary flex-shrink-0" />
            <span className="text-xs text-foreground">Workout Logging & Progress Tracking</span>
          </div>
        </div>
        {!user && (
          <div className="mt-4 pt-3 border-t border-border">
            <SignUpButton />
          </div>
        )}
      </div>

      {/* Subscription CTA */}
      <div className="bg-card shadow-m2 p-5 mb-6">
        <h3 className="text-sm font-bold text-foreground mb-2">Ready for More?</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          Subscriptions unlock the full Exercise Library, custom programming, the Fix It rehab library, and 1-on-1 check-ins with Matt.
        </p>
        <Link
          to="/pricing"
          className="inline-flex items-center justify-center gap-2 border-2 border-primary/40 text-primary px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
        >
          View Plans & Pricing
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* Bottom CTA */}
      {!user && (
        <div className="text-center py-6 bg-primary/5 border border-primary/20 shadow-m2">
          <p className="text-sm font-bold text-foreground mb-1">Don't overthink it.</p>
          <p className="text-xs text-muted-foreground mb-4">Create a free account, start logging, and let the work speak for itself.</p>
          <SignUpButton />
        </div>
      )}
    </div>
  );
};

export default StoreGettingStarted;
