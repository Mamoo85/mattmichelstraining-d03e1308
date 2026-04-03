import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Wrench, Star, RefreshCw, Heart } from "lucide-react";

const SEQUENCE = [
  { day: "Day 1", icon: Heart, title: "Thank You Text", desc: "A warm, genuine thank-you sent within 24 hours of job completion. Customers remember this." },
  { day: "Day 3", icon: Star, title: "Google Review Ask", desc: "A friendly nudge asking for a review. '30 seconds, means a lot to a small business.' Most say yes." },
  { day: "Day 30", icon: RefreshCw, title: "Upsell Check-In", desc: "A light check-in a month later: any maintenance needed? Another project in mind? Repeat customers = no marketing cost." },
];

const STATS = [
  { stat: "70%", label: "of revenue comes from repeat customers" },
  { stat: "5x", label: "cheaper to retain vs. acquire a customer" },
  { stat: "3 texts", label: "automated, no effort after setup" },
  { stat: "$29", label: "per month total" },
];

export default function AfterJobFollowup() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "", businessType: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) { toast.error("Email and business name required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-afterjob-drip-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) { toast.error(err.message || "Something went wrong"); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-green-500" /></div>
        <h1 className="text-2xl font-black text-foreground mb-3">7-Day Trial Started!</h1>
        <p className="text-muted-foreground">Matt will connect your intake webhook within 24 hours. Log a completed job and the 3-text sequence fires automatically — thank you, review ask, and 30-day upsell.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? Text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="After-Job Follow-Up — Auto-Text Customers After Every Job | $29/mo" description="3-text sequence after every job: thank you, Google review ask, 30-day upsell. Turn one-time jobs into lifetime customers. 7-day free trial." path="/after-job-followup" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Wrench size={11} /> After-Job Follow-Up
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Turn Every Job<br /><span className="text-primary">Into a Lifetime Customer.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              When the job is done, the relationship just started. A 3-text sequence — thank you, review ask, 30-day check-in — keeps customers loyal and your Google rating climbing.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$29<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-2">7-day free trial · Cancel anytime</p>
            <p className="text-xs text-muted-foreground mb-8">Works for any trade, service, or repair business</p>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90">
              Start 7-Day Free Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">The 3-Text Sequence</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {SEQUENCE.map((s) => (
                <div key={s.day} className="text-center bg-card border border-border p-6">
                  <div className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded inline-block mb-3">{s.day}</div>
                  <s.icon size={24} className="text-primary mx-auto mb-3" />
                  <h3 className="font-bold text-sm mb-2">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4 bg-card border-y border-border">
          <div className="max-w-3xl mx-auto grid sm:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.stat} className="text-center">
                <div className="text-2xl font-black text-primary mb-1">{s.stat}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your Free Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">7 days free. $29/mo after. Cancel anytime.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business Name *", placeholder: "Garcia Plumbing & Drain" },
                { key: "businessType", label: "Business Type", placeholder: "Plumbing" },
                { key: "name", label: "Your Name", placeholder: "Carlos Garcia" },
                { key: "email", label: "Email *", placeholder: "carlos@garciaplumbing.com", type: "email" },
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
                {loading ? "Redirecting…" : "Start Free Trial — $29/mo After"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
