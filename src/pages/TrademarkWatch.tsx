import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { Shield, AlertTriangle, Clock, CheckCircle, Search, Scale, Bell, ChevronRight } from "lucide-react";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Submit Your Mark",
    desc: "Tell us your trademark, goods & services, and Nice classification. Takes 2 minutes.",
  },
  {
    step: "02",
    title: "AI Monitors USPTO Weekly",
    desc: "Every week, our AI scans all newly published USPTO applications for marks that could conflict with yours.",
  },
  {
    step: "03",
    title: "Get Your Similarity Report",
    desc: "We email you every Sunday with a scored report. Each finding gets a 0–100 conflict score and an action recommendation.",
  },
  {
    step: "04",
    title: "Act Before the Window Closes",
    desc: "Oppose threats, monitor edge cases, or ignore low-risk marks — with our guidance on exactly what to do.",
  },
];

const WHO_NEEDS = [
  "Brand owners who can't afford a $500/hr trademark attorney on retainer",
  "Startups and small businesses that just registered their trademark",
  "E-commerce sellers protecting product brand names",
  "Franchises monitoring for copycats in new markets",
  "Law firms that want automated watching for their clients",
  "Anyone who built a brand and needs to protect it",
];

const NICE_CLASSES = [
  "Class 9 — Software, electronics",
  "Class 25 — Clothing, apparel",
  "Class 35 — Business services",
  "Class 36 — Financial services",
  "Class 41 — Education, entertainment",
  "Class 42 — Technology services",
  "Class 43 — Restaurants, food",
  "Class 44 — Medical, health",
  "Other / Multiple classes",
];

