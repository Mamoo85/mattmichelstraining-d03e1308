import WaitlistGate from "@/components/WaitlistGate";
import { CheckCircle, ClipboardCheck, BarChart3, AlertTriangle, TrendingUp } from "lucide-react";

const BENEFITS = [
  { icon: ClipboardCheck, label: "Auto-survey after each job", sub: "Customers receive a quick survey automatically — no manual follow-up needed" },
  { icon: BarChart3, label: "Monthly NPS score", sub: "Track your Net Promoter Score over time and see how your service is trending" },
  { icon: AlertTriangle, label: "Catch unhappy customers early", sub: "Get instant alerts when a customer leaves negative feedback so you can fix it fast" },
  { icon: TrendingUp, label: "Improve your service", sub: "Use real data from real customers to make your business better every month" },
];

const STEPS = [
  { num: "1", title: "Sign up", desc: "Enter your business info and connect your customer list." },
  { num: "2", title: "AI surveys customers", desc: "After each job, customers get a short, friendly satisfaction survey." },
  { num: "3", title: "Get insights", desc: "View your NPS score, read feedback, and get alerts on unhappy customers." },
];

export default function SatisfactionSurvey() {
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">You're all set.</h1>
          <p className="text-muted-foreground leading-relaxed">Matt will reach out within 24 hours to get your surveys configured and running.</p>
          <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="bg-[#1e293b] text-white px-6 py-16 text-center">
        <p className="inline-block text-[11px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full mb-4">Customer Satisfaction Survey</p>
        <h1 className="text-3xl font-black mb-4 leading-tight">
          Find out what your customers really think — before they tell Google.
        </h1>
        <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed mb-4">
          Automated surveys after every job. Track your NPS score, catch unhappy customers early, and improve your service with real feedback.
        </p>
        <p className="text-2xl font-black text-primary">$29<span className="text-sm font-normal text-slate-400">/month</span></p>
        <p className="text-[12px] text-slate-400 mt-1">7-day free trial. Cancel anytime.</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {BENEFITS.map(({ icon: Icon, label, sub }) => (
            <div key={label} className="bg-card border border-border p-5">
              <Icon size={20} className="text-primary mb-3" />
              <p className="font-bold text-sm text-foreground mb-1">{label}</p>
              <p className="text-[12px] text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {STEPS.map(({ num, title, desc }) => (
            <div key={num} className="bg-card border border-border p-5">
              <p className="text-2xl font-black text-primary mb-2">{num}</p>
              <p className="font-bold text-sm text-foreground mb-1">{title}</p>
              <p className="text-[12px] text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        {/* Sign-up form */}
        <div className="mb-10">
          <WaitlistGate productName="AI Satisfaction Surveys" description="Automated post-purchase satisfaction surveys sent by text or email, with AI-analyzed results." price="See pricing" />
        </div>

        {/* Founder credibility */}
        <div className="bg-card border border-border p-5 mb-10 flex items-start gap-4">
          <img src="/images/matt-boat.jpg" alt="Matt Michels" className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0" />
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            <span className="font-bold text-foreground">Matt Michels — Grosse Pointe, MI.</span>{" "}
            I built this because most businesses never ask for feedback until a bad review shows up on Google. This fixes that.
          </p>
        </div>

        <p className="text-[12px] text-muted-foreground text-center">
          Questions? Email <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a> or text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );
}
