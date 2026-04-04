import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, TrendingUp, Users, FileText, Award, Heart, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Beautiful Monthly Reports",
    desc: "Each client gets a fully designed, personalized PDF delivered to their inbox on the first of every month. Progress vs. goals, body composition trends, strength gains, and next month's targets. Looks like a premium coaching service.",
  },
  {
    icon: TrendingUp,
    title: "Progress vs. Goals Tracking",
    desc: "AI compares current metrics against each client's stated goals and starting point. Every report shows exactly how far they've come and how far they have left to go — specific numbers, not vague encouragement.",
  },
  {
    icon: Heart,
    title: "Personalized Motivational Message",
    desc: "Every report ends with a message that references the client by name, acknowledges their specific progress, and sets the tone for the next month. Clients feel seen. Retention goes up.",
  },
  {
    icon: Award,
    title: "Strength and Performance Trends",
    desc: "Track PRs, workout completion rates, cardio benchmarks, and any metric you log. AI identifies trends the client might miss — like that their bench has gone up 15% over 3 months.",
  },
  {
    icon: Users,
    title: "Unlimited Clients",
    desc: "Whether you have 10 clients or 200, the price is $79/mo. No per-seat fees, no tiers. Add a new client in your dashboard and they're in the next report cycle.",
  },
  {
    icon: Zap,
    title: "Delivered Automatically",
    desc: "You don't touch it. Reports generate and send themselves on the 1st of every month. No reminders, no manual exports, no 'I meant to send that.' Every client, every month.",
  },
];

const COMPARISON = [
  { tool: "TrueCoach", price: "$20–30/mo", what: "Client tracking only — no reports, no automated delivery" },
  { tool: "PT Distinction", price: "$97/mo", what: "Assessment tools and habit tracking — reports are manual" },
  { tool: "TrainHeroic", price: "$20/mo", what: "Programming and performance tracking — no client-facing reports" },
  { tool: "Making reports manually", price: "30–60 min/client/mo", what: "10 clients = up to 10 hours of report writing per month" },
  { tool: "M2 Fitness Reports", price: "$79/mo", what: "Automated, personalized reports to every client, every month — 14-day trial, unlimited clients", highlight: true },
];

const STATS = [
  { number: "3x", label: "Longer retention for clients who receive monthly progress reports" },
  { number: "0 min", label: "Time you spend creating reports each month" },
  { number: "100%", label: "Of your clients get a report — not just the ones you have time for" },
];

export default function FitnessReports() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) {
      toast.error("Email and business name are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-fitness-reports-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-3">Your clients are going to love this.</h1>
        <p className="text-muted-foreground">Matt will reach out within 24 hours to get your client roster set up. Your first batch of reports goes out on the 1st of next month — to every single client.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Personal Trainer Client Progress Reports — Automated Monthly Reports | $79/mo"
        description="Monthly progress reports delivered to every client automatically. AI-generated, personalized, beautiful. Clients who get reports stay 3x longer. 14-day trial."
        path="/fitness-reports"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-24 pb-20 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <FileText size={11} /> Client Progress Reports
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-tight mb-6">
              Monthly Progress Reports<br />
              to Every Client.<br />
              <span className="text-primary">Automatically. Beautiful.</span>
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
              You know monthly progress reports would keep your clients engaged, motivated, and paying longer. But who has time to write 20 reports a month?
            </p>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              M2 does it for you. Add your clients and their metrics. On the 1st of every month, every client gets a personalized, professionally designed report in their inbox — without you touching anything.
            </p>
            <div className="flex flex-col items-center gap-2 mb-10">
              <div className="text-5xl font-black text-primary">$79<span className="text-2xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground">14-day free trial · Unlimited clients · Cancel anytime</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start 14-Day Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Stats */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto">
            <div className="grid sm:grid-cols-3 gap-6 text-center">
              {STATS.map((stat) => (
                <div key={stat.label} className="p-6 border border-border rounded-lg">
                  <div className="text-4xl font-black text-primary mb-2">{stat.number}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What a report looks like */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-3 uppercase tracking-tight">What Each Client Report Includes</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">Every report is generated fresh from your client's latest data — not a template with blank fields filled in.</p>
            <div className="space-y-3">
              {[
                "Progress vs. stated goals with percentage completion",
                "Body composition trend chart (weight, body fat %, measurements)",
                "Strength gains — top lifts vs. 30, 60, and 90 days ago",
                "Workout completion rate and consistency streak",
                "Month's highlight: biggest win called out specifically",
                "Next month's targets — specific numbers to hit",
                "Personalized motivational message by name",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle size={15} className="text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 bg-card border-b border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <f.icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-1">{f.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-2 uppercase tracking-tight">What Others Charge</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">Every other tool tracks data. None of them send your clients a beautiful report automatically.</p>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div
                  key={c.tool}
                  className={`flex items-center justify-between p-4 border rounded-lg ${c.highlight ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div>
                    <p className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</p>
                    <p className="text-xs text-muted-foreground">{c.what}</p>
                  </div>
                  <div className={`text-lg font-black whitespace-nowrap ml-4 ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>{c.price}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Signup */}
        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your 14-Day Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">
              Unlimited clients included. First reports go out on the 1st of next month — to every single one of them.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business / Gym Name *", placeholder: "Elite Performance Training" },
                { key: "name", label: "Your Name *", placeholder: "Sarah Johnson" },
                { key: "email", label: "Email *", placeholder: "sarah@eliteperformance.com", type: "email" },
                { key: "phone", label: "Phone *", placeholder: "(313) 555-0100", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input
                    type={f.type || "text"}
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3.5 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded-sm transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Redirecting…" : "Start Sending Reports — $79/mo"}
              </button>
              <p className="text-center text-xs text-muted-foreground pt-1">14-day free trial · Unlimited clients · Cancel anytime</p>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