export default function TrademarkWatch() {
  const [form, setForm] = useState({
    company_name: "",
    mark_text: "",
    goods_services: "",
    nice_classes: "",
    customer_name: "",
    customer_email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.customer_email || !form.mark_text) {
      setError("Email and trademark name are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-trademark-watch-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
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
        title="AI Trademark Watch Service — Monitor USPTO for Copycats | M2 Development"
        description="AI monitors USPTO weekly for newly filed marks that could infringe your trademark. Get similarity scores, opposition recommendations, and never miss the 30-day window. $49/mo per mark."
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <div className="bg-[#0f2547] text-white px-6 py-20 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#c9a227] mb-3">M2 Development · AI Legal Tools</p>
          <h1 className="text-4xl font-black mb-4 leading-tight max-w-3xl mx-auto">
            Protect Your Brand Before<br />Someone Steals It
          </h1>
          <p className="text-slate-300 text-base max-w-xl mx-auto leading-relaxed mb-8">
            Every week, AI monitors the USPTO for newly filed marks that look like yours — and tells you exactly whether to oppose, monitor, or ignore them.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
            <span className="flex items-center gap-2"><CheckCircle size={14} className="text-[#c9a227]" /> 500,000+ trademark applications filed annually</span>
            <span className="flex items-center gap-2"><AlertTriangle size={14} className="text-[#c9a227]" /> 30-day opposition window — miss it and lose forever</span>
            <span className="flex items-center gap-2"><Shield size={14} className="text-[#c9a227]" /> $49/mo per mark</span>
          </div>
        </div>

        {/* Pain Banner */}
        <div className="bg-red-950 border-y border-red-900 px-6 py-8 text-center">
          <p className="text-red-300 font-black text-lg max-w-2xl mx-auto">
            The USPTO publishes thousands of new applications every week. If someone files a mark confusingly similar to yours,<br />
            <span className="text-white">you have exactly 30 days to oppose it.</span>
          </p>
          <p className="text-red-400 text-sm mt-3 max-w-xl mx-auto">
            After that window closes, your options are a federal lawsuit — or watching a copycat dilute your brand for years. Most brand owners never know until it's too late.
          </p>
        </div>

        {/* Stats */}
        <div className="max-w-4xl mx-auto px-6 py-14 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { num: "500K+", label: "Applications filed annually" },
            { num: "30", label: "Days to oppose — hard deadline" },
            { num: "0–100", label: "AI similarity score per filing" },
            { num: "$49/mo", label: "Per mark, cancel anytime" },
          ].map((s) => (
            <div key={s.label} className="bg-[#0f2547]/5 border border-[#0f2547]/10 p-5 rounded-lg">
              <p className="text-3xl font-black text-[#0f2547] mb-1">{s.num}</p>
              <p className="text-xs text-muted-foreground leading-snug">{s.label}</p>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div className="bg-[#0f2547] text-white px-6 py-16">
          <div className="max-w-4xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#c9a227] mb-2 text-center">How It Works</p>
            <h2 className="text-2xl font-black mb-10 text-center">Set it up in 2 minutes. AI does the rest.</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {HOW_IT_WORKS.map((h) => (
                <div key={h.step} className="bg-white/5 border border-white/10 p-6 rounded-lg">
                  <p className="text-[#c9a227] font-black text-3xl mb-3">{h.step}</p>
                  <h3 className="font-bold text-base mb-2">{h.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{h.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* What You Get */}
        <div className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#0f2547] mb-2">What You Get Every Week</p>
          <h2 className="text-2xl font-black mb-8 text-foreground">A legal-grade report without the legal-grade bill</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: <Search size={20} className="text-[#c9a227]" />, title: "USPTO Scan", desc: "Every new application filed in your trademark class, checked against your mark using DuPont factor analysis." },
              { icon: <Scale size={20} className="text-[#c9a227]" />, title: "0–100 Similarity Score", desc: "Color-coded: red = oppose (70+), yellow = monitor (40–69), green = ignore (<40). No ambiguity." },
              { icon: <Bell size={20} className="text-[#c9a227]" />, title: "Oppose / Monitor / Ignore", desc: "Specific action recommendation for each finding, with a 2-sentence AI analysis explaining the risk." },
            ].map((item) => (
              <div key={item.title} className="border border-border p-6 rounded-lg">
                <div className="mb-3">{item.icon}</div>
                <h3 className="font-bold text-sm mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Who Needs It */}
        <div className="bg-slate-50 dark:bg-slate-900/30 px-6 py-14">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black mb-6 text-foreground text-center">Who needs this</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {WHO_NEEDS.map((w) => (
                <div key={w} className="flex items-start gap-3 bg-white dark:bg-slate-800 border border-border p-4 rounded-lg">
                  <ChevronRight size={14} className="text-[#c9a227] mt-1 flex-shrink-0" />
                  <p className="text-sm text-foreground">{w}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#0f2547] mb-2">Pricing</p>
          <h2 className="text-3xl font-black mb-2 text-foreground">$49/month per mark</h2>
          <p className="text-muted-foreground text-sm mb-6">Cancel anytime. No contracts. Watch as many marks as you need.</p>
          <div className="bg-[#0f2547]/5 border border-[#0f2547]/20 rounded-xl p-6 text-left mb-8">
            {[
              "Weekly USPTO scan for newly filed similar marks",
              "AI similarity score (0–100) per finding",
              "Oppose / Monitor / Ignore recommendation",
              "2-sentence AI analysis per finding",
              "Emailed every Sunday morning",
              "Dashboard to view all findings",
              "Cancel anytime",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3 mb-3">
                <CheckCircle size={15} className="text-green-600 flex-shrink-0" />
                <span className="text-sm text-foreground">{f}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Compare: trademark watch services from law firms run $200–$500/month. Ours uses the same USPTO data with AI scoring for $49.
          </p>
        </div>

        {/* Signup Form */}
        <div className="bg-[#0f2547] text-white px-6 py-16" id="signup">
          <div className="max-w-lg mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#c9a227] mb-2 text-center">Start Watching</p>
            <h2 className="text-2xl font-black mb-2 text-center">Protect your mark for $49/mo</h2>
            <p className="text-slate-400 text-sm mb-8 text-center">Enter your trademark details below and we'll start monitoring this week.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-300">Company / Brand Name</label>
                <input
                  type="text"
                  name="company_name"
                  value={form.company_name}
                  onChange={handleChange}
                  placeholder="Acme Corp"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#c9a227] text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-300">Trademark Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  name="mark_text"
                  value={form.mark_text}
                  onChange={handleChange}
                  placeholder="ACME WIDGETS"
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#c9a227] text-sm"
                />
                <p className="text-slate-500 text-xs mt-1">Enter the exact mark text as registered or applied for</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-300">Goods & Services Description</label>
                <textarea
                  name="goods_services"
                  value={form.goods_services}
                  onChange={handleChange}
                  placeholder="e.g., Online software for project management; SaaS tools for small businesses"
                  rows={3}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#c9a227] text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-300">Nice Classification (Optional)</label>
                <select
                  name="nice_classes"
                  value={form.nice_classes}
                  onChange={handleChange}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#c9a227] text-sm"
                >
                  <option value="">Select a class...</option>
                  {NICE_CLASSES.map((c) => (
                    <option key={c} value={c} className="bg-[#0f2547]">{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-slate-300">Your Name</label>
                  <input
                    type="text"
                    name="customer_name"
                    value={form.customer_name}
                    onChange={handleChange}
                    placeholder="Jane Smith"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#c9a227] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-slate-300">Email <span className="text-red-400">*</span></label>
                  <input
                    type="email"
                    name="customer_email"
                    value={form.customer_email}
                    onChange={handleChange}
                    placeholder="jane@acme.com"
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#c9a227] text-sm"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg px-4 py-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#c9a227] hover:bg-[#b8911f] text-[#0f2547] font-black py-4 rounded-lg text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Redirecting to checkout..." : "Start Watching My Mark — $49/mo"}
              </button>

              <p className="text-center text-slate-500 text-xs">
                Secured by Stripe. Cancel anytime. No contracts.
              </p>
            </form>
          </div>
        </div>

        {/* Footer note */}
        <div className="px-6 py-8 text-center">
          <p className="text-xs text-muted-foreground max-w-xl mx-auto">
            <strong>Disclaimer:</strong> AI Trademark Watch is an informational monitoring service and does not constitute legal advice. Always consult a licensed trademark attorney before filing an opposition or making legal decisions about your trademark rights.
          </p>
        </div>

      </div>
    </>
  );
}
