import { useState } from "react";
import { ShoppingBag, Lightbulb, Shield, BookOpen, DollarSign } from "lucide-react";
import SectionHeader from "./SectionHeader";

const WHAT_YOU_GET = [
  { icon: Lightbulb, title: "The WHY behind every rep", desc: "Not just exercises — the reasoning. When they understand why, they do it better. 100% of the time." },
  { icon: BookOpen, title: "Built from scratch by Matt", desc: "He reads your intake personally. No templates, no AI, no assistants. 20+ years of knowledge in your hands." },
  { icon: Shield, title: "Zero-injury methodology", desc: "The same system that's produced 50+ college athletes with zero injuries. Proven. Every time." },
  { icon: DollarSign, title: "Best value in strength training", desc: "$20 for a custom program from a specialist who charges $100+/hour in person. That's not a typo." },
];

const LEVELS = [
  { key: "youth", label: "Youth (12-14)", desc: "Building the foundation — work capacity, movement quality, and confidence" },
  { key: "highschool", label: "High School (14-18)", desc: "College prep — real strength, injury prevention, and sport-specific power" },
  { key: "college", label: "College / Adult", desc: "Performance optimization — advanced programming for competitive athletes" },
];

const ShopGrid = () => {
  const [selectedLevel, setSelectedLevel] = useState("");

  return (
    <div>
      <SectionHeader title="M² Store" timestamp="20+ years of knowledge · Custom-built for your athlete" />

      {/* Scarcity + Value Hook */}
      <div className="bg-primary/10 border border-primary/20 shadow-m2 p-5 mb-6">
        <p className="text-sm text-foreground text-balance leading-relaxed mb-2">
          <span className="font-bold">"I can only train so many athletes in person.</span> There aren't enough hours in the day,
          and I won't sacrifice quality. But I figured out how to share what I know — not just the exercises,
          but the <span className="text-primary font-bold">WHY</span> behind them. When they know why, they do it better."
        </p>
        <span className="text-[10px] font-mono text-primary">— Matt Michels</span>
      </div>

      {/* Hero product */}
      <div className="bg-card shadow-m2 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Custom Program · One-Time</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-mono font-bold text-primary">$20</span>
            <span className="text-[10px] text-muted-foreground line-through">$100+/hr in person</span>
          </div>
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">Your Athlete's Custom Strength Program</h2>
        <p className="text-sm text-muted-foreground mb-4 text-balance leading-relaxed">
          Fill out the intake. Matt reads it — every word — and builds a program from scratch for your athlete.
          Not a template. Not a generic PDF. A real program with real coaching cues and the reasoning behind every movement.
          The same methodology that's produced 50+ college athletes with zero injuries.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {WHAT_YOU_GET.map((item, i) => (
            <div key={i} className="bg-muted p-3 flex gap-3">
              <item.icon size={18} className="text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Intake form */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Your Athlete's Intake</h3>
          <p className="text-xs text-muted-foreground">Matt reads every field. The more you share, the better the program. He wants to know about your kid.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Parent Name *</label>
              <input className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="Your name" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
              <input className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="you@email.com" type="email" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Athlete's Name *</label>
              <input className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="Your athlete's name" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Age & Sport *</label>
              <input className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. 15, Hockey" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Training Level *</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => setSelectedLevel(l.key)}
                  className={`p-2 text-left transition-m2 border ${
                    selectedLevel === l.key
                      ? "bg-primary/10 border-primary/40"
                      : "bg-muted border-transparent hover:bg-m2-surface-hover hover:border-primary/30"
                  }`}
                >
                  <span className="text-xs font-bold text-foreground block">{l.label}</span>
                  <span className="text-[10px] text-muted-foreground">{l.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Goals & Any Injuries *</label>
            <textarea className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-24" placeholder="What's your athlete working toward? Any injuries or pain to be aware of? What does their current training look like?" />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Equipment Available (optional)</label>
            <input className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="Full gym, school weight room, home setup, etc." />
          </div>

          <button className="bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 w-full justify-center">
            <ShoppingBag size={14} />
            Get Your Custom Program · $20
          </button>

          <p className="text-[10px] text-muted-foreground text-center">
            Secure checkout via Stripe. One-time payment. Matt builds the program after payment and sends it to you personally.
          </p>

          <div className="bg-primary/5 border border-primary/10 p-4">
            <p className="text-xs text-foreground font-bold mb-1">Matt's Guarantee</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              If the program isn't what you needed, email Matt and he'll fix it or refund you. No forms, no drama, no questions.
              But in 20+ years and thousands of programs — it hasn't happened yet.
            </p>
          </div>

          <div className="bg-muted p-4 text-center">
            <p className="text-xs text-foreground font-bold mb-1">Why is this only $20?</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md mx-auto">
              Because Matt charges $100+/hour in person and can only see so many athletes a week.
              This is how he shares 20+ years of knowledge with athletes he can't reach in person.
              Same system. Same methodology. Same results. Just delivered differently.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopGrid;
