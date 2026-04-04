import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { CheckCircle, TrendingUp, Bell, BarChart2, Target, Zap, Building2, ShoppingCart, Briefcase } from "lucide-react";

const HOW_IT_WORKS = [
  { step: "1", title: "Add Your Competitors", body: "Enter 3–10 competitor URLs — pricing pages, product pages, service pages. Takes 2 minutes." },
  { step: "2", title: "AI Monitors Every Week", body: "Our system scrapes every URL weekly, detects content changes, and flags anything pricing-related." },
  { step: "3", title: "Get Your Report Monday Morning", body: "A clean email lands in your inbox with exactly what changed, before/after snapshots, and 3 AI recommendations." },
];

const WHO_ITS_FOR = [
  { icon: <ShoppingCart size={20} />, label: "E-commerce sellers" },
  { icon: <Briefcase size={20} />, label: "SaaS companies" },
  { icon: <Building2 size={20} />, label: "Service businesses" },
  { icon: <Target size={20} />, label: "Agencies & consultants" },
  { icon: <TrendingUp size={20} />, label: "Manufacturers & distributors" },
  { icon: <Zap size={20} />, label: "Any business with competitors online" },
];

const WINS = [
  "Know within 7 days when a competitor raises or drops prices",
  "Never get blindsided by a competitor's new pricing bundle or offer",
  "AI recommendations tailored to your pricing strategy",
  "Before/after snapshots so you can see exactly what changed",
  "Weekly digest — no noise, just changes that matter",
  "Cancel anytime — no contracts",
];

