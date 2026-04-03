import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, CalendarX, Zap, DollarSign, Clock } from "lucide-react";

const STATS = [
  { icon: DollarSign, stat: "$75–$300", label: "avg value of a missed appointment" },
  { icon: CalendarX, stat: "1 in 5", label: "appointments are no-shows" },
  { icon: Zap, stat: "30 min", label: "wait time before we text them" },
  { icon: Clock, stat: "47%", label: "of no-shows reschedule when asked" },
];

export default function NoShowRebooker() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "", bookingUrl: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) { toast.error("Email and business name required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-noshow-checkout", { body: form });
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
        <p className="text-muted-foreground">Matt will reach out within 24 hours to set up the webhook connection with your booking system. After that, every no-show gets a re-booking text automatically.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? Text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="No-Show Re-Booker — Auto-Text Cancelled Clients | $29/mo" description="When an appointment is a no-show or cancellation, we text the customer 30 minutes later to reschedule. One rebooked client pays for months. $29/mo." path="/no-show-rebooker" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <CalendarX size={11} /> No-Show Re-Booker
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Stop Losing Money<br /><span className="text-primary">to No-Shows.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              When a client no-shows or cancels, we automatically text them 30 minutes later: "We missed you — want to reschedule?"
              Nearly half of them say yes.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$25<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-2">7-day free trial · Cancel anytime</p>
            <p className="text-xs text-muted-foreground mb-8">One rebooked appointment = months of subscription paid for</p>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90">
              Start 7-Day Free Trial <ArrowRight size={14} />
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

        <section id="signup" className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your Free Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">7 days free. $25/mo after. Cancel anytime.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business Name *", placeholder: "Clear Smiles Dental" },
                { key: "name", label: "Your Name", placeholder: "Dr. Sarah Lee" },
                { key: "email", label: "Email *", placeholder: "sarah@clearsmiles.com", type: "email" },
                { key: "phone", label: "Your Phone", placeholder: "(248) 555-0100", type: "tel" },
                { key: "bookingUrl", label: "Online Booking URL (optional)", placeholder: "https://clearsmiles.com/book" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input type={f.type || "text"} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              ))}
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Redirecting…" : "Start Free Trial — $25/mo After"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
