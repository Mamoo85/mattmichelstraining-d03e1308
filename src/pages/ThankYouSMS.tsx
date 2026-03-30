import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Heart, Repeat, Zap, SmilePlus } from "lucide-react";

const BENEFITS = [
  { icon: Heart, label: "Personalized AI messages", sub: "Every thank-you text is unique, mentioning the customer's name and the service performed" },
  { icon: Repeat, label: "Builds loyalty", sub: "Customers who feel appreciated come back — and refer their friends" },
  { icon: Zap, label: "Automated after every job", sub: "No manual effort — texts go out automatically when a job is marked complete" },
  { icon: SmilePlus, label: "Customers love it", sub: "A simple thank-you text makes your business stand out from every competitor" },
];

const STEPS = [
  { num: "1", title: "Sign up", desc: "Enter your business info and we set up your automated texts." },
  { num: "2", title: "AI writes thank-yous", desc: "After every job, AI sends a personalized thank-you text to your customer." },
  { num: "3", title: "Build loyalty", desc: "Watch repeat business and referrals grow without lifting a finger." },
];

export default function ThankYouSMS() {
  const [form, setForm] = useState({
    name: "",
    business_name: "",
    email: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const success = new URLSearchParams(window.location.search).get("status") === "success";

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">You're all set.</h1>
          <p className="text-muted-foreground leading-relaxed">Matt will reach out within 24 hours to get your thank-you texts configured.</p>
          <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_name) {
      toast.error("Business name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-thank-you-sms-checkout", {
        body: { ...form },
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="bg-[#1e293b] text-white px-6 py-16 text-center">
        <p className="inline-block text-[11px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full mb-4">AI Thank You Text</p>
        <h1 className="text-3xl font-black mb-4 leading-tight">
          Turn every completed job into a loyal customer.
        </h1>
        <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed mb-4">
          AI sends a personalized thank-you text after every job. Your customers feel appreciated, and you get more repeat business and referrals.
        </p>
        <p className="text-2xl font-black text-primary">$19<span className="text-sm font-normal text-slate-400">/month</span></p>
        <p className="text-[12px] text-slate-400 mt-1">7-day free trial. Cancel anytime.</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {BENEFITS.map(({ icon: Icon, label, sub }) => (
            <div key={label} className="bg-card border border-border p-5">
              <Icon size={20} className="text-primary mb-3" />
              <p className="font-bold text-sm text-foreground mb-1">{label}</p>
              <p className="text-[12px] text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {STEPS.map(({ num, title, desc }) => (
            <div key={num} className="bg-card border border-border p-5">
              <p className="text-2xl font-black text-primary mb-2">{num}</p>
              <p className="font-bold text-sm text-foreground mb-1">{title}</p>
              <p className="text-[12px] text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        {/* Sign-up form */}
        <div className="bg-card border border-border p-6 mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground mb-4">
            Get Started — $19/month
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="John Smith"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Business Name *</label>
                <input
                  required
                  value={form.business_name}
                  onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                  placeholder="Smith Plumbing Co."
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@business.com"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(313) 555-0100"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {submitting ? "Processing..." : "Start Free Trial — $19/mo"}
            </button>
            <p className="text-[11px] text-muted-foreground text-center">Secure checkout via Stripe. 7-day free trial. Cancel anytime.</p>
          </form>
        </div>

        {/* Founder credibility */}
        <div className="bg-card border border-border p-5 mb-10 flex items-start gap-4">
          <img src="/images/matt-boat.jpg" alt="Matt Michels" className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0" />
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            <span className="font-bold text-foreground">Matt Michels — Grosse Pointe, MI.</span>{" "}
            I built this because a simple thank-you goes further than any ad campaign. For $19 a month, every customer feels valued.
          </p>
        </div>

        <p className="text-[12px] text-muted-foreground text-center">
          Questions? Email <a href="mailto:matt@m2training.com" className="text-primary">matt@m2training.com</a> or text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );
}
