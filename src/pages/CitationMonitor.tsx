import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, MapPin, Search, AlertTriangle, Shield, BarChart2, Building2 } from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "30+ Directory Monitoring",
    desc: "Google Business Profile, Yelp, Facebook, Apple Maps, Bing Places, TripAdvisor, Foursquare, and 25+ more. Every place a customer might look up your address or phone number.",
  },
  {
    icon: AlertTriangle,
    title: "NAP Inconsistency Detection",
    desc: "Name, Address, Phone — if any variation exists across directories, we find it. Even subtle differences like 'St.' vs 'Street' or missing suite numbers that tank your local rankings.",
  },
  {
    icon: MapPin,
    title: "Per-Location Breakdowns",
    desc: "Run 50 locations? Every location gets its own status report. See which ones are clean and which ones have inconsistencies dragging down their local search performance.",
  },
  {
    icon: BarChart2,
    title: "Weekly Health Report",
    desc: "Every week: a clean dashboard showing citation health score per location, all inconsistencies found, and step-by-step instructions for fixing each one.",
  },
  {
    icon: Shield,
    title: "New Listing Alerts",
    desc: "When a new directory lists your business (often with wrong info scraped from an old source), you're alerted immediately before it spreads and starts hurting your SEO.",
  },
  {
    icon: Building2,
    title: "Competitor Citation Audit",
    desc: "See how your citation health compares to your top local competitors. Know exactly why they rank above you in the map pack — and what to fix first.",
  },
];

const COMPARISON = [
  { tool: "Yext", price: "$500+/mo", what: "Syncs listings across directories — expensive, ongoing dependency" },
  { tool: "Marketing Agency", price: "$500–2,000/mo", what: "Manual citation building and cleanup — high cost, slow turnaround" },
  { tool: "BrightLocal", price: "$29–79/mo", what: "Reports only — no AI analysis, no strategic guidance" },
  { tool: "Moz Local", price: "$129/yr", what: "Limited coverage, no multi-location intelligence" },
  { tool: "M2 Citation Monitor", price: "$99/mo", what: "AI monitoring across 30+ directories + per-location reports — 14-day trial", highlight: true },
];

const NAP_EXAMPLES = [
  { wrong: "Smith's HVAC, 123 Main St, Detroit MI 48201", right: "Smith's HVAC LLC, 123 Main Street Suite 4, Detroit, MI 48201-1234", source: "Yelp vs. Google" },
  { wrong: "(313) 555-0100", right: "313-555-0100", source: "Apple Maps vs. Facebook" },
  { wrong: "Smith HVAC Services", right: "Smith's HVAC", source: "Foursquare vs. Google" },
];

export default function CitationMonitor() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "", locationCount: "", primaryAddress: "" });
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
      const { data, error } = await supabase.functions.invoke("create-citation-monitor-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">Audit started.</h1>
        <p className="text-muted-foreground">Matt will set up your location monitoring within 24 hours. Expect your first citation health report within 48 hours — including every inconsistency we find across all your directories.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Multi-Location Citation Monitor — NAP Consistency Across 30+ Directories | $99/mo"
        description="AI monitors all your locations across Google, Yelp, Facebook, Apple Maps, and 30+ directories weekly. Finds NAP inconsistencies killing your local SEO. 14-day trial."
        path="/citation-monitor"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-24 pb-20 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <MapPin size={11} /> Citation Monitor
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-tight mb-6">
              Wrong Address on Yelp Is<br />
              <span className="text-primary">Costing You Customers.</span><br />
              We Find It. Every Week.
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
              Google uses your NAP data across dozens of directories to decide where you rank in local search. One inconsistency — a missing suite number, an old phone number, a slightly different business name — silently tanks your ranking.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              M2 monitors every directory weekly and delivers an exact report of every inconsistency found, with instructions for fixing each one.
            </p>
            <div className="flex flex-col items-center gap-2 mb-10">
              <div className="text-5xl font-black text-primary">$99<span className="text-2xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground">14-day free trial · All locations included · Cancel anytime</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start 14-Day Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* NAP examples */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-3 uppercase tracking-tight">The Inconsistencies That Kill Rankings</h2>
            <p className="text-center text-muted-foreground text-sm mb-10">These look minor. To Google's local algorithm, they're dealbreakers.</p>
            <div className="space-y-4">
              {NAP_EXAMPLES.map((ex, i) => (
                <div key={i} className="p-5 border border-border rounded-lg">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{ex.source}</div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1">Directory A</div>
                      <div className="text-sm font-mono text-foreground">{ex.wrong}</div>
                    </div>
                    <div className="p-3 bg-green-500/5 border border-green-500/20 rounded">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-green-500 mb-1">Directory B</div>
                      <div className="text-sm font-mono text-foreground">{ex.right}</div>
                    </div>
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
            <p className="text-center text-muted-foreground text-sm mb-8">Yext will charge you $500+/mo just to keep directories synced. We monitor and report — you fix, free.</p>
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
              Tell us your primary location. We'll find the rest and run a full citation audit within 48 hours.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business Name *", placeholder: "Smith's HVAC" },
                { key: "name", label: "Your Name *", placeholder: "John Smith" },
                { key: "email", label: "Work Email *", placeholder: "john@smithshvac.com", type: "email" },
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
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Number of Locations *</label>
                <input
                  type="number"
                  min="1"
                  value={form.locationCount}
                  onChange={(e) => setForm((p) => ({ ...p, locationCount: e.target.value }))}
                  placeholder="3"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Primary Business Address *</label>
                <input
                  type="text"
                  value={form.primaryAddress}
                  onChange={(e) => setForm((p) => ({ ...p, primaryAddress: e.target.value }))}
                  placeholder="123 Main Street, Detroit, MI 48201"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Primary business address — we'll find the rest</p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3.5 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded-sm transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                {loading ? "Redirecting…" : "Start Citation Monitoring — $99/mo"}
              </button>
              <p className="text-center text-xs text-muted-foreground pt-1">14-day free trial · Cancel anytime</p>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
