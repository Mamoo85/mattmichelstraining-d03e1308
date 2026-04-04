import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { CheckCircle, Shield, Clock, FileText, Target, Bell, ExternalLink, ChevronRight } from "lucide-react";

const SET_ASIDE_OPTIONS = [
  { value: "SBA", label: "Small Business (SBA)" },
  { value: "SDVOSB", label: "Service-Disabled Veteran-Owned (SDVOSB)" },
  { value: "8(a)", label: "8(a) Business Development" },
  { value: "HUBZone", label: "HUBZone" },
  { value: "WOSB", label: "Women-Owned Small Business (WOSB)" },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Tell us your profile",
    desc: "Enter your NAICS codes, keywords, and set-aside certifications. Takes 2 minutes.",
  },
  {
    step: "2",
    title: "We scan SAM.gov daily",
    desc: "Our system pulls every new federal contract opportunity matching your filters — every single day.",
  },
  {
    step: "3",
    title: "AI scores and recommends",
    desc: "Each opportunity gets an AI match score (0–100) and a Bid / Review / No-Bid recommendation with a 2-sentence summary.",
  },
];

const FEATURES = [
  { icon: Target, title: "NAICS Code Matching", desc: "Exact NAICS code filtering so you only see contracts in your industry." },
  { icon: Shield, title: "Set-Aside Filtering", desc: "Small Business, SDVOSB, 8(a), HUBZone, WOSB — we filter to what you qualify for." },
  { icon: Target, title: "AI Match Scoring", desc: "Claude AI scores every opportunity 0–100 based on your capabilities and certifications." },
  { icon: Bell, title: "72-Hour Deadline Alerts", desc: "Separate urgent email when any matched opportunity closes within 3 days." },
  { icon: FileText, title: "SAM.gov Direct Links", desc: "One click to the official solicitation on SAM.gov — no middleman." },
  { icon: Clock, title: "Daily Digest Emails", desc: "Every morning, your inbox gets all opportunities scored 50+ for the prior day." },
];

