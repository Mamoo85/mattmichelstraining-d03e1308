import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Clock, Star, Mail, BarChart2 } from "lucide-react";

const FEATURES = [
  { icon: Clock, label: "Monitors Google reviews 24/7", sub: "Never miss a new review — positive or negative" },
  { icon: Star, label: "AI-crafted responses that sound human", sub: "Not robotic auto-replies — genuinely personal, professional tone" },
  { icon: ArrowRight, label: "Responds within 2 hours", sub: "Every review answered fast, while the moment still matters" },
  { icon: BarChart2, label: "Weekly email report", sub: "Ratings trend, response rate, and review count delivered every Monday" },
];

const STEPS = [
  { n: "01", title: "Sign up & connect your Google Business Profile", body: "Takes 5 minutes. We walk you through it. One-time setup." },
  { n: "02", title: "AI monitors for new reviews daily", body: "We check your profile multiple times a day so nothing slips through." },
  { n: "03", title: "Responses posted automatically", body: "You get a clean weekly summary — we handle every reply." },
];

const FAQS = [
  { q: "Do the responses sound like a robot?", a: "No. Claude reads the review and writes a response that sounds like it came from you — acknowledging the specific thing the customer mentioned, not a copy-paste template." },
  { q: "What about 1-star reviews?", a: "Especially important. We respond professionally, de-escalate, and invite the customer to reach out directly. A good response to a bad review often wins more trust than five 5-star reviews." },
  { q: "Does this affect my Google ranking?", a: "Yes. Google's algorithm factors in review response rate as a ranking signal. Businesses that respond consistently rank higher in local search." },
  { q: "Can I bundle this with GBP posting?", a: "Yes — GBP Posting ($49/mo) + Review Response ($99/mo) together is $179/mo, saving you $19/month." },
  { q: "Can I cancel?", a: "Any time, no questions asked. Cancel before your next billing date and you won't be charged again." },
];

export default function ReviewResponder() {
  const [form, setForm] = useState({ business_name: "", contact_name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">You're all set.</h1>
          <p className="text-muted-foreground leading-relaxed">Matt will reach out within 24 hours to connect your Google Business Profile and get review monitoring active.</p>
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
      const { data, error } = await supabase.functions.invoke("create-review-responder-checkout", {
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
        title="Automated Google Review Responses — $99/month | M² Review Responder"
        description="Every Google review answered within 2 hours, automatically. AI-crafted responses that sound human. Never lose a customer to an unanswered review again."
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">M² Review Responder</p>
          <h1 className="text-3xl font-black mb-4">Your Google reviews —<br />answered within 2 hours. Automatically.</h1>
          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            Every 1-star review left unanswered costs you customers. We respond for you — professionally, personally, 24/7.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 bg-primary/10 border border-primary/30 px-4 py-2 rounded text-sm text-primary font-bold">
            $99/mo — Cancel anytime
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* Features */}
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">What you get</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
            {FEATURES.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="bg-card border border-border p-5 flex items-start gap-3">
                <Icon size={18} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-foreground mb-1">{label}</p>
                  <p className="text-[12px] text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bundle callout */}
          <div className="bg-primary/5 border border-primary/30 p-5 mb-12">
            <p className="text-sm font-black text-foreground mb-1">Bundle deal — save $19/month</p>
            <p className="text-[13px] text-muted-foreground">
              Add GBP Posting ($49/mo) to this service and pay just <strong className="text-foreground">$179/mo</strong> for both — AI posts 3x/week + automated review responses. Ask Matt about the bundle after checkout.
            </p>
          </div>

          {/* How it works */}
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">How it works</h2>
          <div className="space-y-4 mb-12">
            {STEPS.map(step => (
              <div key={step.n} className="flex items-start gap-4 border-b border-border pb-4">
                <span className="text-2xl font-black text-primary flex-shrink-0 leading-none">{step.n}</span>
                <div>
                  <p className="font-bold text-sm text-foreground mb-1">{step.title}</p>
                  <p className="text-[13px] text-muted-foreground">{step.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Signup form */}
          <div className="bg-card border border-border p-6 mb-10">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground mb-1">Get Started — $99/month</h2>
            <p className="text-[12px] text-muted-foreground mb-4">Enter your info below to proceed to checkout. Setup takes 5 minutes.</p>
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
              <button type="submit" disabled={submitting}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {submitting ? "Processing…" : "Start Review Responder — $99/mo →"}
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
              <span className="font-bold text-foreground">I'm Matt Michels — Grosse Pointe, MI.</span> I built this because I watched too many good local businesses lose customers over unanswered reviews. You're busy. Let the system handle it.
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
