import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Search, MapPin, Users, AlignLeft, Zap } from "lucide-react";

const REPORT_ITEMS = [
  { icon: Search, label: "Google Business Profile health score", sub: "See exactly how your profile stacks up and what's missing" },
  { icon: MapPin, label: "Local keyword rankings", sub: "Where you show up on Google for the searches that matter to you" },
  { icon: Users, label: "Top 3 competitor comparison", sub: "What your nearest competitors are doing that you're not" },
  { icon: AlignLeft, label: "Citation consistency check", sub: "Is your name, address, and phone number consistent everywhere online?" },
  { icon: Zap, label: "5 prioritized action items", sub: "What to fix this month to move up in local search — ranked by impact" },
];

const FAQS = [
  { q: "What's a citation?", a: "Anywhere your business name, address, and phone number appear online — Yelp, Yellow Pages, Apple Maps, local directories. Google cross-references these. Inconsistencies hurt your ranking." },
  { q: "Do I need to do anything each month?", a: "No. Your report arrives in your inbox on the first of every month. We pull the data, Claude writes the analysis, you read it over coffee." },
  { q: "Why not just use a local SEO agency?", a: "A decent agency charges $500-1,500/mo and most of that goes to overhead and account management. We automate the research and reporting. You get 80% of the insight at 14% of the cost." },
  { q: "What if I don't rank anywhere yet?", a: "That's exactly who this is for. The report shows you the gaps and tells you precisely what to fix first. Month two you'll see movement." },
  { q: "Can I bundle this with GBP posting?", a: "Yes — GBP Posting ($49/mo) + Monthly SEO Report ($69/mo) together is $109/mo, saving you $9/month. Ask Matt after checkout." },
  { q: "Can I cancel?", a: "Any time. Cancel before your next billing date and you won't be charged again." },
];

export default function SeoAuditService() {
  const [form, setForm] = useState({ business_name: "", contact_name: "", email: "", phone: "", target_keywords: "" });
  const [submitting, setSubmitting] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">You're in.</h1>
          <p className="text-muted-foreground leading-relaxed">Your first SEO report will arrive by the 1st of next month. Matt will send a quick confirmation within 24 hours.</p>
          <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_name) { toast.error("Business name and email are required"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-seo-report-checkout", {
        body: form,
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Monthly Local SEO Report — $69/month | M² SEO Reports"
        description="Automated monthly SEO report card for local businesses. Keyword rankings, GBP health score, competitor comparison, and 5 action items — delivered to your inbox every month."
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">M² SEO Reports</p>
          <h1 className="text-3xl font-black mb-4">Your monthly SEO report card.<br />Automated. $69/mo.</h1>
          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            Local SEO agencies charge $500/mo for this. We deliver 80% of the value automatically every month.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 bg-primary/10 border border-primary/30 px-4 py-2 rounded text-sm text-primary font-bold">
            $69/mo — Cancel anytime
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* What's in the report */}
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">What's in your monthly report</h2>
          <div className="space-y-3 mb-12">
            {REPORT_ITEMS.map(({ icon: Icon, label, sub }, i) => (
              <div key={label} className="bg-card border border-border p-4 flex items-start gap-3">
                <span className="text-[11px] font-black text-primary bg-primary/10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <Icon size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-foreground">{label}</p>
                  <p className="text-[12px] text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
            <div className="bg-card border border-border p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Local SEO Agency</p>
              <p className="text-2xl font-black text-muted-foreground mb-1">$500–$1,500<span className="text-sm font-normal">/mo</span></p>
              <div className="space-y-1.5 mt-3">
                {["Monthly reporting", "Keyword tracking", "Manual analysis", "Account manager overhead"].map(i => (
                  <div key={i} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <CheckCircle size={11} className="text-muted-foreground flex-shrink-0" /> {i}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border-2 border-primary p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">M² SEO Reports</p>
              <p className="text-2xl font-black text-primary mb-1">$69<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <div className="space-y-1.5 mt-3">
                {["Monthly automated report", "Keyword ranking data", "AI-written analysis", "5 action items, ranked by impact"].map(i => (
                  <div key={i} className="flex items-center gap-2 text-[12px] text-foreground">
                    <CheckCircle size={11} className="text-primary flex-shrink-0" /> {i}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bundle callout */}
          <div className="bg-primary/5 border border-primary/30 p-5 mb-12">
            <p className="text-sm font-black text-foreground mb-1">Bundle deal — save $9/month</p>
            <p className="text-[13px] text-muted-foreground">
              Add GBP Posting ($49/mo) and pay just <strong className="text-foreground">$109/mo</strong> for both — automated Google posts 3x/week plus your monthly SEO report. Ask Matt after checkout.
            </p>
          </div>

          {/* Signup form */}
          <div className="bg-card border border-border p-6 mb-10">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground mb-1">Get Started — $69/month</h2>
            <p className="text-[12px] text-muted-foreground mb-4">First report arrives by the 1st of next month.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Business Name *</label>
                  <input value={form.business_name} onChange={e => setForm(f => ({...f, business_name: e.target.value}))} required placeholder="Smith Plumbing Co."
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Name</label>
                  <input value={form.contact_name} onChange={e => setForm(f => ({...f, contact_name: e.target.value}))} placeholder="John Smith"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
                  <input type="email" required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="you@business.com"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="(313) 555-0100"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">What do you want to rank for?</label>
                <textarea
                  value={form.target_keywords}
                  onChange={e => setForm(f => ({...f, target_keywords: e.target.value}))}
                  placeholder="e.g. HVAC Detroit, furnace repair Grosse Pointe, AC installation Wayne County"
                  rows={3}
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none resize-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">We use these to track your local keyword rankings month over month.</p>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {submitting ? "Processing…" : "Get My Monthly SEO Report — $69/mo →"}
              </button>
            </form>
          </div>

          {/* Matt trust block */}
          <div className="bg-card border border-border p-5 mb-10 flex items-start gap-4">
            <img
              src="https://www.mattmichelstraining.com/images/matt-boat.jpg"
              alt="Matt Michels"
              className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0"
            />
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">I'm Matt Michels — Grosse Pointe, MI.</span> Local SEO used to mean paying an agency $500/mo to pull a report you barely understood. I automated the whole thing. Same data, plain English, fraction of the cost.
            </p>
          </div>

          {/* FAQs */}
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Common questions</h2>
          <div className="space-y-4 mb-8">
            {FAQS.map(faq => (
              <div key={faq.q} className="border-b border-border pb-4">
                <p className="font-bold text-sm text-foreground mb-1.5">{faq.q}</p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>

          <p className="text-[12px] text-muted-foreground text-center">Questions? Email <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a> or text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    </>
  );
}