export default function GovContractMonitor() {
  const [form, setForm] = useState({
    company_name: "",
    naics_codes: "",
    keywords: "",
    set_aside_types: [] as string[],
    min_contract_value: "",
    max_contract_value: "",
    customer_name: "",
    customer_email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleSetAside = (val: string) => {
    setForm((prev) => ({
      ...prev,
      set_aside_types: prev.set_aside_types.includes(val)
        ? prev.set_aside_types.filter((v) => v !== val)
        : [...prev.set_aside_types, val],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.customer_email || !form.company_name) {
      setError("Company name and email are required.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        set_aside_types: form.set_aside_types.join(", "),
        min_contract_value: form.min_contract_value ? parseInt(form.min_contract_value.replace(/\D/g, "")) : undefined,
        max_contract_value: form.max_contract_value ? parseInt(form.max_contract_value.replace(/\D/g, "")) : undefined,
      };
      const res = await fetch("/functions/v1/create-gov-contract-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        title="Government Contract Opportunity Monitor — AI-Powered SAM.gov Alerts | M2 Development"
        description="Never miss a federal contract again. AI-scored SAM.gov opportunities delivered daily, matched to your NAICS codes and set-aside certifications. $299/mo."
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <div className="bg-[#1e3a5f] text-white px-6 py-20 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}></div>
          <div className="relative max-w-3xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#c59b2b] mb-3">M2 Development — Federal Intelligence</p>
            <h1 className="text-3xl sm:text-4xl font-black mb-5 leading-tight">
              Never Miss a Federal Contract Again
            </h1>
            <p className="text-slate-300 text-base max-w-2xl mx-auto leading-relaxed mb-6">
              The federal government awards <strong className="text-white">$700 billion+</strong> in contracts every year. Most small businesses miss 90% of the opportunities because they don't have time to watch SAM.gov every day. We do it for them.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <a href="#signup" className="bg-[#c59b2b] text-[#1e3a5f] px-7 py-3 font-black text-sm hover:bg-yellow-400 transition-all inline-flex items-center gap-2">
                Start Monitoring <ChevronRight size={14} />
              </a>
              <a href="tel:+13138064952" className="border border-white/30 text-white px-7 py-3 font-bold text-sm hover:bg-white/10 transition-all">
                (313) 806-4952
              </a>
            </div>
          </div>
        </div>

        {/* Stat bar */}
        <div className="bg-[#c59b2b] px-6 py-4">
          <div className="max-w-4xl mx-auto flex flex-wrap gap-6 justify-center text-center">
            {[
              { num: "$700B+", label: "Federal contracts awarded annually" },
              { num: "23%", label: "Reserved for small businesses by law" },
              { num: "50+", label: "New SAM.gov opportunities posted daily" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[#1e3a5f] font-black text-xl">{s.num}</p>
                <p className="text-[#1e3a5f] text-xs font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-14">

          {/* How It Works */}
          <h2 className="text-xl font-black text-foreground mb-2 uppercase tracking-wide text-center">How It Works</h2>
          <p className="text-muted-foreground text-sm text-center mb-8">Three steps. No BD rep required.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-14">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="bg-card border border-border p-5">
                <div className="w-8 h-8 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center font-black text-sm mb-3">{step.step}</div>
                <h3 className="font-bold text-foreground text-sm mb-1">{step.title}</h3>
                <p className="text-muted-foreground text-[13px] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Features */}
          <h2 className="text-xl font-black text-foreground mb-8 uppercase tracking-wide text-center">What You Get</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-14">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3 p-4 bg-card border border-border">
                <f.icon size={18} className="text-[#c59b2b] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-foreground text-sm">{f.title}</p>
                  <p className="text-muted-foreground text-[12px] mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="bg-[#1e3a5f] text-white p-7 mb-14">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <p className="text-[#c59b2b] text-[11px] font-bold uppercase tracking-widest mb-1">Simple Pricing</p>
                <h2 className="text-3xl font-black mb-1">$299<span className="text-lg font-medium text-slate-300">/month</span></h2>
                <p className="text-slate-300 text-sm">Cancel anytime. No contracts. No per-opportunity fees.</p>
              </div>
              <div className="space-y-2">
                {[
                  "BD representative costs $80,000+/year",
                  "SAM.gov consultant: $5,000–$15,000/year",
                  "Govwin / Deltek: $10,000+/year",
                  "Our monitor: $3,588/year",
                ].map((line, i) => (
                  <div key={line} className="flex items-center gap-2">
                    {i < 3
                      ? <span className="text-red-400 text-sm font-bold">✗</span>
                      : <CheckCircle size={14} className="text-[#c59b2b]" />}
                    <span className={`text-sm ${i < 3 ? "text-slate-400 line-through" : "text-white font-bold"}`}>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Founder block */}
          <div className="bg-card border border-border p-5 flex items-start gap-4 mb-14">
            <img
              src="/images/matt-family-cornfield.jpg"
              alt="Matt Michels"
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
            <p className="text-sm text-foreground leading-relaxed">
              <strong>I'm Matt Michels — Grosse Pointe, MI.</strong>{" "}
              I built this because small businesses doing great federal work were getting locked out by the sheer volume of SAM.gov notices. A big defense contractor has a full BD team. You have a business to run. This levels the playing field — for $299/month.
            </p>
          </div>

          {/* Signup Form */}
          <div id="signup" className="bg-[#1e3a5f] p-7 scroll-mt-8">
            <p className="text-[#c59b2b] text-[11px] font-bold uppercase tracking-widest mb-1">Get Started</p>
            <h2 className="text-white text-2xl font-black mb-2">Start Monitoring Federal Contracts</h2>
            <p className="text-slate-300 text-sm mb-6">Complete checkout and your first scan runs within minutes.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-300 mb-1">Company Name *</label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
                    placeholder="Acme Defense LLC"
                    required
                    className="w-full bg-[#0f2340] border border-slate-600 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#c59b2b]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-300 mb-1">Your Name *</label>
                  <input
                    type="text"
                    value={form.customer_name}
                    onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full bg-[#0f2340] border border-slate-600 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#c59b2b]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => setForm((p) => ({ ...p, customer_email: e.target.value }))}
                  placeholder="jane@acmedefense.com"
                  required
                  className="w-full bg-[#0f2340] border border-slate-600 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#c59b2b]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-300 mb-1">NAICS Codes</label>
                <input
                  type="text"
                  value={form.naics_codes}
                  onChange={(e) => setForm((p) => ({ ...p, naics_codes: e.target.value }))}
                  placeholder="541330, 541519, 332999"
                  className="w-full bg-[#0f2340] border border-slate-600 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#c59b2b]"
                />
                <p className="text-slate-400 text-[11px] mt-1">Comma-separated. Find yours at <a href="https://www.census.gov/naics/" target="_blank" rel="noopener noreferrer" className="text-[#c59b2b] inline-flex items-center gap-0.5">census.gov/naics <ExternalLink size={10} /></a></p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-300 mb-1">Keywords / Capabilities</label>
                <input
                  type="text"
                  value={form.keywords}
                  onChange={(e) => setForm((p) => ({ ...p, keywords: e.target.value }))}
                  placeholder="cybersecurity, network infrastructure, cloud migration"
                  className="w-full bg-[#0f2340] border border-slate-600 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#c59b2b]"
                />
                <p className="text-slate-400 text-[11px] mt-1">Comma-separated. What does your company actually do?</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-300 mb-2">Set-Aside Types You Qualify For</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SET_ASIDE_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={form.set_aside_types.includes(opt.value)}
                        onChange={() => toggleSetAside(opt.value)}
                        className="w-4 h-4 accent-[#c59b2b]"
                      />
                      <span className="text-slate-300 text-sm group-hover:text-white transition-colors">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-300 mb-1">Min Contract Value (optional)</label>
                  <input
                    type="text"
                    value={form.min_contract_value}
                    onChange={(e) => setForm((p) => ({ ...p, min_contract_value: e.target.value }))}
                    placeholder="$100,000"
                    className="w-full bg-[#0f2340] border border-slate-600 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#c59b2b]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-300 mb-1">Max Contract Value (optional)</label>
                  <input
                    type="text"
                    value={form.max_contract_value}
                    onChange={(e) => setForm((p) => ({ ...p, max_contract_value: e.target.value }))}
                    placeholder="$5,000,000"
                    className="w-full bg-[#0f2340] border border-slate-600 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#c59b2b]"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#c59b2b] text-[#1e3a5f] py-3.5 font-black text-sm hover:bg-yellow-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Redirecting to checkout..." : "Start Monitoring — $299/month →"}
              </button>

              <p className="text-slate-400 text-[11px] text-center">
                Secure checkout via Stripe. Cancel anytime. No long-term contracts.
              </p>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
