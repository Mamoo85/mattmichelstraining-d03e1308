import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, TrendingDown, Bell, BarChart2, Search, AlertTriangle, Target } from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Daily Competitor Price Scraping",
    desc: "AI visits your competitors' pricing pages, product catalogs, and landing pages every single day. No browser extension required. No manual checking.",
  },
  {
    icon: Bell,
    title: "Instant SMS + Email Alerts",
    desc: "The moment a competitor changes a price — up or down — you get a text and an email. Know before your sales team takes their next call.",
  },
  {
    icon: BarChart2,
    title: "Historical Price Charts",
    desc: "See how competitor pricing has moved over weeks and months. Spot seasonal patterns. Identify who's discounting to hit quota and when.",
  },
  {
    icon: Target,
    title: "Weekly Strategic Intelligence Report",
    desc: "Every Monday: a plain-English summary of everything that changed, what it means, and a specific strategic recommendation — e.g., 'Competitor X dropped 12% on their flagship SKU. You're now priced competitively. Consider a targeted campaign.'",
  },
  {
    icon: TrendingDown,
    title: "Price Change Context",
    desc: "Not just 'they changed a price' — AI analyzes whether it's a sale, a permanent cut, a new tier, or a product discontinuation. You get context, not noise.",
  },
  {
    icon: AlertTriangle,
    title: "Competitive Gap Analysis",
    desc: "Monthly report on where you're overpriced, where you're leaving margin on the table, and which segments are most at risk from competitor pricing pressure.",
  },
];

const COMPARISON = [
  { tool: "Wiser", price: "$500+/mo", what: "Retail-focused price intelligence — enterprise only" },
  { tool: "Prisync", price: "$99–299/mo", what: "Price tracking, no AI analysis or strategic recommendations" },
  { tool: "Price2Spy", price: "$19–99/mo", what: "Basic scraping only — no alerts, no AI, no strategy" },
  { tool: "Manual monitoring", price: "Hours/week", what: "Someone on your team visits competitor sites — inconsistent, incomplete, and distracting" },
  { tool: "M2 Price Intelligence", price: "$199/mo", what: "Daily scraping + instant alerts + AI strategic recommendations — 14-day trial", highlight: true },
];

const SCENARIOS = [
  { title: "Your competitor drops price 15%", outcome: "You know within hours. Your sales team has a response ready before the next call." },
  { title: "A competitor launches a new pricing tier", outcome: "You see it the day it goes live. You can adjust positioning before prospects start comparing." },
  { title: "End-of-quarter discounting patterns", outcome: "Historical charts show your competitors slash prices every March and September. You plan accordingly." },
];

export default function PriceIntelligence() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "", competitorUrls: "" });
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
      const { data, error } = await supabase.functions.invoke("create-price-intelligence-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">Monitoring starts now.</h1>
        <p className="text-muted-foreground">Matt will confirm your competitor list and kick off the first scrape within 24 hours. Expect your first intelligence report by end of this week.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Competitor Price Intelligence — Daily Monitoring + AI Alerts | $199/mo"
        description="AI monitors your competitor pricing pages daily. Instant SMS alert on any price change. Weekly strategic recommendations. 14-day free trial."
        path="/price-intelligence"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-24 pb-20 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <TrendingDown size={11} /> Price Intelligence
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-tight mb-6">
              Know Every Time a Competitor<br />
              <span className="text-primary">Changes Their Price.</span><br />
              Before Your Customers Do.
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
              Right now, your competitors could be running a promotion, launching a new tier, or quietly cutting prices to steal your accounts — and you have no idea.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              M2 monitors their pricing pages every day. The instant something changes, you get an alert. Every week, you get a strategic briefing on what it means and what to do.
            </p>
            <div className="flex flex-col items-center gap-2 mb-10">
              <div className="text-5xl font-black text-primary">$199<span className="text-2xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground">14-day free trial · No contracts · Cancel anytime</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start 14-Day Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Scenarios */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What This Looks Like in Practice</h2>
            <div className="space-y-4">
              {SCENARIOS.map((s) => (
                <div key={s.title} className="flex gap-4 p-5 border border-border rounded-lg">
                  <AlertTriangle size={18} className="text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm mb-1">{s.title}</p>
                    <p className="text-sm text-muted-foreground">{s.outcome}</p>
                  </div>
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
            <p className="text-center text-muted-foreground text-sm mb-8">Most tools just scrape prices. None of them tell you what to do about it.</p>
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
              Add your competitors below. We'll have your first intelligence report ready within 48 hours.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business Name *", placeholder: "Acme Corp" },
                { key: "name", label: "Your Name *", placeholder: "John Smith" },
                { key: "email", label: "Work Email *", placeholder: "john@acmecorp.com", type: "email" },
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
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                  Competitor Website URLs *
                </label>
                <textarea
                  value={form.competitorUrls}
                  onChange={(e) => setForm((p) => ({ ...p, competitorUrls: e.target.value }))}
                  placeholder={"https://competitor1.com\nhttps://competitor2.com/pricing\nhttps://competitor3.com/products"}
                  rows={4}
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm resize-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Competitor website URLs, one per line — we'll track product pages, pricing pages, and catalogs</p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3.5 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded-sm transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                {loading ? "Redirecting…" : "Start Monitoring Competitors — $199/mo"}
              </button>
              <p className="text-center text-xs text-muted-foreground pt-1">14-day free trial · No credit card required to start · Cancel anytime</p>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
