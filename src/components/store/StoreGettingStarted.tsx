import { Link } from "react-router-dom";
import { ArrowRight, Gift, Star, Trophy, Users, LogIn, Dumbbell, Heart, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SectionHeader from "../SectionHeader";
import AiIntakeAnalyzer from "../programs/AiIntakeAnalyzer";

const STEPS = [
  {
    num: "01",
    title: "Create a Free Account",
    desc: "Takes 30 seconds. No credit card. You immediately get workout logging, monthly focus plans, and member challenges.",
    ctaType: "signup" as const,
  },
  {
    num: "02",
    title: "Subscribe — Get 1-on-1 Training Without the 1-on-1 Price",
    desc: "This is the move. A subscription gives you direct access to me — my exercise library, my coaching, my programming — without paying $75–$150/session like everyone else charges.\n\n• Basic ($12.99/mo) — My entire exercise library. 85+ exercises I've tested, refined, and proven over 20 years. Filtered by level so you never do something you're not ready for. This alone is better programming than most people get from a trainer.\n• Pro ($25.99/mo) — Come to me. In person, online, or send me a video. I'll customize your program perfectly every single month. Plus the Fix It rehab library for when something doesn't feel right.\n• Elite ($42.99/mo) — Monthly 1-on-1 check-ins, priority coaching, direct messaging. The closest thing to having a personal trainer on call.\n• Team ($84.99/mo) — Full-roster programming for coaches and organizations.",
    ctaType: "pricing" as const,
  },
  {
    num: "03",
    title: "Buy a Program",
    desc: "Don't want a subscription? No problem. Grab a standalone program:\n\n• 4-Week Programs ($20–$30) — Focused training blocks for specific goals or in-season work.\n• 8-Week Programs ($30–$40) — Full training systems loaded into your portal. Log every set, message Matt on any exercise, get form feedback.\n• Custom Programs ($20–$40) — Fill out an intake form. Matt builds it from scratch for your sport, equipment, and level.\n\nEvery program can be downloaded and printed as a PDF to keep forever.",
    ctaType: "store" as const,
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
      <SectionHeader title="How It Works" timestamp="Three steps. No contracts. No filler." />

      {/* Welcome message */}
      <div className="bg-primary/10 border border-primary/20 shadow-m2 p-5 mb-6">
        <p className="text-sm text-foreground leading-relaxed">
          <span className="font-bold">"I train athletes. Every single person who walks through my door — or signs up online — is an athlete to me.</span> Whether you're 14 and playing varsity, 40 and want to keep up with your kids, or 60 and want to feel strong again. The exercises are the same. The foundation is the same. You just add weight. I've spent 20 years refining this — and I promise you, every single exercise in my library is good for you."
        </p>
        <span className="text-[10px] font-mono text-primary mt-2 block">— Matt Michels, M² Training</span>
      </div>

      {/* Everyone is an athlete callout */}
      <div className="bg-card shadow-m2 p-5 mb-6">
        <div className="flex items-start gap-3">
          <Dumbbell size={20} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-foreground mb-1">I Train Everyone. Every Age. Every Level.</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Youth athletes. Parents. Adults who haven't touched a weight in years. Coaches who want to practice what they preach. 
              The foundation of strength training doesn't change — your body needs the same movements whether you're 15 or 55. 
              The difference is the load, the progression, and knowing what to do when something doesn't feel right. That's where 20 years of daily experience matters.
            </p>
          </div>
        </div>
      </div>

      {/* Logged-in user quick access */}
      {user && (
        <div className="bg-primary/5 border border-primary/20 shadow-m2 p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-bold text-foreground">You're in. 👊</p>
            <p className="text-xs text-muted-foreground">Your portal is ready — log workouts, track progress, access your programs.</p>
          </div>
          <GoToPortalButton />
        </div>
      )}

      {/* Market comparison */}
      <div className="bg-secondary/50 border border-border shadow-m2 p-4 mb-6">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-foreground mb-1">What does 1-on-1 coaching cost everywhere else?</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              In-gym personal training averages <span className="text-foreground font-bold">$40–$150/session</span> ($250–$400/mo). 
              Online coaching packages run <span className="text-foreground font-bold">$100–$300/mo</span>. 
              My subscription starts at <span className="text-primary font-bold">$12.99/mo</span> — same 20 years of expertise, 
              same personalized approach, delivered to your phone. No overhead, no middleman, just results.
            </p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-8">
        {STEPS.map((step) => (
          <div key={step.num} className="bg-card shadow-m2 p-5 flex gap-4">
            <span className="text-2xl font-mono font-bold text-primary/30 flex-shrink-0">{step.num}</span>
            <div>
              <h3 className="text-sm font-bold text-foreground mb-1">{step.title}</h3>
              {step.desc.split("\n\n").map((paragraph, i) => (
                <p key={i} className="text-xs text-muted-foreground leading-relaxed mb-2 last:mb-0 whitespace-pre-line">{paragraph}</p>
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
                  Browse Programs
                  <ArrowRight size={12} />
                </button>
              )}
              {step.ctaType === "pricing" && (
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 mt-2"
                >
                  Compare Plans
                  <ArrowRight size={12} />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* AI Program Finder */}
      {user && (
        <div className="mb-6">
          <AiIntakeAnalyzer />
        </div>
      )}

      {/* Free member banner */}
      <div className="bg-card shadow-m2 p-5 mb-6">
        <div className="flex items-start gap-3 mb-3">
          <Gift size={20} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-foreground mb-1">Free With Every Account</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">No subscription needed. Create an account and these are yours.</p>
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
            <span className="text-xs text-foreground">Workout Logging & Tracking</span>
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
        <h3 className="text-sm font-bold text-foreground mb-2">Want Ongoing Coaching?</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          A subscription gives you the full exercise library, Fix It rehab protocols, custom programming, and direct access to Matt — 
          the same quality of 1-on-1 training that costs $100–$300/mo everywhere else. Plans start at $12.99/mo. Cancel anytime.
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
          <p className="text-xs text-muted-foreground mb-4">Create a free account and see for yourself.</p>
          <SignUpButton />
        </div>
      )}
    </div>
  );
};

export default StoreGettingStarted;
