import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Calendar, MessageSquare, TrendingUp, Zap } from "lucide-react";

const CAMPAIGNS = [
  { month: "Jan", campaign: "New Year Special", example: "\"New year, fresh start — book your first appointment and save 15%!\"" },
  { month: "Mar", campaign: "Spring Kickoff", example: "\"Spring is here! Time for your [service] tune-up. Book this week for priority scheduling.\"" },
  { month: "May", campaign: "Mother's Day", example: "\"Treat Mom (or yourself) this Mother's Day. Gift cards available!\"" },
  { month: "Jul", campaign: "Summer Push", example: "\"Summer slots are filling fast — lock in your [service] before August.\"" },
  { month: "Sep", campaign: "Fall Prep", example: "\"Fall maintenance season is here. Book your [service] before the rush hits.\"" },
  { month: "Nov", campaign: "Holiday Special", example: "\"Holiday special: book in November, save for December. Limited spots.\"" },
];

export default function SeasonalPromos() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "", businessType: "", city: "", state: "MI" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) { toast.error("Email and business name required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-promo-blaster-checkout", { body: form });
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
        <p className="text-muted-foreground">Matt will import your customer list and schedule your seasonal campaigns within 24 hours. Six times a year, a promo blast goes out automatically — no logins, no clicking send.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? Text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="Seasonal Promo Blasts — 6 AI-Written Campaigns a Year | $29/mo" description="Six seasonal SMS campaigns per year, AI-written and auto-sent to your customer list. Stay relevant all year for $29/mo." path="/seasonal-promos" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Calendar size={11} /> Seasonal Promos
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              6 Promo Blasts<br /><span className="text-primary">All Year. Zero Effort.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              New Year. Spring. Mother's Day. Summer. Fall. Holidays. Six times a year, AI writes a seasonal promo and texts your entire customer list automatically.
            </p>
            <div className="text-4xl font-black text-primary mb-1">$29<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
            <p className="text-sm text-muted-foreground mb-2">14-day free trial · Cancel anytime</p>
            <p className="text-xs text-muted-foreground mb-8">Works for any local service business</p>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90">
              Start 14-Day Free Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section className="py-12 px-4">
          <div className="max-w-3xl mx-auto grid sm:grid-cols-4 gap-6 text-center">
            {[
              { icon: Calendar, stat: "6x/yr", label: "campaigns auto-sent" },
              { icon: MessageSquare, stat: "AI-written", label: "tailored to your biz & season" },
              { icon: TrendingUp, stat: "200+", label: "customers per blast" },
              { icon: Zap, stat: "$0", label: "effort after setup" },
            ].map((s) => (
              <div key={s.stat} className="bg-card border border-border p-5">
                <s.icon size={20} className="text-primary mx-auto mb-2" />
                <div className="text-xl font-black text-foreground mb-1">{s.stat}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">Your 6-Campaign Calendar</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {CAMPAIGNS.map((c) => (
                <div key={c.month} className="border border-border p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded w-10 text-center">{c.month}</span>
                    <p className="font-bold text-sm">{c.campaign}</p>
                  </div>
                  <p className="text-xs text-muted-foreground italic pl-13">{c.example}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-6">AI tailors every message to your specific business type and location.</p>
          </div>
        </section>

        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your Free Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">14 days free. $29/mo after. Cancel anytime.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business Name *", placeholder: "River Oaks Salon" },
                { key: "businessType", label: "Business Type", placeholder: "Hair Salon" },
                { key: "name", label: "Your Name", placeholder: "Lisa Chen" },
                { key: "email", label: "Email *", placeholder: "lisa@riveroakssalon.com", type: "email" },
                { key: "phone", label: "Your Phone", placeholder: "(248) 555-0100", type: "tel" },
                { key: "city", label: "City", placeholder: "Grosse Pointe" },
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
