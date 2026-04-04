import SEOHead from "@/components/layout/SEOHead";
import WaitlistGate from "@/components/WaitlistGate";
import { Clock, Star, ArrowRight, BarChart2 } from "lucide-react";

const FEATURES = [
  { icon: Clock, label: "Monitors Google reviews 24/7", sub: "Never miss a new review — positive or negative" },
  { icon: Star, label: "AI-crafted responses that sound human", sub: "Not robotic auto-replies — genuinely personal, professional tone" },
  { icon: ArrowRight, label: "Responds within 2 hours", sub: "Every review answered fast, while the moment still matters" },
  { icon: BarChart2, label: "Weekly email report", sub: "Ratings trend, response rate, and review count delivered every Monday" },
];

export default function ReviewResponder() {
  return (
    <>
      <SEOHead
        title="Automated Google Review Responses — Coming Soon | M2 Review Responder"
        description="Every Google review answered within 2 hours, automatically. AI-crafted responses that sound human. Join the waitlist to be first in line."
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">M2 Review Responder</p>
          <h1 className="text-3xl font-black mb-4">Your Google reviews —<br />answered within 2 hours. Automatically.</h1>
          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            Every 1-star review left unanswered costs you customers. We respond for you — professionally, personally, 24/7.
          </p>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* Features */}
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">What you'll get</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
            {FEATURES.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="bg-card border border-border p-5 flex items-start gap-3">
                <Icon size={18} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-foreground mb-1">{label}</p>
                  <p className="text-[12px] text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Waitlist Gate */}
          <WaitlistGate
            productName="Review Responder"
            description="We're building full GBP OAuth integration so this runs 100% on autopilot. Join the waitlist and we'll notify you the moment it's live — founding clients get a locked-in discount."
          />

          {/* Matt trust block */}
          <div className="bg-card border border-border p-5 mt-10 flex items-start gap-4">
            <img
              src="https://www.mattmichelstraining.com/images/matt-boat.jpg"
              alt="Matt Michels"
              className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0"
            />
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">I'm Matt Michels — Grosse Pointe, MI.</span> I built this because I watched too many good local businesses lose customers over unanswered reviews. You're busy. Let the system handle it.
            </p>
          </div>

          <p className="text-[12px] text-muted-foreground text-center mt-8">Questions? Email <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a> or text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    </>
  );
}
