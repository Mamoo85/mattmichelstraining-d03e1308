import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import {
  CheckCircle,
  Shield,
  Clock,
  FileText,
  Bell,
  AlertTriangle,
  Building2,
  Heart,
  Leaf,
  UtensilsCrossed,
  HardHat,
  Home,
  Users,
  ChevronRight,
} from "lucide-react";

const INDUSTRIES = [
  {
    value: "healthcare",
    label: "Healthcare",
    desc: "FDA, CMS, Medicare/Medicaid, drug approvals, medical devices",
    icon: Heart,
  },
  {
    value: "finance",
    label: "Finance & Banking",
    desc: "SEC, FINRA, CFPB, banking regulations, securities compliance",
    icon: Building2,
  },
  {
    value: "cannabis",
    label: "Cannabis",
    desc: "State licensing, DEA scheduling, hemp/CBD rules, banking access",
    icon: Leaf,
  },
  {
    value: "food_bev",
    label: "Food & Beverage",
    desc: "FDA food safety, USDA, nutrition labeling, restaurant health codes",
    icon: UtensilsCrossed,
  },
  {
    value: "construction",
    label: "Construction",
    desc: "OSHA safety standards, EPA environmental rules, building codes",
    icon: HardHat,
  },
  {
    value: "real_estate",
    label: "Real Estate",
    desc: "HUD fair housing, CFPB mortgage rules, rental regulations",
    icon: Home,
  },
  {
    value: "hr_employment",
    label: "HR & Employment",
    desc: "NLRB, DOL wage/overtime rules, EEOC, workplace safety",
    icon: Users,
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Tell us your industry",
    desc: "Select your industry, add any sub-topics, and optionally focus on a specific state. Takes 2 minutes.",
  },
  {
    step: "2",
    title: "We scan the Federal Register weekly",
    desc: "Every week our system pulls every new regulatory document, rule, proposed rule, and notice relevant to your industry.",
  },
  {
    step: "3",
    title: "AI translates it to plain English",
    desc: "Claude AI reads every document and writes a 3-sentence plain-English summary: what changed, why it matters, and what to do next.",
  },
  {
    step: "4",
    title: "Your Monday morning digest arrives",
    desc: "Every Monday, your inbox gets a color-coded digest grouped by impact level — HIGH, MEDIUM, LOW — with direct links to source documents.",
  },
];

