import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, FileText, TrendingUp, Clock, DollarSign } from "lucide-react";

const STATS = [
  { icon: FileText, stat: "60%", label: "of quotes never get a follow-up" },
  { icon: Clock, stat: "5 texts", label: "sent over 2 weeks automatically" },
  { icon: TrendingUp, stat: "30%+", label: "more quotes convert with follow-up" },
  { icon: DollarSign, stat: "$0", label: "effort after setup" },
];

const SEQUENCE = [
  { day: "2 hrs", title: "Thank You + Summary", msg: "\"Thanks for the opportunity, [Name]. Here's a quick summary of what we discussed...\"" },
  { day: "Day 3", title: "Value Reminder", msg: "\"Just checking in — any questions about the estimate? Happy to walk through it.\"" },
  { day: "Day 7", title: "Urgency Nudge", msg: "\"We have a slot opening up next week. Want to lock it in before it's gone?\"" },
  { day: "Day 10", title: "Objection Handle", msg: "\"If price is a concern, I'd love to talk options. No pressure either way.\"" },
  { day: "Day 14", title: "Final Check-In", msg: "\"Last check-in from us — still happy to help if the timing works. No hard feelings if not!\"" },
];

export default function EstimateFollowup() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "", businessType: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) { toast.error("Email and business name required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-estimate-drip-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) { toast.error(err.message || "Something went wrong"); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-green-500" /></div>
        <h1 className="text-2xl font-black text-foreground mb-3">14-Day Trial Started!</h1>
        <p className="text-muted-foreground">Matt will set up your intake webhook within 24 hours. After that, every estimate you log triggers the 5-text follow-up sequence automatically.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? Text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="Estimate Follow-Up Drip — Auto-Text Quotes That Go Silent | $49/mo" description="Send a 5-text sequence to every estimate you give. Convert 30% more quotes to jobs. 14-day free trial. $49/mo." path="/estimate-followup" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <FileText size={11} /> Estimate Follow-Up
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Stop Losing Jobs<br /><span className="text-primary">to Silence.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              You give an estimate. They say "we'll think about it." Then nothing. A 5-text sequence sent automatically over 2 weeks converts 30%+ more quotes into paying jobs — without you lifting a finger.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$39<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-2">14-day free trial · Cancel anytime</p>
            <p className="text-xs text-muted-foreground mb-8">One recovered job = months of subscription paid for</p>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90">
              Start 14-Day Free Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto grid sm:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.stat} className="text-center bg-card border border-border p-5">
                <s.icon size={20} className="text-primary mx-auto mb-2" />
                <div className="text-2xl font-black text-foreground mb-1">{s.stat}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">The 5-Text Sequence</h2>
            <div className="space-y-4">
              {SEQUENCE.map((s, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-16 text-right flex-shrink-0">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">{s.day}</span>
                  </div>
                  <div className="flex-1 border border-border p-4">
                    <p className="font-bold text-sm mb-1">{s.title}</p>
                    <p className="text-xs text-muted-foreground italic">{s.msg}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your Free Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">14 days free. $39/mo after. Cancel anytime.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business Name *", placeholder: "Apex Roofing & Gutters" },
                { key: "businessType", label: "Business Type", placeholder: "Roofing Contractor" },
                { key: "name", label: "Your Name", placeholder: "Mike Kowalski" },
                { key: "email", label: "Email *", placeholder: "mike@apexroofing.com", type: "email" },
                { key: "phone", label: "Your Phone", placeholder: "(313) 555-0100", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input type={f.type || "text"} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              ))}
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Redirecting…" : "Start Free Trial — $39/mo After"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
