import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Search, DollarSign, Calendar, Target, FileText, TrendingUp, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "500+ Grant Sources Searched Weekly",
    desc: "Federal grants, state programs, private foundations, community funds, corporate giving programs — all searched every Monday so you never miss a funding window.",
  },
  {
    icon: Target,
    title: "AI Fit Scoring — 0 to 100",
    desc: "Every opportunity gets a match score based on your mission, geography, cause areas, and org size. You review the top matches first. No wading through irrelevant listings.",
  },
  {
    icon: Calendar,
    title: "Deadline Tracking Built In",
    desc: "Every result includes the application deadline, award amount, and a direct link to the application portal. Sorted by deadline so you work the most urgent ones first.",
  },
  {
    icon: FileText,
    title: "2-Sentence AI Summary Per Grant",
    desc: "What the grant is for, who funds it, and why your org is a strong match — in plain English. Decide in 10 seconds whether it's worth pursuing.",
  },
  {
    icon: DollarSign,
    title: "Award Range Included",
    desc: "Min/max award amounts for every opportunity so you can prioritize by effort-to-reward ratio. Don't spend 40 hours applying for a $500 grant.",
  },
  {
    icon: TrendingUp,
    title: "Cumulative Opportunity Dashboard",
    desc: "Track every opportunity you've been sent over time — what you applied for, what's pending, what you won. Your complete funding pipeline in one view.",
  },
];

const COMPARISON = [
  { tool: "GrantStation", price: "$699/yr ($58/mo)", what: "Directory access only — no matching, no AI, no automation", highlight: false },
  { tool: "Foundation Directory Online", price: "$2,500/yr", what: "Candid's database — powerful but requires a trained researcher", highlight: false },
  { tool: "Grant Writer (freelance)", price: "$3,000–10,000 per app", what: "Single application — not a scalable discovery system", highlight: false },
  { tool: "Manual research", price: "10+ hrs/week", what: "Staff time at $20–40/hr = $800–1,600/mo in lost capacity", highlight: false },
  { tool: "M2 Grant Discovery", price: "$199/mo", what: "Weekly ranked list — matched to your mission, ready to act on", highlight: true },
];

export default function GrantDiscovery() {
  const [form, setForm] = useState({
    email: "", name: "", orgName: "", phone: "",
    mission: "", geography: "", causeAreas: "",
  });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.orgName) { toast.error("Email and organization name are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-grant-discovery-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">First report arrives Monday.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your organization profile is set. Every Monday morning you'll receive a ranked list of funding opportunities matched to your mission — with fit scores, award amounts, deadlines, and direct links.
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
        title="Nonprofit Grant Discovery Engine — Weekly Ranked Funding Opportunities | $199/mo"
        description="Every Monday: a ranked list of grant opportunities matched to your nonprofit's mission, geography, and cause areas. AI fit scores, deadlines, award amounts. $199/mo. 14-day trial."
        path="/grant-discovery"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-24 pb-20 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Search size={11} /> Grant Discovery Engine
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-6">
              Every Monday: your ranked list of<br />
              <span className="text-primary">funding opportunities — matched to your mission.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
              Grant research takes 10+ hours a week — and most nonprofits still miss 80% of what they qualify for. This system searches 500+ sources every week and delivers only the opportunities that fit your org, scored and sorted by relevance.
            </p>
            <div className="mb-10">
              <div className="text-5xl font-black text-primary">$199<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground mt-1">14-day free trial · No contracts · Cancel anytime</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start Finding Funding <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Stat strip */}
        <section className="py-8 px-4 border-b border-border bg-card">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <span>500+ Grant Sources</span>
            <span className="text-border">|</span>
            <span>AI Fit Score 0–100</span>
            <span className="text-border">|</span>
            <span>Every Monday Delivery</span>
            <span className="text-border">|</span>
            <span>Federal + State + Foundation</span>
          </div>
        </section>

        {/* What a report looks like */}
        <section className="py-20 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">Sample Report Entry</p>
              <h2 className="text-2xl sm:text-3xl font-black">What lands in your inbox every Monday.</h2>
            </div>
            <div className="border border-primary/30 rounded-lg p-6 bg-primary/5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-black text-sm">USDA Rural Development Community Facilities Grant</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Federal · U.S. Department of Agriculture</p>
                </div>
                <div className="flex-shrink-0 bg-primary text-white text-xs font-black px-2.5 py-1 rounded">
                  FIT 91
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Award</p>
                  <p className="text-sm font-black">$25K–$250K</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Deadline</p>
                  <p className="text-sm font-black">May 15, 2026</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Type</p>
                  <p className="text-sm font-black">Capital Grant</p>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Why you match:</strong> Your rural food security program in Michigan aligns directly with USDA's priority communities and you meet the 501(c)(3) eligibility requirement. Competitive based on your service population size.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">What You Get</p>
              <h2 className="text-2xl sm:text-3xl font-black">A full-time grant researcher. At 1/10th the cost.</h2>
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
              <h2 className="text-2xl sm:text-3xl font-black">What grant discovery actually costs.</h2>
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
                  <div className={`text-base font-black whitespace-nowrap ml-4 ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>{c.price}</div>
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
              <p className="text-muted-foreground text-sm">$199/mo after trial. First report arrives the following Monday.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "name", label: "Your Name *", placeholder: "Jordan Lee", type: "text" },
                { key: "orgName", label: "Organization Name *", placeholder: "Lighthouse Community Foundation", type: "text" },
                { key: "email", label: "Email Address *", placeholder: "jordan@lighthousefound.org", type: "email" },
                { key: "phone", label: "Phone Number *", placeholder: "(313) 555-0100", type: "tel" },
                { key: "geography", label: "Service Area *", placeholder: "Southeast Michigan / Wayne County", type: "text" },
                { key: "causeAreas", label: "Primary Cause Areas *", placeholder: "Food security, housing, workforce development", type: "text" },
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
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Organization Mission *</label>
                <textarea
                  value={form.mission}
                  onChange={e => setForm(p => ({ ...p, mission: e.target.value }))}
                  placeholder="Describe your organization's mission in 2-3 sentences. What do you do, who do you serve, and what outcomes do you work toward?"
                  rows={3}
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3.5 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-4 transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Redirecting…" : "Start Free Trial — $199/mo After"}
              </button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-4">Secure checkout via Stripe. No card charged for 14 days.</p>
          </div>
        </section>

      </div>
    </>
  );
}
