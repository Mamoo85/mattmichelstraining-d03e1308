import { ShoppingBag } from "lucide-react";
import SectionHeader from "./SectionHeader";

const WHAT_YOU_GET = [
  { title: "Full written program", desc: "Every exercise, set, rep, and rest period. No guessing." },
  { title: "Built around your goals", desc: "Not a template. Matt reads your intake and writes it for you." },
  { title: "Equipment-specific", desc: "Works with what you have — gym, home, or a hotel room." },
  { title: "Coaching cues included", desc: "Key technique notes on each movement so you do it right." },
];

const LEVELS = [
  { key: "beginner", label: "Beginner", desc: "New to structured training or returning after a long break" },
  { key: "intermediate", label: "Intermediate", desc: "Training consistently for 1+ years with some structure" },
  { key: "advanced", label: "Advanced", desc: "Competitive athlete or serious lifter with specific performance goals" },
];

const ShopGrid = () => (
  <div>
    <SectionHeader title="M² Store" timestamp="Custom programs · Built by Matt" />

    {/* Hero product */}
    <div className="bg-card shadow-m2 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Custom · One-Time · $20</span>
      </div>
      <h2 className="text-lg font-bold text-foreground mb-2">Your Custom Workout Program</h2>
      <p className="text-sm text-muted-foreground mb-4 text-balance">
        Fill out your intake below. Matt reads it, builds your program from scratch, and sends it to you.
        One workout, built specifically for you.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {WHAT_YOU_GET.map((item, i) => (
          <div key={i} className="bg-muted p-3">
            <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Intake form */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Your Intake</h3>
        <p className="text-xs text-muted-foreground">Matt reads every field. The more detail you give, the better the program.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Name *</label>
            <input className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="Your name" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
            <input className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="you@email.com" type="email" />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Training Level *</label>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => (
              <button key={l.key} className="bg-muted p-2 text-left hover:bg-m2-surface-hover transition-m2 border border-transparent hover:border-primary/30">
                <span className="text-xs font-bold text-foreground block">{l.label}</span>
                <span className="text-[10px] text-muted-foreground">{l.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Goals *</label>
          <textarea className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-20" placeholder="What are you working toward?" />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Equipment Available (optional)</label>
          <input className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="Full gym, home dumbbells, etc." />
        </div>

        <button className="bg-primary text-primary-foreground px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2">
          <ShoppingBag size={14} />
          Save Intake + Checkout · $20
        </button>

        <p className="text-[10px] text-muted-foreground">
          Secure checkout via Stripe. One-time payment. Matt builds your program after payment is confirmed.
        </p>
        <div className="bg-primary/5 border border-primary/10 p-3 mt-2">
          <p className="text-xs text-foreground font-bold">Matt's Guarantee</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            If the program isn't what you needed, email Matt and he'll either fix it or refund you. No forms, no drama.
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default ShopGrid;
