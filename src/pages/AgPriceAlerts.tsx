import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, TrendingUp, Bell, AlertTriangle, BarChart2, Sun, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Bell,
    title: "Price Target SMS Alert",
    desc: "Set your number. Corn above $5.20, soybeans below $13.00 — the moment CME futures or USDA cash prices cross your threshold, your phone buzzes. Not a daily digest. An alert.",
  },
  {
    icon: TrendingUp,
    title: "CME Futures + USDA Cash + Basis",
    desc: "Three data layers in one view. Futures tell you the direction. Cash prices tell you what elevators are actually paying. Basis tells you whether your local market is strong or weak.",
  },
  {
    icon: Sun,
    title: "AI Morning Market Brief",
    desc: "Every morning before markets open: weather impact on the crop, overnight export demand news, USDA report summary if applicable, and a plain-English take on the day ahead.",
  },
  {
    icon: BarChart2,
    title: "Weekly Market Outlook Email",
    desc: "Sunday evening: the week's price action, key upcoming USDA reports, analyst consensus, and what to watch. Helps you decide whether to sell, store, or wait.",
  },
  {
    icon: AlertTriangle,
    title: "USDA Report Day Alerts",
    desc: "WASDE, Crop Progress, Grain Stocks — get an SMS the moment the report drops with a 2-sentence AI summary of what it means for your commodities.",
  },
  {
    icon: CheckCircle,
    title: "Unlimited Commodities + Targets",
    desc: "Set as many price alerts as you need across corn, soybeans, wheat, cattle, hogs, cotton — any CME-listed commodity. Change targets anytime by replying to a text.",
  },
];

const COMPARISON = [
  { tool: "DTN / Progressive Farmer", price: "$600–2,400/yr", what: "Professional ag data — complex interface, desktop-first", highlight: false },
  { tool: "Barchart", price: "$99/mo", what: "Market data platform — not built for farmer price targeting", highlight: false },
  { tool: "Bloomberg Terminal", price: "$27,000/yr", what: "Institutional finance tool — overkill, not ag-specific", highlight: false },
  { tool: "Farm advisor / broker", price: "$200–500/hr", what: "Human expertise — available during business hours only", highlight: false },
  { tool: "M² Ag Price Alerts", price: "$79/mo", what: "SMS price targets + AI morning brief + USDA alerts", highlight: true },
];

export default function AgPriceAlerts() {
  const [form, setForm] = useState({
    email: "", name: "", businessName: "", phone: "",
    commodities: "", alertThresholds: "",
  });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.name) { toast.error("Name and email are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-ag-price-alerts-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">Alerts are active.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your price targets are set. The moment a commodity crosses your threshold, you'll get a text. Your first morning brief arrives tomorrow before markets open.
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
        title="Agricultural Price Alert System — SMS When Your Commodity Hits Your Target | $79/mo"
        description="Set your price targets for corn, soybeans, wheat, cattle. Get an SMS the moment CME or USDA prices cross your number. AI morning market brief daily. $79/mo. 14-day trial."
        path="/ag-price-alerts"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-24 pb-20 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Bell size={11} /> Ag Price Alerts
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-6">
              Text alert when your corn hits $5.20.<br />
              <span className="text-primary">Morning market brief every day.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
              You shouldn't need a Bloomberg Terminal to know when to sell. Set your price targets once — CME futures, USDA cash prices, and basis levels all monitored. You get a text when the number matters.
            </p>
            <div className="mb-10">
              <div className="text-5xl font-black text-primary">$79<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground mt-1">14-day free trial · No contracts · Cancel anytime</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Set My Price Targets <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Data sources strip */}
        <section className="py-8 px-4 border-b border-border bg-card">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <span>CME Group Futures</span>
            <span className="text-border">|</span>
            <span>USDA Cash Prices</span>
            <span className="text-border">|</span>
            <span>Basis Levels</span>
            <span className="text-border">|</span>
            <span>USDA Report Alerts</span>
            <span className="text-border">|</span>
            <span>Daily AI Brief</span>
          </div>
        </section>

        {/* Scenario */}
        <section className="py-20 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">How It Works</p>
              <h2 className="text-2xl sm:text-3xl font-black">Simple. Powerful. No dashboard required.</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { n: "01", title: "Set Your Targets", desc: "Tell us your commodities and the exact price levels that matter to you — corn above $5.20, beans below $13, whatever your marketing plan calls for." },
                { n: "02", title: "We Watch the Markets", desc: "CME futures and USDA cash prices are monitored continuously. Basis levels updated daily. USDA report days flagged automatically." },
                { n: "03", title: "You Get the Text", desc: "The moment your number is hit, your phone buzzes with the commodity, current price, your target, and a one-line market context note." },
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
              <h2 className="text-2xl sm:text-3xl font-black">Professional ag intelligence. Without the complexity.</h2>
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
              <h2 className="text-2xl sm:text-3xl font-black">What market intelligence actually costs.</h2>
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
              <p className="text-muted-foreground text-sm">$79/mo after trial. Set as many price targets as you need. Cancel anytime.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "name", label: "Your Name *", placeholder: "Dave Hendricks", type: "text" },
                { key: "businessName", label: "Farm / Operation Name", placeholder: "Hendricks Family Farms", type: "text" },
                { key: "email", label: "Email Address *", placeholder: "dave@hendricksfarms.com", type: "email" },
                { key: "phone", label: "Mobile Phone (for SMS alerts) *", placeholder: "(313) 555-0100", type: "tel" },
                { key: "commodities", label: "Commodities You Trade *", placeholder: "Corn, soybeans, wheat", type: "text" },
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
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Price Alert Targets</label>
                <textarea
                  value={form.alertThresholds}
                  onChange={e => setForm(p => ({ ...p, alertThresholds: e.target.value }))}
                  placeholder={"One per line:\nCorn above $5.20/bu\nSoybeans below $13.00/bu\nWheat above $6.50/bu"}
                  rows={4}
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3.5 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-4 transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Redirecting…" : "Set My Price Alerts — $79/mo After Trial"}
              </button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-4">Secure checkout via Stripe. No card charged for 14 days.</p>
          </div>
        </section>

      </div>
    </>
  );
}
