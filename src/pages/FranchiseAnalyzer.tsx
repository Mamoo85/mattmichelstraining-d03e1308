import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, FileSearch, AlertTriangle, TrendingUp, Shield, Clock, Scale } from "lucide-react";

const FEATURES = [
  {
    icon: FileSearch,
    title: "All 23 FDD Items Extracted",
    desc: "Every fee, royalty, marketing fund contribution, territory right, renewal term, and termination clause pulled from the document and presented in plain English — not legalese.",
  },
  {
    icon: AlertTriangle,
    title: "Item 20 Failure Rate Analysis",
    desc: "Item 20 tells you how many franchisees left the system last year — voluntarily or not. AI extracts the real churn rate and compares it to industry averages. Most buyers never read it.",
  },
  {
    icon: Shield,
    title: "Red Flag Detection",
    desc: "Unusual termination clauses. No Item 19 financial disclosure. High franchisee turnover. First-right-of-refusal on resale. AI flags every pattern that experienced franchise attorneys look for.",
  },
  {
    icon: TrendingUp,
    title: "Risk Score 1–100",
    desc: "A single number summarizing overall risk — based on fee structure, franchisee failure rates, termination power, and territory protections. Compare across multiple FDDs instantly.",
  },
  {
    icon: Clock,
    title: "4-Hour Turnaround",
    desc: "Submit the FDD, get your full analysis within 4 hours. No scheduling calls with attorneys, no 2-week waiting periods, no $5,000 invoice.",
  },
  {
    icon: Scale,
    title: "Industry Benchmark Comparison",
    desc: "How does this franchise's royalty rate compare to others in the same category? Are the territorial rights stronger or weaker than average? Context included in every analysis.",
  },
];

const COMPARISON = [
  { tool: "Franchise attorney review", price: "$2,000–5,000", what: "Gold standard — but slow (1-2 weeks), expensive, and still requires you to digest a 50-page memo" },
  { tool: "Franchise consultant", price: "$500–1,500", what: "Conflict of interest — most earn commissions when you sign. Not truly independent." },
  { tool: "DIY reading", price: "40+ hours", what: "400 pages of dense legal text written specifically to be difficult to understand" },
  { tool: "M2 Franchise Analyzer", price: "$299/mo", what: "Complete AI analysis in 4 hours. All red flags surfaced. Risk score. Plain English. Use attorney to verify, not discover.", highlight: true },
];

export default function FranchiseAnalyzer() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.name) { toast.error("Email and name are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-franchise-analyzer-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">Access confirmed.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Matt will send you login details and instructions within 24 hours. Your first FDD analysis is included — submit it anytime after setup.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Questions? <a href="tel:+13138064952" className="text-primary font-bold">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Franchise FDD Analyzer — AI Risk Analysis in 4 Hours | $299/mo"
        description="Upload your Franchise Disclosure Document. Get complete risk analysis in 4 hours: all fees, failure rates, red flags, and a 1-100 risk score. No attorneys needed to start."
        path="/franchise-analyzer"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <FileSearch size={11} /> Franchise Due Diligence
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              400 Pages of Franchise Legalese.<br /><span className="text-primary">Plain-English Risk Analysis. 4 Hours.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              The FTC requires franchisors to give you a Franchise Disclosure Document. It's 200–400 pages of dense legal text written by their attorneys. Before you sign anything, you need to know what's actually in it.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$299<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-8">Includes 3 FDD analyses/mo · 14-day free trial · Cancel anytime</p>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Analyze My FDD <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* What gets extracted */}
        <section className="py-12 px-4 border-b border-border bg-card/30">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center mb-6">What the analysis extracts from every FDD</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {["Initial franchise fee", "Ongoing royalty %", "Marketing fund %", "Territory size & exclusivity", "Term length", "Renewal rights", "Termination clauses", "Item 19 (or lack of it)", "Item 20 failure rates", "Transfer/resale rights", "Technology fees", "Risk score 1–100"].map(item => (
                <div key={item} className="px-3 py-2 border border-border rounded text-xs text-muted-foreground">{item}</div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="p-5 border border-border rounded-lg">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                    <f.icon size={16} className="text-primary" />
                  </div>
                  <h3 className="font-bold text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-8 uppercase tracking-tight">Your Options for FDD Review</h2>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div key={c.tool} className={`flex items-start justify-between p-4 border rounded-lg gap-4 ${c.highlight ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.what}</div>
                  </div>
                  <div className={`text-sm font-black shrink-0 ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>{c.price}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">Use M2 to discover the issues, then use an attorney to verify. Cut legal costs by 60–80%.</p>
          </div>
        </section>

        {/* Sign-up */}
        <section id="signup" className="py-20 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your Free Trial</h2>
            <p className="text-sm text-muted-foreground text-center mb-8">14 days free · 3 FDD analyses included · No commitment</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="email" placeholder="Email address *" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className="w-full px-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
              <input type="text" placeholder="Your full name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
              <input type="text" placeholder="Company (if applicable)" value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} className="w-full px-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
              <input type="tel" placeholder="Phone number" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <>Get Access <ArrowRight size={14} /></>}
              </button>
              <p className="text-xs text-muted-foreground text-center">No credit card required for trial. $299/mo after 14 days.</p>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