export default function CompetitorPricing() {
  const [form, setForm] = useState({
    company_name: "",
    industry: "",
    own_pricing_notes: "",
    customer_name: "",
    customer_email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_email || !form.company_name) {
      setError("Company name and email are required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/functions/v1/create-competitor-pricing-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Competitor Pricing Intelligence — Know the Moment They Change Their Price | M2 Development"
        description="AI-powered weekly competitor price monitoring. Enter 3–10 competitor URLs and get a weekly report with what changed and 3 actionable recommendations. $149/mo."
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-20 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#2563eb] mb-3">M2 Development · Competitive Intelligence</p>
          <h1 className="text-4xl font-black mb-4 leading-tight max-w-2xl mx-auto">
            Know the Moment Your Competitor<br className="hidden sm:block" /> Changes Their Price
          </h1>
          <p className="text-slate-300 text-base max-w-xl mx-auto leading-relaxed mb-8">
            Every week, AI scans your competitors' pricing pages and sends you a report with exactly what changed — plus 3 recommendations on how to respond.
          </p>
          <a
            href="#get-started"
            className="inline-block bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold px-8 py-4 text-sm transition-colors"
          >
            Start for $149/mo →
          </a>
          <p className="mt-3 text-slate-400 text-xs">No contracts. Cancel anytime.</p>
        </div>

        {/* How It Works */}
        <div className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#2563eb] mb-2">How It Works</p>
          <h2 className="text-2xl font-black text-foreground mb-10">Set up in 2 minutes. Reports every Monday.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map(h => (
              <div key={h.step} className="bg-card border border-border p-6">
                <div className="w-9 h-9 bg-[#2563eb] text-white font-black text-sm flex items-center justify-center mb-4">{h.step}</div>
                <h3 className="font-bold text-foreground mb-2">{h.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{h.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* What You Get */}
        <div className="bg-[#1e293b] text-white px-6 py-16">
          <div className="max-w-4xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#2563eb] mb-2">What You Get</p>
            <h2 className="text-2xl font-black mb-8">Everything you need to stay one step ahead</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {WINS.map(w => (
                <div key={w} className="flex items-start gap-3">
                  <CheckCircle size={16} className="text-[#2563eb] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-300 leading-relaxed">{w}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sample Report Preview */}
        <div className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#2563eb] mb-2">Sample Report</p>
          <h2 className="text-2xl font-black text-foreground mb-8">What your Monday email looks like</h2>
          <div className="border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="bg-[#1e293b] px-6 py-4 border-b-2 border-[#2563eb]">
              <p className="text-[#2563eb] text-xs font-bold uppercase tracking-widest mb-1">M2 Development · Competitor Pricing Intelligence</p>
              <p className="text-white font-bold text-lg">Weekly Pricing Report</p>
              <p className="text-slate-400 text-sm">Acme Corp · April 7, 2026</p>
            </div>
            <div className="bg-white p-6">
              <h3 className="font-bold text-slate-800 text-sm mb-4 pb-2 border-b border-slate-200">What Changed This Week</h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
                <div className="bg-[#2563eb] px-4 py-2">
                  <p className="text-white font-bold text-sm">CompetitorX.com</p>
                </div>
                <div className="p-4 bg-white">
                  <p className="text-sm text-slate-700 mb-3"><strong>What changed:</strong> Starter plan price increased from $49/mo to $69/mo. Professional plan renamed to "Growth" with new feature inclusions.</p>
                  <div className="mb-3">
                    <p className="text-xs font-bold uppercase text-slate-400 mb-1">Before</p>
                    <div className="bg-red-50 border-l-4 border-red-400 px-3 py-2 text-xs text-red-900 font-mono">Starter — $49/mo · 1 user · 5 projects</div>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400 mb-1">Now</p>
                    <div className="bg-green-50 border-l-4 border-green-400 px-3 py-2 text-xs text-green-900 font-mono">Starter — $69/mo · 1 user · 5 projects · Priority support</div>
                  </div>
                </div>
              </div>
              <h3 className="font-bold text-slate-800 text-sm mb-4 pb-2 border-b border-slate-200">AI Recommendations</h3>
              {[
                "CompetitorX raised their entry price 40% — consider a targeted campaign highlighting your comparable Starter tier at a lower price point for the next 30 days.",
                "Their rebrand to 'Growth' signals a push upmarket; reinforce your own mid-tier value proposition with a case study or testimonial campaign.",
                "With their price jump, price-sensitive prospects are now in play — update your comparison landing page to capture this new audience.",
              ].map((r, i) => (
                <div key={i} className="flex gap-3 mb-3">
                  <div className="flex-shrink-0 w-7 h-7 bg-[#2563eb] rounded-full flex items-center justify-center text-white font-bold text-xs">{i + 1}</div>
                  <p className="text-sm text-slate-700 leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Who It's For */}
        <div className="bg-slate-50 dark:bg-slate-900 px-6 py-16">
          <div className="max-w-4xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#2563eb] mb-2">Who It's For</p>
            <h2 className="text-2xl font-black text-foreground mb-8">If you have competitors online, you need this</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {WHO_ITS_FOR.map(w => (
                <div key={w.label} className="bg-card border border-border px-4 py-3 flex items-center gap-3">
                  <span className="text-[#2563eb]">{w.icon}</span>
                  <span className="text-sm font-medium text-foreground">{w.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#2563eb] mb-2">Pricing</p>
          <h2 className="text-2xl font-black text-foreground mb-4">One flat fee. No hidden costs.</h2>
          <div className="inline-block border-2 border-[#2563eb] rounded-lg px-10 py-8 bg-card shadow-sm">
            <p className="text-5xl font-black text-foreground">$149</p>
            <p className="text-muted-foreground text-sm">/month</p>
            <div className="mt-6 text-left space-y-2">
              {["3–10 competitor URLs monitored", "Weekly AI scan + change detection", "Before/after snapshots", "3 AI recommendations per report", "Monday morning email delivery", "Secure dashboard to manage URLs", "Cancel anytime"].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-[#2563eb] flex-shrink-0" />
                  <span className="text-sm text-foreground">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sign-Up Form */}
        <div id="get-started" className="bg-[#1e293b] text-white px-6 py-16">
          <div className="max-w-lg mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#2563eb] mb-2">Get Started</p>
            <h2 className="text-2xl font-black mb-2">Start Monitoring Competitors Today</h2>
            <p className="text-slate-400 text-sm mb-8">Fill in your info below. After checkout, log in to your dashboard to add competitor URLs.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Your Name</label>
                  <input
                    name="customer_name"
                    value={form.customer_name}
                    onChange={handleChange}
                    placeholder="Jane Smith"
                    className="w-full bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-[#2563eb] placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Email *</label>
                  <input
                    name="customer_email"
                    type="email"
                    required
                    value={form.customer_email}
                    onChange={handleChange}
                    placeholder="jane@company.com"
                    className="w-full bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-[#2563eb] placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Company Name *</label>
                  <input
                    name="company_name"
                    required
                    value={form.company_name}
                    onChange={handleChange}
                    placeholder="Acme Corp"
                    className="w-full bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-[#2563eb] placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Industry</label>
                  <input
                    name="industry"
                    value={form.industry}
                    onChange={handleChange}
                    placeholder="e.g. SaaS, E-commerce, HVAC"
                    className="w-full bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-[#2563eb] placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Your Current Pricing (optional)</label>
                <textarea
                  name="own_pricing_notes"
                  value={form.own_pricing_notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="e.g. We charge $99/mo for our Starter plan, $249/mo for Pro. Help us give more relevant recommendations."
                  className="w-full bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-[#2563eb] placeholder:text-slate-500 resize-none"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 text-white font-bold py-3 text-sm transition-colors"
              >
                {loading ? "Redirecting to Checkout…" : "Start for $149/mo →"}
              </button>
              <p className="text-slate-500 text-xs text-center">Secured by Stripe. Cancel anytime. You'll add competitor URLs after checkout.</p>
            </form>
          </div>
        </div>

        {/* Founder Sign-Off */}
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="bg-card border border-border p-6 flex items-start gap-5">
            <img
              src="/images/matt-family-cornfield.jpg"
              alt="Matt Michels"
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
            <div>
              <p className="font-bold text-foreground">Matt Michels</p>
              <p className="text-xs text-muted-foreground mb-3">Founder, M2 Development · Grosse Pointe, MI</p>
              <p className="text-sm text-foreground leading-relaxed">
                "I built this because I got tired of finding out a competitor changed their prices by accident — a client mentioned it, or I stumbled on it myself weeks later. Now I know the same week it happens. Questions? Text me at (313) 806-4952."
              </p>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
