import { Link } from "react-router-dom";
import { ArrowRight, Gift, Star, Trophy, Users, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SectionHeader from "../SectionHeader";

const STEPS = [
  {
    num: "01",
    title: "Create Your Free Account",
    desc: "Sign up in 30 seconds. No credit card needed. You'll get access to monthly focus plans, member challenges, and workout logging immediately.",
  },
  {
    num: "02",
    title: "Grab a Guide or Custom Program",
    desc: "Browse the Store tab for sport-specific PDF guides ($9) or get a fully custom program built by Matt ($20). Every guide teaches the WHY behind each movement.",
  },
  {
    num: "03",
    title: "Subscribe for the Full Experience",
    desc: "M² Basic ($14.99/mo) unlocks the Exercise Library. Pro ($29.99/mo) adds custom programming and the Fix It library. Elite ($49.99/mo) gets you 1-on-1 check-ins with Matt.",
  },
  {
    num: "04",
    title: "Train, Log, Improve",
    desc: "Use the Portal to log every workout. Track your progress over time. Matt's system is built on consistency — the app keeps you accountable.",
  },
];

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

      {/* Steps */}
      <div className="space-y-3 mb-8">
        {STEPS.map((step) => (
          <div key={step.num} className="bg-card shadow-m2 p-5 flex gap-4">
            <span className="text-2xl font-mono font-bold text-primary/30 flex-shrink-0">{step.num}</span>
            <div>
              <h3 className="text-sm font-bold text-foreground mb-1">{step.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
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
            <span className="text-xs text-foreground">Random awesome workouts that literally nobody could think of except Matt</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      {!user && (
        <div className="text-center">
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            Create Free Account
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
};

export default StoreGettingStarted;
