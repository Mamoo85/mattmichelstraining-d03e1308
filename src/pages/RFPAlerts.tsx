import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Search, Bell, FileText, Target, TrendingUp, Shield } from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Daily Scan of SAM.gov + 50 State Portals",
    desc: "Every weekday morning, AI scans SAM.gov and all 50 state procurement portals for opportunities matching your exact services and geography. Nothing slips through.",
  },
  {
    icon: Target,
    title: "AI Fit Score 1–100",
    desc: "Every opportunity is scored based on how well it matches your service profile. You only see the ones worth your time — not every contract in existence.",
  },
  {
    icon: Bell,
    title: "SMS Alert for High-Fit Opportunities",
    desc: "When a contract scores 80 or above, you get a text immediately — not just an email digest. High-fit bids don't wait until Monday morning.",
  },
  {
    icon: FileText,
    title: "Full Opportunity Brief Included",
    desc: "Each alert includes: scope of work, contract value, deadline, agency contact, past award history, and whether it's a set-aside (small business, veteran, minority-owned).",
  },
  {
    icon: TrendingUp,
    title: "Estimated Contract Value in Every Alert",
    desc: "Know whether it's a $25K micro-purchase or a $2M multi-year contract before you spend a minute on it. Filter by size, agency, and competition level.",
  },
  {
    icon: Shield,
    title: "Never Miss a Deadline",
    desc: "Opportunities are flagged 14 days out, 7 days out, and 48 hours before close. You'll never lose a bid because you found it too late.",
  },
];

const COMPARISON = [
  { tool: "GovWin IQ", price: "$1,500/mo", what: "Comprehensive but overwhelming — requires dedicated BD staff to use effectively" },
  { tool: "Bloomberg Government", price: "$2,000+/mo", what: "Enterprise-tier intel. Priced for agencies, not SMBs." },
  { tool: "BidSync / BidNet", price: "$150–500/mo", what: "Keyword match only — no AI scoring, no fit analysis, no SMS alerts" },
  { tool: "Manual SAM.gov search", price: "45 min/day", what: "Every day. Forever. Hope you didn't miss any." },
  { tool: "M2 RFP Alert Service", price: "$149/mo", what: "Daily AI-scored alerts via email + SMS. Fit analysis + full opportunity brief.", highlight: true },
];

export default function RFPAlerts() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "", servicesOffered: "", geography: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName || !form.servicesOffered) {
      toast.error("Email, business name, and services are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-rfp-alerts-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">You're in.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your service profile is being built now. First alerts arrive within 24 hours. You'll get an email when the first scan runs and how many opportunities were found in your category.
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
        title="Government RFP Alert Service — Daily Bid Alerts + AI Fit Scoring | $149/mo"
        description="Never miss a government contract. Daily AI-scored alerts from SAM.gov and 50 state portals. SMS for high-fit bids. $149/mo."
        path="/rfp-alerts"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Search size={11} /> Government Contracting
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Never Miss a Government<br /><span className="text-primary">Contract That Fits Your Business.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              SAM.gov posts thousands of opportunities daily. Most contractors check it once a week — and miss bids that were perfect for them. AI monitors it every weekday, scores every opportunity, and texts you the ones worth chasing.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$149<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-8">14-day free trial · Cancel anytime · Setup in 24 hours</p>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start Getting Alerts <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Risk callout */}
        <section className="py-10 px-4 bg-destructive/5 border-b border-border">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-destructive mb-2">What you're leaving on the table</p>
            <p className="text-base text-muted-foreground">
              The average small contractor misses <strong className="text-foreground">3-5 winnable contracts per month</strong> simply because they never saw the opportunity. At average contract values of $50K–$200K, that's real revenue walking out the door — to competitors who were watching.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get Every Day</h2>
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

        {/* How it works */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">How It Works</h2>
            <div className="space-y-6">
              {[
                { step: "01", title: "Tell us what you do", desc: "Describe your services, NAICS codes, and target geography. Takes 5 minutes." },
                { step: "02", title: "AI builds your profile", desc: "We map your services to procurement categories and set up your daily scan within 24 hours." },
                { step: "03", title: "Alerts start arriving", desc: "Email every morning with scored opportunities. SMS immediately when a high-fit bid drops." },
                { step: "04", title: "You bid. You win.", desc: "Every alert includes everything you need to decide whether to respond — in under 3 minutes." },
              ].map((s) => (
                <div key={s.step} className="flex gap-5">
                  <div className="text-4xl font-black text-primary/20 leading-none pt-0.5 w-12 shrink-0">{s.step}</div>
                  <div>
                    <h3 className="font-bold text-sm mb-1">{s.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-8 uppercase tracking-tight">Compared to Alternatives</h2>
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
          </div>
        </section>

        {/* Sign-up form */}
        <section id="signup" className="py-20 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your Free Trial</h2>
            <p className="text-sm text-muted-foreground text-center mb-8">14 days free. First alerts within 24 hours.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="email" placeholder="Email address *" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className="w-full px-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
              <input type="text" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
              <input type="text" placeholder="Business name *" value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} required className="w-full px-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
              <input type="tel" placeholder="Phone (for SMS alerts)" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
              <textarea placeholder="What services do you offer? Be specific. (e.g. commercial HVAC installation, IT staffing, janitorial services, construction management) *" value={form.servicesOffered} onChange={e => setForm(f => ({ ...f, servicesOffered: e.target.value }))} required rows={3} className="w-full px-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary resize-none" />
              <input type="text" placeholder="Target geography (e.g. Michigan, Midwest, National)" value={form.geography} onChange={e => setForm(f => ({ ...f, geography: e.target.value }))} className="w-full px-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <>Start Free Trial <ArrowRight size={14} /></>}
              </button>
              <p className="text-xs text-muted-foreground text-center">No credit card required for trial. $149/mo after 14 days.</p>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
