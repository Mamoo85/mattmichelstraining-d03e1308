import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Shield, Bell, FileText, AlertTriangle, Clock, Search, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Monitors Your Specific Agencies",
    desc: "You tell us which regulatory bodies matter — FDA, OSHA, CMS, CFPB, EPA, state agencies. We monitor only those, every week. No noise from agencies that don't affect your business.",
  },
  {
    icon: FileText,
    title: "Plain-English Weekly Summary",
    desc: "Every change gets a plain-English translation: what changed, what it means for a business in your industry, whether action is required, and what the deadline is if so.",
  },
  {
    icon: Bell,
    title: "SMS Alert for Urgent Changes",
    desc: "Enforcement actions, emergency rules, and changes with immediate effective dates trigger an SMS — not a weekly email. You know the same day it drops.",
  },
  {
    icon: AlertTriangle,
    title: "Action Required Flag",
    desc: "Every item is tagged: Action Required (Yes/No) and Deadline. Scan the list in 2 minutes. Focus on what demands a response. Ignore the rest.",
  },
  {
    icon: Clock,
    title: "Federal Register + Agency Sites",
    desc: "Proposed rules, final rules, guidance documents, enforcement actions, no-action letters, FAQs — all sources monitored, not just the Federal Register.",
  },
  {
    icon: Shield,
    title: "Compliance Audit Trail",
    desc: "Every weekly report is stored with date and regulatory source. When an auditor asks what you knew and when, you have a complete, timestamped record.",
  },
];

const COMPARISON = [
  { tool: "LexisNexis Regulatory Alerts", price: "$500+/mo", what: "Comprehensive — requires a trained legal team to interpret", highlight: false },
  { tool: "Bloomberg Law", price: "$6,000+/yr", what: "Law firm tool — overkill for most businesses, steep learning curve", highlight: false },
  { tool: "Compliance consultant", price: "$200–500/hr", what: "Expert interpretation — available by appointment only", highlight: false },
  { tool: "Manual monitoring", price: "5+ hrs/week", what: "Staff time reading Federal Register — high effort, high miss rate", highlight: false },
  { tool: "M² Regulatory Monitor", price: "$299/mo", what: "Weekly plain-English summary — agency-specific, action-flagged, SMS for urgent", highlight: true },
];

const INDUSTRIES = [
  "Healthcare / Medical Devices",
  "Food & Beverage / Restaurants",
  "Financial Services",
  "Construction / Contractors",
  "Transportation / Logistics",
  "Manufacturing",
  "Real Estate",
  "Environmental / Waste",
  "Pharmaceuticals",
  "Child Care / Education",
];

export default function RegulatoryMonitor() {
  const [form, setForm] = useState({
    email: "", name: "", businessName: "", phone: "",
    industry: "", regulatoryBodies: "",
  });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) { toast.error("Email and business name are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-regulatory-monitor-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">Monitoring is active.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your regulatory profile is set. Your first weekly summary arrives within 7 days. SMS alerts for urgent changes are active immediately.
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
        title="Regulatory Change Monitor — Weekly Plain-English Compliance Summaries | $299/mo"
        description="AI monitors your specific regulatory agencies weekly. Delivers plain-English summaries: what changed, what it means for your business, action required, deadline. $299/mo. 14-day trial."
        path="/regulatory-monitor"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-24 pb-20 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Shield size={11} /> Regulatory Change Monitor
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-6">
              Weekly plain-English summary of every<br />
              <span className="text-primary">regulatory change that affects your business.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
              Most businesses find out about regulatory changes from their attorney — after they've already violated them. This system watches the agencies that govern your industry and tells you what changed, what it means, and what you need to do about it. Every week.
            </p>
            <div className="mb-10">
              <div className="text-5xl font-black text-primary">$299<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground mt-1">14-day free trial · No contracts · Cancel anytime</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start Monitoring My Agencies <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Industry strip */}
        <section className="py-8 px-4 border-b border-border bg-card">
          <div className="max-w-4xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground text-center mb-4">Works For Any Regulated Industry</p>
            <div className="flex flex-wrap justify-center gap-2">
              {INDUSTRIES.map((ind) => (
                <span key={ind} className="px-3 py-1 border border-border text-xs font-medium text-muted-foreground rounded-full">
                  {ind}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Sample report */}
        <section className="py-20 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">Sample Report Entry</p>
              <h2 className="text-2xl sm:text-3xl font-black">What lands in your inbox every week.</h2>
            </div>
            <div className="border border-border rounded-lg divide-y divide-border">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-black text-sm">OSHA — Updated Silica Exposure Limits for Construction</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Federal Register Vol. 91, No. 42 · Published Apr 1, 2026</p>
                  </div>
                  <span className="flex-shrink-0 bg-red-500/10 text-red-500 text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wide">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  <strong className="text-foreground">What changed:</strong> OSHA reduced the permissible exposure limit (PEL) for respirable crystalline silica from 250 to 50 micrograms per cubic meter of air.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  <strong className="text-foreground">What it means for your business:</strong> Any construction work involving concrete cutting, grinding, or drilling requires updated respiratory protection and exposure monitoring. Existing compliance programs need to be reviewed and updated.
                </p>
                <div className="flex items-center gap-4 text-xs">
                  <span className="font-bold text-foreground">Deadline: <span className="text-primary">June 23, 2026</span></span>
                  <span className="text-muted-foreground">· Effective date: 60 days from publication</span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-black text-sm">EPA — No Change to Stormwater Permit Thresholds</p>
                    <p className="text-xs text-muted-foreground mt-0.5">EPA Guidance Update · Published Mar 28, 2026</p>
                  </div>
                  <span className="flex-shrink-0 bg-green-500/10 text-green-500 text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wide">
                    No Action
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  EPA clarified existing guidance on stormwater discharge permits. No change to thresholds or reporting requirements. No action needed at this time.
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
              <h2 className="text-2xl sm:text-3xl font-black">Your own compliance watchdog. Running 24/7.</h2>
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
              <h2 className="text-2xl sm:text-3xl font-black">What compliance intelligence costs everywhere else.</h2>
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
              <p className="text-muted-foreground text-sm">$299/mo after trial. Cancel anytime. First weekly report within 7 days.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "name", label: "Your Name *", placeholder: "Chris Morgan", type: "text" },
                { key: "businessName", label: "Business Name *", placeholder: "Morgan Construction LLC", type: "text" },
                { key: "email", label: "Email Address *", placeholder: "chris@morganconstruction.com", type: "email" },
                { key: "phone", label: "Mobile Phone (for urgent SMS alerts) *", placeholder: "(313) 555-0100", type: "tel" },
                { key: "industry", label: "Your Industry *", placeholder: "Construction / General Contracting", type: "text" },
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
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Regulatory Agencies to Monitor *</label>
                <textarea
                  value={form.regulatoryBodies}
                  onChange={e => setForm(p => ({ ...p, regulatoryBodies: e.target.value }))}
                  placeholder={"Which agencies matter to your business? (one per line)\nOSHA\nEPA\nMichigan Department of Labor"
                  }
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
                {loading ? "Redirecting…" : "Start Free Trial — $299/mo After"}
              </button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-4">Secure checkout via Stripe. No card charged for 14 days.</p>
          </div>
        </section>

      </div>
    </>
  );
}
