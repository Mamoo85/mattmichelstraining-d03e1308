import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Upload, MessageSquare, Target, TrendingUp, Users, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Upload,
    title: "Upload Once. AI Does the Rest.",
    desc: "Drop in your CSV of prospects. AI reads every row, researches coverage type, company size, and past carrier data — then writes a personalized opener for each contact.",
  },
  {
    icon: MessageSquare,
    title: "5-Touch SMS + Email Sequence",
    desc: "Each prospect gets a tailored sequence: initial outreach, follow-up, value add, social proof, and final ask. Spaced over 14 days. Feels human. Runs while you sleep.",
  },
  {
    icon: Target,
    title: "Coverage-Type Personalization",
    desc: "Auto, home, life, commercial — each gets a different message angle. A commercial fleet owner doesn't read the same pitch as a first-time homeowner. The AI knows the difference.",
  },
  {
    icon: TrendingUp,
    title: "Open Rate + Response Dashboard",
    desc: "See exactly who opened, who clicked, who replied. Filter by coverage type, sequence step, or response status. Know your best leads before you pick up the phone.",
  },
  {
    icon: Users,
    title: "Automatic Lead Scoring",
    desc: "AI scores each prospect based on engagement signals. Highest-intent contacts surface first so your follow-up calls close faster.",
  },
  {
    icon: CheckCircle,
    title: "Compliance-Safe Messaging",
    desc: "All messages are reviewed against insurance marketing compliance guidelines. No TCPA landmines. Opt-out handled automatically.",
  },
];

const COMPARISON = [
  { tool: "OutboundEngine", price: "$299/mo", what: "Automated marketing — generic, not coverage-specific", highlight: false },
  { tool: "AgencyZoom", price: "$150/mo", what: "CRM only — you still write every follow-up yourself", highlight: false },
  { tool: "Manual follow-up", price: "~2 hrs/day", what: "Your time at $50-100/hr = $3,000+/mo in lost productivity", highlight: false },
  { tool: "M2 Insurance Drip", price: "$149/mo", what: "Full AI drip — personalized by coverage type, hands-free", highlight: true },
];

export default function InsuranceDrip() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.name) { toast.error("Name and email are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-insurance-drip-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) { toast.error(err.message || "Something went wrong"); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-3">You're live in 24 hours.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Matt will send you a secure CSV upload link within 24 hours. Once your prospect list is in, the AI sequences launch automatically.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Questions? <a href="tel:+13138064952" className="text-primary font-medium">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Insurance Agent Lead Drip — AI Follow-Up for Every Prospect | $149/mo"
        description="Upload your prospect list. AI researches each lead, writes personalized 5-touch SMS+email sequences by coverage type, and reports open rates. $149/mo. 14-day free trial."
        path="/insurance-drip"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-24 pb-20 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Upload size={11} /> Insurance Lead Drip
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-6">
              Upload your leads.<br />
              <span className="text-primary">AI follows up with every single one.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
              Most insurance agents follow up with 20% of their prospects — and only once. This system follows up with 100%, five times, personalized to their exact coverage type. You make the calls that matter.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <div>
                <div className="text-5xl font-black text-primary">$149<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
                <p className="text-sm text-muted-foreground mt-1">14-day free trial · No contracts · Cancel anytime</p>
              </div>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start Free Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Social proof strip */}
        <section className="py-8 px-4 border-b border-border bg-card">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <span>5-Touch Automated Sequence</span>
            <span className="text-border">|</span>
            <span>Auto · Home · Life · Commercial</span>
            <span className="text-border">|</span>
            <span>Open Rate Reporting</span>
            <span className="text-border">|</span>
            <span>TCPA Compliant</span>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">How It Works</p>
              <h2 className="text-2xl sm:text-3xl font-black">Three steps. Then nothing.</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { n: "01", title: "Upload Your List", desc: "CSV with name, phone, email, coverage type. Standard export from any CRM." },
                { n: "02", title: "AI Builds Sequences", desc: "Within 2 hours, every contact has a 5-message sequence written and scheduled — personalized to their coverage type and business profile." },
                { n: "03", title: "Review Your Dashboard", desc: "Each morning, see who opened, who replied, and which leads scored highest. You call the warm ones." },
              ].map((step) => (
                <div key={step.n} className="border border-border p-6 relative">
                  <div className="text-5xl font-black text-primary/10 absolute top-4 right-4 leading-none select-none">{step.n}</div>
                  <p className="font-black text-sm mb-2">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">What You Get</p>
              <h2 className="text-2xl sm:text-3xl font-black">Everything you need. Nothing you don't.</h2>
            </div>
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
        <section className="py-20 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">The Alternatives</p>
              <h2 className="text-2xl sm:text-3xl font-black">What everyone else charges.</h2>
            </div>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div
                  key={c.tool}
                  className={`flex items-center justify-between p-5 border rounded-lg ${c.highlight ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div>
                    <p className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.what}</p>
                  </div>
                  <div className={`text-lg font-black whitespace-nowrap ml-4 ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>{c.price}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sign up */}
        <section id="signup" className="py-20 px-4 bg-card border-t border-border">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black mb-2">Start Your 14-Day Free Trial</h2>
              <p className="text-muted-foreground text-sm">$149/mo after trial. Cancel anytime. Matt sends your CSV upload link within 24 hours.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "name", label: "Your Name *", placeholder: "Sarah Johnson", type: "text" },
                { key: "businessName", label: "Agency Name *", placeholder: "Johnson Insurance Agency", type: "text" },
                { key: "email", label: "Email Address *", placeholder: "sarah@johnsoninsurance.com", type: "email" },
                { key: "phone", label: "Mobile Phone *", placeholder: "(313) 555-0100", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3.5 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-4 transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Redirecting…" : "Start Free Trial — $149/mo After"}
              </button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-4">Secure checkout via Stripe. No card charged for 14 days.</p>
          </div>
        </section>

      </div>
    </>
  );
}