const FEATURES = [
  {
    icon: FileText,
    title: "Federal Register Coverage",
    desc: "Every final rule, proposed rule, and notice published in the Federal Register — the official source for US regulatory changes.",
  },
  {
    icon: Shield,
    title: "Impact Level Scoring",
    desc: "HIGH (act now), MEDIUM (review within 30 days), LOW (informational). No more guessing what's urgent.",
  },
  {
    icon: AlertTriangle,
    title: "Plain-English Summaries",
    desc: "Our AI translates dense regulatory language into 3 sentences any business owner can understand.",
  },
  {
    icon: Bell,
    title: "Monday Morning Delivery",
    desc: "Consistent weekly cadence. Your team always knows what changed in the past 7 days before the work week starts.",
  },
  {
    icon: Clock,
    title: "Action Items Included",
    desc: "Every item includes a specific recommended action — not just 'be aware,' but 'do this within 30 days.'",
  },
  {
    icon: CheckCircle,
    title: "Direct Source Links",
    desc: "One click to the official Federal Register document. No summaries without citations.",
  },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";

export default function RegulatoryMonitor() {
  const [form, setForm] = useState({
    company_name: "",
    industry: "",
    sub_industries: "",
    state_focus: "",
    customer_name: "",
    customer_email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.customer_email || !form.industry) {
      setError("Email and industry are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-regulatory-monitor-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError(data?.error || "Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="AI Regulatory Change Monitor — Never Miss a Compliance Deadline | M² Development"
        description="Get weekly AI-generated digests of new Federal Register regulations affecting your industry. Plain-English summaries, impact scoring, and action items. $197/mo."
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <div className="bg-[#1a2744] text-white px-6 py-20 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#c9a227] mb-3">M² Development</p>
          <h1 className="text-3xl sm:text-4xl font-black mb-4 leading-tight max-w-3xl mx-auto">
            Never Be Blindsided by a<br />Regulatory Change Again
          </h1>
          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            Every Monday morning, get an AI-generated digest of new Federal Register regulations
            affecting your industry — in plain English, with impact scores and action items.
          </p>
          <div className="inline-block bg-[#c9a227]/10 border border-[#c9a227]/40 rounded px-5 py-3">
            <p className="text-[#c9a227] font-bold text-sm uppercase tracking-widest">
              $14.8 trillion in global non-compliance costs annually
            </p>
          </div>
          <div className="mt-8">
            <a
              href="#signup"
              className="inline-block bg-[#c9a227] text-[#1a2744] font-black text-sm px-8 py-4 rounded hover:bg-[#e0b83a] transition-colors"
            >
              Start Monitoring — $197/mo →
            </a>
          </div>
        </div>

        {/* Industry Cards */}
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-xl font-black text-foreground mb-2 text-center uppercase tracking-wide">
            Industries We Monitor
          </h2>
          <p className="text-muted-foreground text-center text-sm mb-10">
            Select your industry — we track the exact agencies and regulatory bodies that govern your business.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INDUSTRIES.map((ind) => {
              const Icon = ind.icon;
              return (
                <div
                  key={ind.value}
                  className="border border-border p-5 rounded bg-card hover:border-[#c9a227]/60 transition-colors cursor-pointer"
                  onClick={() => setForm((prev) => ({ ...prev, industry: ind.value }))}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-[#1a2744] rounded flex items-center justify-center flex-shrink-0">
                      <Icon size={16} className="text-[#c9a227]" />
                    </div>
                    <span className="font-bold text-sm text-foreground">{ind.label}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{ind.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-muted/30 px-6 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-foreground mb-10 text-center uppercase tracking-wide">
              How It Works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.step} className="text-center">
                  <div className="w-10 h-10 bg-[#1a2744] text-[#c9a227] font-black text-lg rounded-full flex items-center justify-center mx-auto mb-3">
                    {step.step}
                  </div>
                  <h3 className="font-bold text-sm text-foreground mb-2">{step.title}</h3>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-xl font-black text-foreground mb-10 text-center uppercase tracking-wide">
            What You Get Every Monday
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="border border-border p-5 rounded bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={16} className="text-[#c9a227] flex-shrink-0" />
                    <span className="font-bold text-sm text-foreground">{f.title}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stat Banner */}
        <div className="bg-[#1a2744] text-white px-6 py-12">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-4xl font-black text-[#c9a227] mb-3">$197<span className="text-xl text-slate-300">/mo</span></p>
            <p className="text-slate-300 text-base max-w-xl mx-auto leading-relaxed mb-6">
              One missed regulatory deadline can cost tens of thousands in fines. One compliance attorney
              costs $300–$600/hour just to stay informed. This monitor pays for itself the first time it
              catches a change you would have missed.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              {["Weekly Federal Register digest", "AI plain-English summaries", "Impact scoring (HIGH/MEDIUM/LOW)", "Direct source links", "Cancel anytime"].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-[#c9a227]" />
                  <span className="text-slate-200">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Signup Form */}
        <div id="signup" className="max-w-xl mx-auto px-6 py-16">
          <h2 className="text-xl font-black text-foreground mb-2 text-center">Start Monitoring Your Industry</h2>
          <p className="text-muted-foreground text-center text-sm mb-8">
            $197/mo · Cancel anytime · First digest within 7 days
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Company Name
              </label>
              <input
                type="text"
                name="company_name"
                value={form.company_name}
                onChange={handleChange}
                placeholder="Acme Healthcare LLC"
                className="w-full border border-border rounded px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:border-[#c9a227]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Industry <span className="text-red-500">*</span>
              </label>
              <select
                name="industry"
                value={form.industry}
                onChange={handleChange}
                required
                className="w-full border border-border rounded px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:border-[#c9a227]"
              >
                <option value="">Select your industry…</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind.value} value={ind.value}>
                    {ind.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Sub-Industries / Specific Topics (optional)
              </label>
              <textarea
                name="sub_industries"
                value={form.sub_industries}
                onChange={handleChange}
                rows={2}
                placeholder="e.g., telehealth, clinical trials, pharmacy benefits"
                className="w-full border border-border rounded px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:border-[#c9a227] resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                State Focus (optional)
              </label>
              <input
                type="text"
                name="state_focus"
                value={form.state_focus}
                onChange={handleChange}
                placeholder="e.g., Michigan, California, or National"
                className="w-full border border-border rounded px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:border-[#c9a227]"
              />
            </div>

            <div className="border-t border-border pt-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Your Name
              </label>
              <input
                type="text"
                name="customer_name"
                value={form.customer_name}
                onChange={handleChange}
                placeholder="Jane Smith"
                className="w-full border border-border rounded px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:border-[#c9a227]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="customer_email"
                value={form.customer_email}
                onChange={handleChange}
                required
                placeholder="jane@acmehealthcare.com"
                className="w-full border border-border rounded px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:border-[#c9a227]"
              />
            </div>

            {error && (
              <div className="bg-red-950/20 border border-red-900/30 rounded p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#c9a227] text-[#1a2744] font-black text-sm py-4 rounded hover:bg-[#e0b83a] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                "Redirecting to checkout…"
              ) : (
                <>
                  Start Monitoring — $197/mo <ChevronRight size={16} />
                </>
              )}
            </button>

            <p className="text-center text-[11px] text-muted-foreground">
              Secured by Stripe · Cancel anytime · No contracts
            </p>
          </form>
        </div>

        {/* Footer trust */}
        <div className="border-t border-border py-10 px-6">
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-5">
            <img
              src="/images/matt-boat.jpg"
              alt="Matt Michels"
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
            <div>
              <p className="font-bold text-sm text-foreground mb-1">Matt Michels · M² Development</p>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                "Business owners shouldn't need a law degree to stay compliant. This monitor
                does the reading so you can focus on running your business." — Grosse Pointe, MI · (313) 806-4952
              </p>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
